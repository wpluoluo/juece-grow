#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "requests>=2.31.0",
#   "faker>=24.0.0",
#   "jsonschema>=4.22.0",
#   "jsonref>=1.1.0",
#   "rstr>=3.2.2",
#   "uv-mirror[china]>=0.2.1",
# ]
# ///

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import signal
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Prefer faster/closer PyPI mirror when available (no-op if not installed).
try:
    import uv_mirror  # type: ignore
except Exception:
    uv_mirror = None

try:
    import jsonref  # type: ignore
except Exception:
    jsonref = None

import requests

# Increase CSV field size limit to avoid "field larger than field limit" errors on large responses.
try:
    csv.field_size_limit(10 * 1024 * 1024)  # 10 MB per field
except Exception:
    pass

# Keep a copy of the loaded OpenAPI for $ref resolution in helpers.
OPENAPI_DOC: Dict[str, Any] = {}


CSV_COLUMNS = [
    "Issue_ID",
    "Service",
    "Title",
    "Method",
    "Path",
    "Auth",
    "Request_Example",
    "Expected_Status",
    "Expected_Body_Checks",
    "Log_Checks",
    "Test_Status",
    "Review_Status",
    "Notes",
]

FIX_CSV_COLUMNS = [
    "Issue_ID",
    "Source_Issue_ID",
    "Service",
    "Title",
    "Method",
    "Path",
    "Status",
    "Evidence",
    "Failure_Category",
    "Failure_Analysis",
    "Suggestion",
    "Notes",
    "Created_At",
    "Updated_At",
]

TRIAGE_CSV_COLUMNS = [
    "Triage_ID",
    "Fix_Issue_ID",
    "Source_Issue_ID",
    "Service",
    "Method",
    "Path",
    "Failure_Category",
    "Evidence",
    "Failure_Analysis",
    "Suggestion",
    "Notes",
    "Created_At",
    "Updated_At",
]


@dataclass(frozen=True)
class WorkspaceConfig:
    environment: str = "test"
    allow_mutations: bool = False
    base_url: str = "http://127.0.0.1:8080"
    base_url_allowlist: Tuple[str, ...] = (
        "http://127.0.0.1",
        "http://localhost",
        "https://127.0.0.1",
        "https://localhost",
    )
    health_path: str = "/health"
    openapi_path: str = "docs/openapi.json"
    openapi_url: str = "/openapi.json"
    log_path: str = ".aiws/tmp/server-test/app.log"
    request_id_header: str = "X-Request-Id"
    server_dirs: Tuple[str, ...] = ()
    build_cmd: str = ""
    start_cmd: str = ""
    stop_cmd: str = ""
    dangerous_disabled: bool = True
    max_requests_per_minute: int = 60


@dataclass(frozen=True)
class SecretsConfig:
    base_url: Optional[str]
    headers: Dict[str, str]
    service_base_urls: Dict[str, str]
    resource_ids: Dict[str, str]
    auth: Dict[str, Any]
    accounts: List[Dict[str, Any]]
    openapi_auth: Dict[str, Any]


def _b64_basic(user: str, password: str) -> str:
    import base64

    token = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def _get_first_account(secrets: SecretsConfig) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    for acc in secrets.accounts or []:
        if not isinstance(acc, dict):
            continue
        username = acc.get("username")
        password = acc.get("password")
        token = acc.get("token")
        if isinstance(username, str) and isinstance(password, str):
            return username, password, token if isinstance(token, str) else None
        if isinstance(token, str):
            return None, None, token
    return None, None, None


def _extract_by_dot_path(payload: Any, path: str) -> Optional[Any]:
    cur = payload
    for part in (path or "").split("."):
        key = part.strip()
        if not key:
            continue
        if isinstance(cur, dict) and key in cur:
            cur = cur[key]
        else:
            return None
    return cur


def build_auth_headers(*, base_url: str, secrets: SecretsConfig, request_id_header: str) -> Dict[str, str]:
    """
    Build auth headers without leaking secrets.
    Priority:
      1) secrets.headers (explicit headers)
      2) auth.type == bearer/basic/login with accounts/auth config
    """
    if secrets.headers:
        return dict(secrets.headers)

    auth = secrets.auth or {}
    auth_type = (auth.get("type") or "").strip().lower() if isinstance(auth.get("type"), str) else ""
    username, password, account_token = _get_first_account(secrets)

    if not auth_type:
        if isinstance(account_token, str) and account_token.strip():
            auth_type = "bearer"
            auth = {**auth, "token": account_token}
        elif isinstance(username, str) and isinstance(password, str):
            auth_type = "login"

    if auth_type in ("bearer", "token"):
        token = auth.get("token")
        if not (isinstance(token, str) and token.strip()):
            token = account_token
        if isinstance(token, str) and token.strip():
            header_name = auth.get("header_name") if isinstance(auth.get("header_name"), str) else "Authorization"
            scheme = auth.get("scheme") if isinstance(auth.get("scheme"), str) else "Bearer"
            return {header_name: f"{scheme} {token.strip()}"}
        return {}

    if auth_type == "basic":
        if isinstance(username, str) and isinstance(password, str):
            header_name = auth.get("header_name") if isinstance(auth.get("header_name"), str) else "Authorization"
            return {header_name: _b64_basic(username, password)}
        return {}

    if auth_type == "login":
        if not (isinstance(username, str) and isinstance(password, str)):
            return {}

        login_url = ""
        if isinstance(auth.get("login_url"), str) and auth.get("login_url", "").strip():
            login_url = auth["login_url"].strip()
        else:
            login_path = auth.get("login_path") if isinstance(auth.get("login_path"), str) else "/login"
            if not login_path.startswith("/"):
                login_path = "/" + login_path
            login_url = base_url.rstrip("/") + login_path

        method = auth.get("method") if isinstance(auth.get("method"), str) else "POST"
        method = method.strip().upper() or "POST"

        username_field = auth.get("username_field") if isinstance(auth.get("username_field"), str) else ""
        password_field = auth.get("password_field") if isinstance(auth.get("password_field"), str) else ""
        username_field = username_field.strip() or "username"
        password_field = password_field.strip() or "password"

        token_json_path = auth.get("token_json_path") if isinstance(auth.get("token_json_path"), str) else ""
        token_json_path = token_json_path.strip() or "token"

        extra_body = auth.get("extra_body") if isinstance(auth.get("extra_body"), dict) else {}
        content_type = auth.get("content_type") if isinstance(auth.get("content_type"), str) else "json"
        content_type = content_type.strip().lower() or "json"

        req_headers: Dict[str, str] = {}
        req_headers[request_id_header] = str(uuid.uuid4())
        try:
            if content_type == "form":
                body = {**extra_body, username_field: username, password_field: password}
                resp = requests.request(method=method, url=login_url, headers=req_headers, timeout=15, data=body)
            else:
                body = {**extra_body, username_field: username, password_field: password}
                resp = requests.request(method=method, url=login_url, headers=req_headers, timeout=15, json=body)
        except Exception:  # noqa: BLE001
            return {}

        if not (200 <= int(getattr(resp, "status_code", 0)) < 300):
            return {}
        try:
            payload = resp.json()
        except Exception:  # noqa: BLE001
            return {}

        token = _extract_by_dot_path(payload, token_json_path)
        if not (isinstance(token, str) and token.strip()):
            return {}

        header_name = auth.get("header_name") if isinstance(auth.get("header_name"), str) else "Authorization"
        scheme = auth.get("scheme") if isinstance(auth.get("scheme"), str) else "Bearer"
        return {header_name: f"{scheme} {token.strip()}"}

    return {}


def build_openapi_headers(*, secrets: SecretsConfig, request_id_header: str) -> Dict[str, str]:
    """
    Build headers for OpenAPI export; prefers secrets.openapi_auth, otherwise falls back to API auth headers.
    Supports headers/basic/bearer minimal cases.
    """
    cfg = secrets.openapi_auth or {}

    headers_raw = cfg.get("headers") if isinstance(cfg.get("headers"), dict) else {}
    out: Dict[str, str] = {}
    if headers_raw:
        for k, v in headers_raw.items():
            if isinstance(k, str) and isinstance(v, str):
                out[k] = v
        if out:
            return out

    typ = (cfg.get("type") or "").strip().lower() if isinstance(cfg.get("type"), str) else ""
    username = cfg.get("username") if isinstance(cfg.get("username"), str) else None
    password = cfg.get("password") if isinstance(cfg.get("password"), str) else None
    token = cfg.get("token") if isinstance(cfg.get("token"), str) else None
    if not username or not password:
        acc_user, acc_pass, acc_token = _get_first_account(secrets)
        username = username or acc_user
        password = password or acc_pass
        token = token or acc_token

    if typ == "basic" and username and password:
        hdr = cfg.get("header_name") if isinstance(cfg.get("header_name"), str) else "Authorization"
        return {hdr: _b64_basic(username, password)}
    if typ in ("bearer", "token") and token:
        hdr = cfg.get("header_name") if isinstance(cfg.get("header_name"), str) else "Authorization"
        scheme = cfg.get("scheme") if isinstance(cfg.get("scheme"), str) else "Bearer"
        return {hdr: f"{scheme} {token}"}

    # Fallback: reuse API auth headers.
    api_headers = build_auth_headers(base_url="", secrets=secrets, request_id_header=request_id_header)
    api_headers.pop(request_id_header, None)
    return api_headers


def _bool_from_str(value: str) -> Optional[bool]:
    normalized = value.strip().lower()
    if normalized in ("true", "yes", "y", "1", "on"):
        return True
    if normalized in ("false", "no", "n", "0", "off"):
        return False
    return None


def parse_ai_workspace_md(path: Path) -> WorkspaceConfig:
    if not path.exists():
        return WorkspaceConfig()

    text = path.read_text(encoding="utf-8", errors="replace")

    def find_scalar(key: str) -> Optional[str]:
        patterns = [
            rf"^\s*-\s*{re.escape(key)}\s*:\s*\"([^\"]+)\"\s*$",
            rf"^\s*-\s*{re.escape(key)}\s*:\s*'([^']+)'\s*$",
            rf"^\s*-\s*{re.escape(key)}\s*:\s*([^\s#]+)\s*$",
        ]
        for pat in patterns:
            m = re.search(pat, text, flags=re.MULTILINE)
            if m:
                return m.group(1).strip()
        return None

    def find_list(key: str) -> List[str]:
        lines = text.splitlines()
        start_idx = None
        for i, line in enumerate(lines):
            if re.match(rf"^\s*-\s*{re.escape(key)}\s*:\s*$", line):
                start_idx = i + 1
                break
        if start_idx is None:
            return []
        items: List[str] = []
        for line in lines[start_idx:]:
            m = re.match(r"^\s*-\s+(.+?)\s*$", line)
            if not m:
                if line.strip() == "":
                    continue
                break
            items.append(m.group(1).strip())
        return items

    environment = find_scalar("environment") or "test"
    allow_mutations_raw = find_scalar("allow_mutations")
    allow_mutations = _bool_from_str(allow_mutations_raw) if allow_mutations_raw else None

    base_url = find_scalar("base_url") or "http://127.0.0.1:8080"
    base_url_allowlist = tuple(find_list("base_url_allowlist")) or WorkspaceConfig.base_url_allowlist
    health_path = find_scalar("health_path") or "/health"
    openapi_path = find_scalar("openapi_path") or "docs/openapi.json"
    openapi_url = find_scalar("openapi_url") or "/openapi.json"
    log_path = find_scalar("log_path") or ".aiws/tmp/server-test/app.log"
    request_id_header = find_scalar("request_id_header") or "X-Request-Id"

    server_dirs = tuple(find_list("server_dirs"))
    dangerous_disabled_raw = find_scalar("dangerous_disabled")
    dangerous_disabled = _bool_from_str(dangerous_disabled_raw) if dangerous_disabled_raw else None
    max_rpm_raw = find_scalar("max_requests_per_minute")
    try:
        max_rpm = int(max_rpm_raw) if max_rpm_raw else WorkspaceConfig.max_requests_per_minute
    except ValueError:
        max_rpm = WorkspaceConfig.max_requests_per_minute

    return WorkspaceConfig(
        environment=environment,
        allow_mutations=bool(allow_mutations) if allow_mutations is not None else False,
        base_url=base_url,
        base_url_allowlist=base_url_allowlist,
        health_path=health_path,
        openapi_path=openapi_path,
        openapi_url=openapi_url,
        log_path=log_path,
        request_id_header=request_id_header,
        server_dirs=server_dirs,
        build_cmd=find_scalar("build_cmd") or "",
        start_cmd=find_scalar("start_cmd") or "",
        stop_cmd=find_scalar("stop_cmd") or "",
        dangerous_disabled=bool(dangerous_disabled) if dangerous_disabled is not None else True,
        max_requests_per_minute=max_rpm,
    )


def load_secrets(secrets_path: Path) -> SecretsConfig:
    if not secrets_path.exists():
        raise FileNotFoundError(f"missing secrets file: {secrets_path}")
    data = json.loads(secrets_path.read_text(encoding="utf-8"))

    auth_raw = data.get("auth") if isinstance(data.get("auth"), dict) else {}
    headers_raw = (auth_raw or {}).get("headers") or {}
    headers: Dict[str, str] = {}
    if isinstance(headers_raw, dict):
        for k, v in headers_raw.items():
            if isinstance(k, str) and isinstance(v, str):
                headers[k] = v

    base_url = data.get("base_url")
    base_url_out = base_url if isinstance(base_url, str) and base_url.strip() else None

    service_base_urls: Dict[str, str] = {}
    services = data.get("services")
    if isinstance(services, dict):
        for service_name, svc in services.items():
            if not isinstance(service_name, str) or not isinstance(svc, dict):
                continue
            u = svc.get("base_url")
            if isinstance(u, str) and u.strip():
                service_base_urls[service_name] = u.strip()

    resource_ids: Dict[str, str] = {}
    ids = data.get("test_resource_ids")
    if isinstance(ids, dict):
        for k, v in ids.items():
            if isinstance(k, str) and isinstance(v, (str, int)):
                resource_ids[k] = str(v)

    return SecretsConfig(
        base_url=base_url_out,
        headers=headers,
        service_base_urls=service_base_urls,
        resource_ids=resource_ids,
        auth=auth_raw if isinstance(auth_raw, dict) else {},
        accounts=data.get("accounts") if isinstance(data.get("accounts"), list) else [],
        openapi_auth=data.get("openapi_auth") if isinstance(data.get("openapi_auth"), dict) else {},
    )


def _read_ai_project_rules(workspace_root: Path) -> Tuple[bool, List[str]]:
    """
    Returns (exists_and_has_rules, violations)
    """
    ai_project = workspace_root / "AI_PROJECT.md"
    if not ai_project.exists():
        return False, ["AI_PROJECT.md 缺失（运行 aiws migrate 或 `npx @aipper/aiws init .` 补齐模板）"]

    text = ai_project.read_text(encoding="utf-8", errors="replace")
    violations: List[str] = []

    if "AI_PROJECT_VERSION" not in text:
        violations.append("缺少 AI_PROJECT_VERSION 标记（请用模板版本补齐）")

    begin = "<!-- AI_PROJECT_RULES_BEGIN -->"
    end = "<!-- AI_PROJECT_RULES_END -->"
    if begin not in text or end not in text:
        violations.append("缺少 AI_PROJECT_RULES BEGIN/END 标记（请用模板补齐）")
        return False, violations

    start = text.find(begin) + len(begin)
    finish = text.find(end, start)
    managed = text[start:finish] if finish != -1 else ""
    lines = [ln.strip() for ln in managed.splitlines() if ln.strip()]
    has_custom_rule = False
    for ln in lines:
        if "ws-rule" in ln or "ws:rule" in ln:
            continue
        if "建议写成" in ln:
            continue
        if ln.startswith("<!--") and ln.endswith("-->"):
            continue
        has_custom_rule = True
        break
    if not has_custom_rule:
        violations.append("AI_PROJECT_RULES 段为空或仍是模板内容（请用 /ws-rule 写入项目规则）")

    return len(violations) == 0, violations


def sync_ai_project_rule_rows(csv_path: Path, workspace_root: Path) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """
    Upsert lint results into CSV as RULE-* rows and return (rows, blocked_items_for_report).
    """
    rows = read_csv_rows(csv_path)
    rows = [r for r in rows if not str(r.get("Issue_ID", "") or "").startswith("RULE-")]

    _, violations = _read_ai_project_rules(workspace_root)
    blocked: List[Dict[str, str]] = []
    if violations:
        for idx, msg in enumerate(violations, start=1):
            issue_id = f"RULE-{idx:02d}"
            row = {
                "Issue_ID": issue_id,
                "Service": "workspace",
                "Title": f"AI_PROJECT 规则校验失败：{msg}",
                "Method": "DOC",
                "Path": "AI_PROJECT.md",
                "Auth": "",
                "Request_Example": "",
                "Expected_Status": "",
                "Expected_Body_Checks": "",
                "Log_Checks": "",
                "Test_Status": "BLOCKED",
                "Review_Status": "",
                "Notes": f"rule_violation=AI_PROJECT {msg}",
            }
            rows.append(row)
            blocked.append(
                {
                    "issue_id": issue_id,
                    "service": row["Service"],
                    "method": row["Method"],
                    "path": row["Path"],
                    "expected_status": "",
                    "notes": row["Notes"],
                }
            )

    write_csv_rows(csv_path, rows)
    return rows, blocked


def candidate_openapi_paths(cfg: WorkspaceConfig) -> List[str]:
    paths = [
        cfg.openapi_url or "",
        "/openapi.json",
        "/openapi.yaml",
        "/v3/api-docs",
        "/v3/api-docs.yaml",
        "/swagger.json",
        "/swagger.yaml",
        "/swagger/v1/swagger.json",
        "/swagger/v1/swagger.yaml",
        "/api-docs",
        "/api-docs.yaml",
    ]
    seen = set()
    deduped: List[str] = []
    for p in paths:
        if not p:
            continue
        if not p.startswith("/"):
            p = "/" + p
        if p in seen:
            continue
        seen.add(p)
        deduped.append(p)
    return deduped


def effective_base_url(
    *,
    cli_base_url: str,
    secrets: SecretsConfig,
    ws: WorkspaceConfig,
    service_name: str,
) -> str:
    if cli_base_url.strip():
        return cli_base_url.strip()
    if service_name in secrets.service_base_urls:
        return secrets.service_base_urls[service_name]
    if secrets.base_url:
        return secrets.base_url
    return workspace.base_url


def assert_base_url_allowed(base_url: str, allowlist: Tuple[str, ...]) -> None:
    # Keep it strict-by-default to avoid accidentally testing prod.
    # Policy: match scheme + hostname; allow any port unless allowlist entry specifies one.
    from urllib.parse import urlparse

    u = base_url.strip()
    if not u:
        raise ValueError("empty base_url")
    parsed = urlparse(u)
    if not parsed.scheme or not parsed.hostname:
        raise ValueError(f"invalid base_url: {u}")

    for item in allowlist:
        raw = (item or "").strip()
        if not raw:
            continue
        if "://" not in raw:
            # Host-only allowlist entry.
            if parsed.hostname == raw:
                return
            continue
        allow = urlparse(raw)
        if not allow.scheme or not allow.hostname:
            continue
        if allow.scheme != parsed.scheme:
            continue
        if allow.hostname != parsed.hostname:
            continue
        if allow.port is not None and parsed.port != allow.port:
            continue
        return
    raise RuntimeError(f"base_url not allowed by base_url_allowlist: {u}")


def normalize_path_for_test(path: str, op: Dict[str, Any], resource_ids: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
    """
    Replace {param} segments with simple safe defaults so we can hit the endpoint.
    Returns: (normalized_path, substitutions)
    """
    substitutions: Dict[str, str] = {}
    params = op.get("parameters") or []
    param_types: Dict[str, str] = {}
    if isinstance(params, list):
        for p in params:
            if not isinstance(p, dict):
                continue
            if p.get("in") != "path":
                continue
            name = p.get("name")
            if not isinstance(name, str) or not name:
                continue
            schema = p.get("schema") or {}
            t = schema.get("type") if isinstance(schema, dict) else None
            param_types[name] = t if isinstance(t, str) else "string"

    def default_for_type(t: str) -> str:
        if t in ("integer", "number"):
            return "1"
        if t == "boolean":
            return "true"
        return "test"

    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        t = param_types.get(name, "string")
        value = resource_ids.get(name) or default_for_type(t)
        substitutions[name] = value
        return value

    normalized = re.sub(r"\{([^}]+)\}", repl, path)
    return normalized, substitutions


def default_value_for_schema_type(t: str) -> str:
    if t in ("integer", "number"):
        return "1"
    if t == "boolean":
        return "true"
    return "test"


def resolve_schema_ref(schema: Dict[str, Any], base_doc: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Resolve a local $ref within the OpenAPI document to avoid missing fields.
    """
    if not isinstance(schema, dict):
        return schema
    ref = schema.get("$ref")
    if not isinstance(ref, str):
        return schema
    doc = base_doc or OPENAPI_DOC
    if ref.startswith("#/") and isinstance(doc, dict):
        cur: Any = doc
        for part in ref.lstrip("#/").split("/"):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                cur = None
                break
        if isinstance(cur, dict):
            return cur
    if jsonref is not None:
        try:
            resolved = jsonref.replace_refs(schema, base_uri="")  # type: ignore[arg-type]
            if isinstance(resolved, dict):
                return resolved
        except Exception:
            pass
    return schema


def build_query_params(op: Dict[str, Any], resource_ids: Dict[str, str]) -> Dict[str, str]:
    """
    Construct query params for a request using OpenAPI parameter metadata.
    Prefer resource_ids overrides; otherwise fall back to safe defaults for required params.
    """
    params = {}
    for p in op.get("parameters") or []:
        if not isinstance(p, dict):
            continue
        if p.get("in") != "query":
            continue
        name = p.get("name")
        if not isinstance(name, str) or not name:
            continue
        schema = p.get("schema") or {}
        t = schema.get("type") if isinstance(schema, dict) else None
        required = bool(p.get("required"))
        # Use provided resource_ids first; otherwise only populate required params.
        if name in resource_ids:
            params[name] = str(resource_ids[name])
        elif required:
            params[name] = default_value_for_schema_type(t if isinstance(t, str) else "string")
    return params


def render_cmd(template: str, *, service_dir: Path, service_name: str) -> str:
    return template.replace("{service_dir}", service_dir.as_posix()).replace("{service}", service_name)


def resolve_log_file(log_path: str, *, workspace_root: Path, service_name: str) -> Path:
    """
    Resolve log file path with optional {service} placeholder; defaults to per-service log under .aiws/tmp/server-test.
    """
    path_str = (log_path or "").strip() or ".aiws/tmp/server-test/{service}.log"
    path_str = path_str.replace("{service}", service_name)
    return (workspace_root / path_str).resolve()


def run_shell(cmd: str, *, cwd: Path) -> None:
    subprocess.run(["bash", "-lc", cmd], cwd=cwd, check=True)


def start_service(cmd: str, *, cwd: Path, log_file: Path) -> subprocess.Popen[bytes]:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    f = log_file.open("ab")
    return subprocess.Popen(
        ["bash", "-lc", cmd],
        cwd=cwd,
        stdout=f,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


def stop_service(proc: subprocess.Popen[bytes], timeout_s: int = 10) -> None:
    if proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except Exception:
        proc.terminate()
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if proc.poll() is not None:
            return
        time.sleep(0.2)
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except Exception:
        proc.kill()


def discover_server_dirs(workspace_root: Path, configured: Tuple[str, ...]) -> List[Path]:
    candidates: List[Path] = []
    if configured:
        for rel in configured:
            p = (workspace_root / rel).resolve()
            if p.is_dir():
                candidates.append(p)
        return candidates

    markers = ("Cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts")
    for entry in workspace_root.iterdir():
        if not entry.is_dir():
            continue
        if entry.name.startswith("."):
            continue
        for marker in markers:
            if (entry / marker).exists():
                candidates.append(entry.resolve())
                break

    return sorted(candidates)


def wait_for_health(base_url: str, health_path: str, headers: Dict[str, str], timeout_s: int) -> None:
    url = base_url.rstrip("/") + "/" + health_path.lstrip("/")
    deadline = time.time() + timeout_s
    last_error: Optional[str] = None
    while time.time() < deadline:
        try:
            resp = requests.get(url, headers=headers, timeout=5)
            if 200 <= resp.status_code < 500:
                return
            last_error = f"unexpected status {resp.status_code}"
        except Exception as e:  # noqa: BLE001
            last_error = str(e)
        time.sleep(1.0)
    raise RuntimeError(f"health check timeout: {url} ({last_error})")


def load_openapi(openapi_file: Path) -> Dict[str, Any]:
    data = json.loads(openapi_file.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("openapi is not a JSON object")
    # Resolve $ref to avoid missing fields in generated payloads.
    if jsonref is not None:
        try:
            data = jsonref.replace_refs(data)
        except Exception:
            pass
    return data


def export_openapi(base_url: str, openapi_url: str, headers: Dict[str, str], dest: Path) -> None:
    url = base_url.rstrip("/") + "/" + openapi_url.lstrip("/")
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(resp.text, encoding="utf-8")


def iter_openapi_endpoints(openapi: Dict[str, Any]) -> Iterable[Tuple[str, str, Dict[str, Any]]]:
    paths = openapi.get("paths") or {}
    if not isinstance(paths, dict):
        return []
    for path, methods in paths.items():
        if not isinstance(path, str) or not isinstance(methods, dict):
            continue
        for method, op in methods.items():
            if not isinstance(method, str) or not isinstance(op, dict):
                continue
            lower = method.lower()
            if lower not in ("get", "post", "put", "patch", "delete", "head", "options"):
                continue
            yield lower.upper(), path, op


def infer_expected_status(op: Dict[str, Any]) -> str:
    responses = op.get("responses") or {}
    if not isinstance(responses, dict):
        return ""
    candidates: List[int] = []
    for k in responses.keys():
        if not isinstance(k, str):
            continue
        if k.isdigit():
            code = int(k)
            if 200 <= code < 300:
                candidates.append(code)
    if not candidates:
        return ""
    return str(sorted(candidates)[0])


def ensure_csv(csv_path: Path) -> None:
    if csv_path.exists():
        return
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()


def read_csv_rows(csv_path: Path) -> List[Dict[str, str]]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, str]] = []
        for row in reader:
            rows.append({k: (v or "") for k, v in row.items()})
        return rows


def write_csv_rows(csv_path: Path, rows: List[Dict[str, str]]) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            out = {k: row.get(k, "") for k in CSV_COLUMNS}
            writer.writerow(out)


def read_fix_csv_rows(csv_path: Path) -> List[Dict[str, str]]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, str]] = []
        for row in reader:
            rows.append({k: (v or "") for k, v in row.items()})
        return rows


def write_fix_csv_rows(csv_path: Path, rows: List[Dict[str, str]]) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIX_CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            out = {k: row.get(k, "") for k in FIX_CSV_COLUMNS}
            writer.writerow(out)


def parse_notes_kv(notes: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for piece in (notes or "").strip().split():
        if "=" not in piece:
            continue
        k, v = piece.split("=", 1)
        k = k.strip()
        v = v.strip()
        if k and v:
            out[k] = v
    return out


def derive_evidence_from_notes(notes: str) -> str:
    kv = parse_notes_kv(notes)
    keys = ("status", "expected", "resp", "log_snippet", "log", "request_id", "error")
    parts: List[str] = []
    for k in keys:
        if k in kv:
            parts.append(f"{k}={kv[k]}")
    return " ".join(parts).strip()


def _safe_read_text_under_workspace(workspace_root: Path, rel_path: str, max_chars: int = 20000) -> str:
    raw = (rel_path or "").strip()
    if not raw:
        return ""
    target = (workspace_root / raw).resolve()
    try:
        if not target.is_relative_to(workspace_root):
            return ""
    except AttributeError:
        if str(target).startswith(str(workspace_root)) is False:
            return ""
    if not target.exists() or not target.is_file():
        return ""
    return target.read_text(encoding="utf-8", errors="replace")[:max_chars]


def classify_failure(*, notes: str, workspace_root: Path) -> Tuple[str, str, str, bool]:
    """
    Returns: (category, analysis_zh, suggestion_zh, needs_human)
    Keep it deterministic and evidence-based; do not leak secrets.
    """
    kv = parse_notes_kv(notes)
    status_raw = kv.get("status", "").strip()
    error_raw = kv.get("error", "").strip()
    expected_raw = kv.get("expected", "").strip()
    log_snippet_rel = kv.get("log_snippet", "").strip()
    snippet = _safe_read_text_under_workspace(workspace_root, log_snippet_rel) if log_snippet_rel else ""

    def has(pat: str) -> bool:
        return bool(re.search(pat, snippet, flags=re.IGNORECASE | re.MULTILINE))

    status_code: Optional[int] = None
    if status_raw.isdigit():
        try:
            status_code = int(status_raw)
        except ValueError:
            status_code = None

    notes_compact = (notes or "").lower()

    if "rule_violation" in notes_compact:
        return (
            "RULE_VIOLATION",
            "AI_PROJECT.md 校验未通过（规则段缺失/未填充）。",
            "运行 /ws-rule 补齐 AI_PROJECT_RULES 段（保证 BEGIN/END 标记存在且包含项目规则），再复测。",
            False,
        )

    if "no_request_id_in_log" in notes_compact:
        return (
            "NO_REQUEST_ID_LOG",
            "日志中未能按 request_id 命中对应请求，无法可靠定位根因。",
            "请在服务端日志中打印 request_id=<id> 并确保响应回传 X-Request-Id；然后复测以生成可用证据。",
            True,
        )

    if "expected_mismatch" in notes_compact:
        return (
            "EXPECTED_MISMATCH",
            f"返回状态码与期望不一致（status={status_raw or '?'} expected={expected_raw or '?'}）。",
            "先对齐 REQUIREMENTS.md/Expected_Status；若期望正确则修复服务端返回码后复测。",
            True,
        )

    if status_code in (401, 403) or "unauthorized" in notes_compact or has(r"\bjwt\b.*\bexpired\b") or has(r"\btoken\b.*\bexpired\b"):
        return (
            "AUTH",
            "鉴权失败（可能是 token 过期/权限不足）。",
            "刷新/更新鉴权 token（不要提交 secrets），并确认该接口在 REQUIREMENTS.md 中是否要求鉴权；复测验证。",
            False,
        )

    if error_raw.lower() in ("readtimeout", "timeout") or "timeout" in notes_compact or status_code in (408, 504):
        return (
            "TIMEOUT",
            "请求超时或网关超时，服务在当前压力/延迟下无法按时响应。",
            "降低请求速率（max_requests_per_minute）、增加服务端资源或超时阈值，并优先复测单接口定位瓶颈。",
            True,
        )

    if error_raw.lower() in ("connectionerror", "connectionrefusederror") or "connection refused" in notes_compact:
        return (
            "CONNECTION",
            "连接失败（服务未就绪/端口不可达）。",
            "检查服务是否成功启动且 health 通过；必要时用 --manage-service 让 runner 管理启动并复测。",
            True,
        )

    if status_code == 500 or "status=500" in notes_compact:
        if has(r"hikaripool|jdbc|could not get jdbc connection|too many connections|connection is not available"):
            return (
                "DB_POOL",
                "疑似数据库连接池耗尽或连接获取超时（并发/连接池配置不足）。",
                "增大连接池（如 maximum-pool-size）或降低并发/请求速率；必要时增加重试并观察 request_id 对应日志。",
                True,
            )
        return (
            "SERVER_500",
            "服务端 500（需结合日志定位具体异常）。",
            "优先查看 log_snippet 中的异常堆栈；若是压力相关，降低请求速率或增加重试；修复后复测。",
            True,
        )

    if status_code is not None and not (200 <= status_code < 400):
        return (
            "NON_2XX_3XX",
            f"返回非 2xx/3xx（status={status_code}）。",
            "确认该返回是否符合 REQUIREMENTS.md；若不符合则修复服务端或调整期望后复测。",
            True,
        )

    return (
        "UNKNOWN",
        "证据不足，无法自动归因（建议补充日志或缩小复测范围）。",
        "先确保 request_id 日志串联可用；然后只复测单个 service/endpoint 以收集稳定证据，再人工补充修复清单。",
        True,
    )


def read_triage_csv_rows(csv_path: Path) -> List[Dict[str, str]]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, str]] = []
        for row in reader:
            rows.append({k: (v or "") for k, v in row.items()})
        return rows


def write_triage_csv_rows(csv_path: Path, rows: List[Dict[str, str]]) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRIAGE_CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            out = {k: row.get(k, "") for k in TRIAGE_CSV_COLUMNS}
            writer.writerow(out)


def write_triage_issues_csv(
    *,
    triage_csv_path: Path,
    fix_rows: List[Dict[str, str]],
    generated_at: str,
) -> None:
    existing = read_triage_csv_rows(triage_csv_path)
    existing_by_fix_id: Dict[str, Dict[str, str]] = {}
    used_ids: set[str] = set()
    next_num = 1
    for r in existing:
        triage_id = (r.get("Triage_ID", "") or "").strip()
        if triage_id:
            used_ids.add(triage_id)
            m = re.match(r"^TRIAGE-(\d+)$", triage_id)
            if m:
                try:
                    next_num = max(next_num, int(m.group(1)) + 1)
                except ValueError:
                    pass
        fix_id = (r.get("Fix_Issue_ID", "") or "").strip()
        if fix_id:
            existing_by_fix_id[fix_id] = r

    out_rows: List[Dict[str, str]] = []
    active_fix_ids: set[str] = set()

    for fr in fix_rows:
        if ((fr.get("Status", "") or "").strip().upper()) == "DONE":
            continue
        needs_human = ((fr.get("Failure_Category", "") or "").strip().upper() in ("UNKNOWN", "EXPECTED_MISMATCH", "NO_REQUEST_ID_LOG")) or not (
            (fr.get("Failure_Analysis", "") or "").strip() and (fr.get("Suggestion", "") or "").strip()
        )
        if not needs_human:
            continue

        fix_id = (fr.get("Issue_ID", "") or "").strip()
        if not fix_id:
            continue
        active_fix_ids.add(fix_id)
        prev = existing_by_fix_id.get(fix_id)

        triage_id = (prev.get("Triage_ID", "") if prev else "").strip()
        if not triage_id:
            while True:
                candidate = f"TRIAGE-{next_num:03d}"
                next_num += 1
                if candidate not in used_ids:
                    triage_id = candidate
                    break
        created_at = (prev.get("Created_At", "") if prev else "").strip() or generated_at
        prev_notes = (prev.get("Notes", "") if prev else "").strip()
        notes = (fr.get("Notes", "") or "").strip()
        merged_notes = append_note(prev_notes, notes) if notes else prev_notes

        out_rows.append(
            {
                "Triage_ID": triage_id,
                "Fix_Issue_ID": fix_id,
                "Source_Issue_ID": (fr.get("Source_Issue_ID", "") or "").strip(),
                "Service": (fr.get("Service", "") or "").strip(),
                "Method": (fr.get("Method", "") or "").strip(),
                "Path": (fr.get("Path", "") or "").strip(),
                "Failure_Category": (fr.get("Failure_Category", "") or "").strip(),
                "Evidence": (fr.get("Evidence", "") or "").strip(),
                "Failure_Analysis": (fr.get("Failure_Analysis", "") or "").strip(),
                "Suggestion": (fr.get("Suggestion", "") or "").strip(),
                "Notes": merged_notes,
                "Created_At": created_at,
                "Updated_At": generated_at,
            }
        )
        used_ids.add(triage_id)

    for r in existing:
        fix_id = (r.get("Fix_Issue_ID", "") or "").strip()
        if not fix_id or fix_id in active_fix_ids:
            continue
        out_rows.append(
            {
                "Triage_ID": (r.get("Triage_ID", "") or "").strip(),
                "Fix_Issue_ID": fix_id,
                "Source_Issue_ID": (r.get("Source_Issue_ID", "") or "").strip(),
                "Service": (r.get("Service", "") or "").strip(),
                "Method": (r.get("Method", "") or "").strip(),
                "Path": (r.get("Path", "") or "").strip(),
                "Failure_Category": (r.get("Failure_Category", "") or "").strip(),
                "Evidence": (r.get("Evidence", "") or "").strip(),
                "Failure_Analysis": (r.get("Failure_Analysis", "") or "").strip(),
                "Suggestion": (r.get("Suggestion", "") or "").strip(),
                "Notes": (r.get("Notes", "") or "").strip(),
                "Created_At": (r.get("Created_At", "") or "").strip() or generated_at,
                "Updated_At": (r.get("Updated_At", "") or "").strip(),
            }
        )

    write_triage_csv_rows(triage_csv_path, out_rows)


def write_fix_issues_csv(
    *,
    fix_csv_path: Path,
    endpoint_rows: List[Dict[str, str]],
    blocked_items: List[Dict[str, Any]],
    generated_at: str,
    workspace_root: Path,
) -> None:
    rows_by_key: Dict[Tuple[str, str, str], Dict[str, str]] = {}
    for r in endpoint_rows:
        rows_by_key[(r.get("Service", ""), r.get("Method", ""), r.get("Path", ""))] = r

    existing = read_fix_csv_rows(fix_csv_path)
    existing_by_source: Dict[str, Dict[str, str]] = {}
    existing_by_key: Dict[Tuple[str, str, str], Dict[str, str]] = {}
    used_issue_ids: set[str] = set()
    next_num = 1
    for r in existing:
        issue_id = (r.get("Issue_ID", "") or "").strip()
        if issue_id:
            used_issue_ids.add(issue_id)
            m = re.match(r"^FIX-(\d+)$", issue_id)
            if m:
                try:
                    next_num = max(next_num, int(m.group(1)) + 1)
                except ValueError:
                    pass
        source_id = (r.get("Source_Issue_ID", "") or "").strip()
        if source_id:
            existing_by_source[source_id] = r
        k = (r.get("Service", ""), r.get("Method", ""), r.get("Path", ""))
        existing_by_key[k] = r

    current_blocked_keys: set[Tuple[str, str, str]] = set()
    out_rows: List[Dict[str, str]] = []

    for item in blocked_items:
        service = str(item.get("service") or "")
        method = str(item.get("method") or "")
        path = str(item.get("path") or "")
        source_id = str(item.get("issue_id") or "").strip()
        key = (service, method, path)
        current_blocked_keys.add(key)

        endpoint = rows_by_key.get(key, {})
        title = (endpoint.get("Title", "") or "").strip() or f"{method} {path}".strip()
        notes = str(item.get("notes") or endpoint.get("Notes", "") or "").strip()
        evidence = derive_evidence_from_notes(notes)
        category, analysis, suggestion, _needs_human = classify_failure(notes=notes, workspace_root=workspace_root)

        prev = existing_by_source.get(source_id) if source_id else None
        if prev is None:
            prev = existing_by_key.get(key)

        issue_id = ""
        if prev is not None:
            issue_id = (prev.get("Issue_ID", "") or "").strip()
        if not issue_id:
            candidate = f"FIX-{source_id}" if source_id else ""
            if candidate and candidate not in used_issue_ids:
                issue_id = candidate
            else:
                while True:
                    candidate = f"FIX-{next_num:03d}"
                    next_num += 1
                    if candidate not in used_issue_ids:
                        issue_id = candidate
                        break

        created_at = (prev.get("Created_At", "") if prev else "").strip() or generated_at
        prev_notes = (prev.get("Notes", "") if prev else "").strip()
        merged_notes = prev_notes
        if notes:
            merged_notes = append_note(prev_notes, notes)

        prev_category = (prev.get("Failure_Category", "") if prev else "").strip()
        prev_analysis = (prev.get("Failure_Analysis", "") if prev else "").strip()
        prev_suggestion = (prev.get("Suggestion", "") if prev else "").strip()

        out_rows.append(
            {
                "Issue_ID": issue_id,
                "Source_Issue_ID": source_id,
                "Service": service,
                "Title": title,
                "Method": method,
                "Path": path,
                "Status": "TODO",
                "Evidence": evidence,
                "Failure_Category": prev_category or category,
                "Failure_Analysis": prev_analysis or analysis,
                "Suggestion": prev_suggestion or suggestion,
                "Notes": merged_notes,
                "Created_At": created_at,
                "Updated_At": generated_at,
            }
        )
        used_issue_ids.add(issue_id)

    for r in existing:
        k = (r.get("Service", ""), r.get("Method", ""), r.get("Path", ""))
        if k in current_blocked_keys:
            continue
        endpoint = rows_by_key.get(k)
        st = ((endpoint or {}).get("Test_Status", "") or "").strip().upper()
        status = (r.get("Status", "") or "").strip().upper() or "TODO"
        if st in ("DONE", "SKIP"):
            status = "DONE"
        out_rows.append(
            {
                "Issue_ID": (r.get("Issue_ID", "") or "").strip(),
                "Source_Issue_ID": (r.get("Source_Issue_ID", "") or "").strip(),
                "Service": (r.get("Service", "") or "").strip(),
                "Title": (r.get("Title", "") or "").strip(),
                "Method": (r.get("Method", "") or "").strip(),
                "Path": (r.get("Path", "") or "").strip(),
                "Status": status,
                "Evidence": (r.get("Evidence", "") or "").strip(),
                "Failure_Category": (r.get("Failure_Category", "") or "").strip(),
                "Failure_Analysis": (r.get("Failure_Analysis", "") or "").strip(),
                "Suggestion": (r.get("Suggestion", "") or "").strip(),
                "Notes": (r.get("Notes", "") or "").strip(),
                "Created_At": (r.get("Created_At", "") or "").strip() or generated_at,
                "Updated_At": generated_at if status == "DONE" and (r.get("Updated_At", "") or "").strip() != generated_at else (r.get("Updated_At", "") or "").strip(),
            }
        )

    write_fix_csv_rows(fix_csv_path, out_rows)
    triage_csv_path = (workspace_root / ".aiws" / "issues" / "server-triage-issues.csv").resolve()
    write_triage_issues_csv(triage_csv_path=triage_csv_path, fix_rows=out_rows, generated_at=generated_at)


def _safe_curl_example(
    base_url: str,
    method: str,
    path: str,
    request_id_header: str,
    auth_headers: Dict[str, str],
) -> str:
    url = base_url.rstrip("/") + "/" + path.lstrip("/")
    parts = ["curl", "-sS", "-i", "-X", method, repr(url)]
    parts += ["-H", repr(f"{request_id_header}: <generated>")]
    for k in auth_headers.keys():
        parts += ["-H", repr(f"{k}: <redacted>")]
    return " ".join(parts)


def upsert_endpoints_into_csv(
    csv_path: Path,
    service_name: str,
    base_url: str,
    request_id_header: str,
    auth_headers: Dict[str, str],
    endpoints: Iterable[Tuple[str, str, Dict[str, Any]]],
    allow_mutations: bool,
) -> None:
    ensure_csv(csv_path)
    rows = read_csv_rows(csv_path)

    existing = {(r.get("Service", ""), r.get("Method", ""), r.get("Path", "")) for r in rows}
    next_id = 1
    for r in rows:
        try:
            next_id = max(next_id, int(r.get("Issue_ID", "0") or "0") + 1)
        except ValueError:
            continue

    for method, path, op in endpoints:
        if not allow_mutations and method in ("POST", "PUT", "PATCH", "DELETE"):
            continue
        key = (service_name, method, path)
        if key in existing:
            continue
        title = op.get("summary") or op.get("operationId") or f"{method} {path}"
        if not isinstance(title, str):
            title = f"{method} {path}"
        expected_status = infer_expected_status(op)
        rows.append(
            {
                "Issue_ID": str(next_id),
                "Service": service_name,
                "Title": title,
                "Method": method,
                "Path": path,
                "Auth": "header",
                "Request_Example": _safe_curl_example(base_url, method, path, request_id_header, auth_headers),
                "Expected_Status": expected_status,
                "Expected_Body_Checks": "",
                "Log_Checks": "no ERROR/Exception; correlate by request_id",
                "Test_Status": "TODO",
                "Review_Status": "PENDING",
                "Notes": "",
            }
        )
        next_id += 1

    write_csv_rows(csv_path, rows)


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return s[:80] if s else "endpoint"


def grep_log_by_request_id(log_file: Path, request_id: str, max_lines: int = 80) -> str:
    if not log_file.exists():
        return ""
    lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
    matches = [ln for ln in lines if request_id in ln]
    if not matches:
        return ""
    return "\n".join(matches[-max_lines:])


def tail_log(log_file: Path, max_lines: int = 200) -> str:
    if not log_file.exists():
        return ""
    lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-max_lines:])


def write_text_if_changed(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        if path.exists() and path.read_text(encoding="utf-8", errors="replace") == content:
            return
    except Exception:
        pass
    path.write_text(content, encoding="utf-8", errors="replace")


def append_note(existing: str, piece: str) -> str:
    e = (existing or "").strip()
    p = (piece or "").strip()
    if not p:
        return e
    if not e:
        return p
    if p in e:
        return e
    return f"{e} {p}".strip()


def json_from_schema(schema: Dict[str, Any], depth: int = 0, base_doc: Optional[Dict[str, Any]] = None) -> Any:
    """
    Generate a sample payload from JSON schema with a bias toward required fields and examples/defaults.
    Goal: avoid missing fields that cause 500/400 when runner auto-generates bodies.
    """
    if depth > 4:
        return None

    schema = resolve_schema_ref(schema, base_doc=base_doc) if isinstance(schema, dict) else schema

    # Respect example/default/enum early.
    if isinstance(schema.get("example"), (str, int, float, bool, dict, list)):
        return schema["example"]
    if isinstance(schema.get("default"), (str, int, float, bool, dict, list)):
        return schema["default"]
    if isinstance(schema.get("enum"), list) and schema["enum"]:
        return schema["enum"][0]

    # oneOf/anyOf/allOf
    if "oneOf" in schema and isinstance(schema["oneOf"], list) and schema["oneOf"]:
        s0 = schema["oneOf"][0]
        return json_from_schema(s0, depth + 1, base_doc=base_doc) if isinstance(s0, dict) else None
    if "anyOf" in schema and isinstance(schema["anyOf"], list) and schema["anyOf"]:
        s0 = schema["anyOf"][0]
        return json_from_schema(s0, depth + 1, base_doc=base_doc) if isinstance(s0, dict) else None
    if "allOf" in schema and isinstance(schema["allOf"], list) and schema["allOf"]:
        merged: Dict[str, Any] = {}
        for s in schema["allOf"]:
            if isinstance(s, dict):
                merged.update(s)
        return json_from_schema(merged, depth + 1, base_doc=base_doc)

    t = schema.get("type")
    if t == "object" or ("properties" in schema):
        props = schema.get("properties") if isinstance(schema.get("properties"), dict) else {}
        required = schema.get("required") if isinstance(schema.get("required"), list) else []
        out: Dict[str, Any] = {}
        # Fill required first.
        for k in required:
            if isinstance(k, str) and k in props and isinstance(props[k], dict):
                out[k] = json_from_schema(props[k], depth + 1, base_doc=base_doc)
        # Fill remaining optional fields (best-effort, capped to avoid huge payloads).
        optional_added = 0
        for k, v in props.items():
            if k in out:
                continue
            if not isinstance(k, str) or not isinstance(v, dict):
                continue
            out[k] = json_from_schema(v, depth + 1, base_doc=base_doc)
            optional_added += 1
            if optional_added >= 10:
                break
        return out

    if t == "array":
        items = schema.get("items")
        if isinstance(items, dict):
            return [json_from_schema(items, depth + 1, base_doc=base_doc)]
        return []

    if t == "integer" or t == "number":
        return 1
    if t == "boolean":
        return True

    # string handling with simple format-aware samples
    if t == "string" or not t:
        fmt = schema.get("format") if isinstance(schema.get("format"), str) else ""
        fmt = fmt.lower()
        if fmt == "date":
            return "2024-01-01"
        if fmt in ("date-time", "datetime"):
            return "2024-01-01T00:00:00Z"
        if fmt == "email":
            return "user@example.com"
        if fmt in ("phone", "phone-number", "tel"):
            return "13800000000"
        if fmt in ("uuid", "guid"):
            return "00000000-0000-0000-0000-000000000000"
        if fmt in ("uri", "url"):
            return "https://example.com"
        return "test"

    return "test"


def infer_json_body(op: Dict[str, Any]) -> Optional[Any]:
    rb = op.get("requestBody") or {}
    if not isinstance(rb, dict):
        return None
    content = rb.get("content") or {}
    if not isinstance(content, dict):
        return None
    json_ct = None
    for ct in content.keys():
        if isinstance(ct, str) and ct.lower().startswith("application/json"):
            json_ct = ct
            break
    if not json_ct:
        return None
    part = content.get(json_ct)
    if not isinstance(part, dict):
        return {}
    schema = part.get("schema")
    if not isinstance(schema, dict):
        return {}
    base_doc = op.get("_openapi_doc") if isinstance(op, dict) else None
    schema = resolve_schema_ref(schema, base_doc=base_doc)
    return json_from_schema(schema, base_doc=base_doc or OPENAPI_DOC)


def run_endpoint_request(
    base_url: str,
    method: str,
    path: str,
    op: Optional[Dict[str, Any]],
    headers: Dict[str, str],
    request_id_header: str,
    out_dir: Path,
    resource_ids: Dict[str, str],
    response_max_bytes: int,
    request_timeout_s: int,
) -> Tuple[int, str, str]:
    request_id = str(uuid.uuid4())
    normalized_path, substitutions = normalize_path_for_test(path, op or {}, resource_ids=resource_ids)
    url = base_url.rstrip("/") + "/" + normalized_path.lstrip("/")
    query_params = build_query_params(op or {}, resource_ids=resource_ids)
    req_headers = dict(headers)
    req_headers[request_id_header] = request_id

    json_body = infer_json_body(op or {}) if method in ("POST", "PUT", "PATCH") else None
    resp = requests.request(
        method=method,
        url=url,
        headers=req_headers,
        timeout=max(1, int(request_timeout_s)),
        json=json_body,
        params=query_params or None,
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{slugify(method)}-{slugify(path)}.out"
    raw = resp.content if isinstance(resp.content, (bytes, bytearray)) else resp.text.encode("utf-8", errors="replace")
    max_bytes = max(0, int(response_max_bytes))
    truncated_bytes = raw[:max_bytes] if max_bytes else raw
    truncated_text = truncated_bytes.decode("utf-8", errors="replace")
    out_file.write_text(truncated_text, encoding="utf-8", errors="replace")
    if substitutions or json_body is not None:
        # Add a small sidecar note for reproducibility without mutating the CSV schema.
        (out_dir / f"{slugify(method)}-{slugify(path)}.meta.json").write_text(
            json.dumps(
                {
                    "path_substitutions": substitutions,
                    "url": url,
                    "query_params": query_params,
                    "json_body": json_body,
                    "response_truncated": bool(max_bytes and len(raw) > max_bytes),
                    "response_bytes": len(raw),
                    "response_bytes_written": len(truncated_bytes),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    return resp.status_code, out_file.as_posix(), request_id


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Workspace server API test runner (OpenAPI -> CSV -> requests -> log correlation)")
    parser.add_argument("--workspace", default=".", help="workspace root (directory A)")
    parser.add_argument("--service", default="", help="optional: only run one service directory name")
    parser.add_argument("--csv", default=".aiws/issues/server-api-issues.csv", help="execution contract CSV path (relative to workspace)")
    parser.add_argument("--out-dir", default=".aiws/tmp/server-test", help="output dir for responses (relative to workspace)")
    parser.add_argument("--base-url", default="", help="override base_url (otherwise use .aiws/secrets/test-accounts.json or AI_WORKSPACE.md)")
    parser.add_argument("--health-timeout", type=int, default=60, help="seconds to wait for health endpoint")
    parser.add_argument("--no-wait-health", action="store_true", help="skip health check wait")
    parser.add_argument("--refresh-openapi", action="store_true", help="always export OpenAPI from openapi_url into docs/openapi.json")
    parser.add_argument("--manage-service", action="store_true", help="run build/start/stop using AI_WORKSPACE.md build_cmd/start_cmd/stop_cmd")
    parser.add_argument("--max-endpoints", type=int, default=0, help="limit endpoints executed per run (0=unlimited)")
    parser.add_argument("--request-timeout", type=int, default=15, help="per-request timeout seconds")
    parser.add_argument("--max-response-bytes", type=int, default=65536, help="truncate response body written to .out (0=unlimited)")
    parser.add_argument("--max-log-snippet-lines", type=int, default=80, help="max log lines written into *.log.txt")
    parser.add_argument("--max-report-blocked", type=int, default=200, help="max BLOCKED items persisted into report.json")
    args = parser.parse_args(argv)

    workspace_root = Path(args.workspace).resolve()
    ai_workspace_md = workspace_root / "AI_WORKSPACE.md"
    cfg = parse_ai_workspace_md(ai_workspace_md)

    secrets_path = workspace_root / ".aiws" / "secrets" / "test-accounts.json"
    secrets = load_secrets(secrets_path)

    csv_path = (workspace_root / args.csv).resolve()
    out_dir = (workspace_root / args.out_dir).resolve()

    server_dirs = discover_server_dirs(workspace_root, cfg.server_dirs)
    if args.service:
        server_dirs = [p for p in server_dirs if p.name == args.service]

    if not server_dirs:
        print("no server directories found (configure server_dirs in AI_WORKSPACE.md or add marker files)", file=sys.stderr)
        return 2

    ensure_csv(csv_path)
    lint_blocked: List[Dict[str, str]] = []

    procs: Dict[str, subprocess.Popen[bytes]] = {}
    server_dir_by_name: Dict[str, Path] = {p.name: p for p in server_dirs}
    report: Dict[str, Any] = {
        "workspace": workspace_root.as_posix(),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "csv": os.path.relpath(csv_path, workspace_root),
        "out_dir": os.path.relpath(out_dir, workspace_root),
        "services": {},
        "summary": {"DONE": 0, "BLOCKED": 0, "SKIP": 0, "TODO": 0, "DOING": 0},
        "blocked": [],
    }
    min_interval_s = 0.0
    if cfg.max_requests_per_minute > 0:
        min_interval_s = 60.0 / float(cfg.max_requests_per_minute)
    last_request_at = 0.0
    try:
        if args.manage_service and cfg.start_cmd:
            for server_dir in server_dirs:
                service_name = server_dir.name
                if args.service and service_name != args.service:
                    continue
                if cfg.build_cmd:
                    run_shell(render_cmd(cfg.build_cmd, service_dir=server_dir, service_name=service_name), cwd=workspace_root)
                log_file = resolve_log_file(cfg.log_path, workspace_root=workspace_root, service_name=service_name)
                start_cmd = render_cmd(cfg.start_cmd, service_dir=server_dir, service_name=service_name)
                procs[service_name] = start_service(start_cmd, cwd=workspace_root, log_file=log_file)

        openapi_used: Dict[str, str] = {}
        for server_dir in server_dirs:
            service_name = server_dir.name
            base_url = effective_base_url(
                cli_base_url=args.base_url,
                secrets=secrets,
                workspace=cfg,
                service_name=service_name,
            )
            auth_headers = build_auth_headers(base_url=base_url, secrets=secrets, request_id_header=cfg.request_id_header)

            if not args.no_wait_health:
                try:
                    wait_for_health(base_url, cfg.health_path, headers=auth_headers, timeout_s=args.health_timeout)
                except Exception as e:  # noqa: BLE001
                    print(f"[{service_name}] health check failed: {e}", file=sys.stderr)
                    return 3

            openapi_file = (server_dir / cfg.openapi_path).resolve()
            openapi_paths = candidate_openapi_paths(cfg)
            if openapi_file.exists() and not args.refresh_openapi:
                openapi = load_openapi(openapi_file)
                OPENAPI_DOC.clear()
                OPENAPI_DOC.update(openapi)
            else:
                openapi = None
                last_err: Optional[Exception] = None
                for rel_path in openapi_paths:
                    try:
                        openapi_headers = build_openapi_headers(secrets=secrets, request_id_header=cfg.request_id_header)
                        export_openapi(base_url, rel_path, headers=openapi_headers, dest=openapi_file)
                        openapi = load_openapi(openapi_file)
                        OPENAPI_DOC.clear()
                        OPENAPI_DOC.update(openapi)
                        openapi_used[service_name] = rel_path
                        break
                    except Exception as e:  # noqa: BLE001
                        last_err = e
                        continue
                if openapi is None:
                    print(f"[{service_name}] openapi unavailable (tried: {', '.join(openapi_paths)}): {last_err}", file=sys.stderr)
                    continue

            endpoints = list(iter_openapi_endpoints(openapi))
            upsert_endpoints_into_csv(
                csv_path=csv_path,
                service_name=service_name,
                base_url=base_url,
                request_id_header=cfg.request_id_header,
                auth_headers=auth_headers,
                endpoints=endpoints,
                allow_mutations=cfg.allow_mutations,
            )

        rows, lint_blocked = sync_ai_project_rule_rows(csv_path, workspace_root)
        updated_rows: List[Dict[str, str]] = []
        op_lookup: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        for server_dir in server_dirs:
            service_name = server_dir.name
            openapi_file = (server_dir / cfg.openapi_path).resolve()
            if not openapi_file.exists():
                continue
            try:
                openapi = load_openapi(openapi_file)
                OPENAPI_DOC.clear()
                OPENAPI_DOC.update(openapi)
            except Exception:
                continue
            for method, path, op in iter_openapi_endpoints(openapi):
                if isinstance(op, dict):
                    op["_openapi_doc"] = openapi
                op_lookup[(service_name, method, path)] = op

        executed = 0
        for idx, row in enumerate(rows):
            issue_id_raw = (row.get("Issue_ID", "") or "").strip()
            if issue_id_raw.startswith("RULE-"):
                updated_rows.append(row)
                continue
            service = row.get("Service", "")
            if args.service and service != args.service:
                updated_rows.append(row)
                continue
            status = (row.get("Test_Status", "") or "").strip().upper()
            if status not in ("TODO", "BLOCKED"):
                updated_rows.append(row)
                continue
            if args.max_endpoints and executed >= max(0, int(args.max_endpoints)):
                updated_rows.append(row)
                updated_rows.extend(rows[idx + 1 :])
                break

            method = (row.get("Method", "GET") or "GET").strip().upper()
            path = (row.get("Path", "") or "").strip()
            if not path:
                updated_rows.append(row)
                continue

            if not cfg.allow_mutations and method in ("POST", "PUT", "PATCH", "DELETE"):
                row["Test_Status"] = "SKIP"
                row["Notes"] = (row.get("Notes", "") + " skipped: allow_mutations=false").strip()
                updated_rows.append(row)
                continue

            if cfg.dangerous_disabled:
                tags = op_lookup.get((service, method, path), {}).get("tags") if op_lookup.get((service, method, path)) else None
                tag_list = tags if isinstance(tags, list) else []
                dangerous_tag = any(isinstance(t, str) and t.lower() == "dangerous" for t in tag_list)
                op_obj = op_lookup.get((service, method, path)) or {}
                dangerous_flag = bool(op_obj.get("x-dangerous") is True)
                if method == "DELETE" or dangerous_tag or dangerous_flag:
                    row["Test_Status"] = "SKIP"
                    row["Notes"] = append_note(row.get("Notes", ""), "skipped: dangerous_disabled=true")
                    updated_rows.append(row)
                    continue

            row["Test_Status"] = "DOING"
            write_csv_rows(csv_path, updated_rows + [row] + rows[len(updated_rows) + 1 :])

            base_url_effective = effective_base_url(
                cli_base_url=args.base_url,
                secrets=secrets,
                workspace=cfg,
                service_name=service,
            )
            assert_base_url_allowed(base_url_effective, cfg.base_url_allowlist)
            op = op_lookup.get((service, method, path))

            try:
                if min_interval_s > 0 and last_request_at > 0:
                    elapsed = time.time() - last_request_at
                    if elapsed < min_interval_s:
                        time.sleep(min_interval_s - elapsed)
                code, out_path, request_id = run_endpoint_request(
                    base_url=base_url_effective,
                    method=method,
                    path=path,
                    op=op,
                    headers=auth_headers,
                    request_id_header=cfg.request_id_header,
                    out_dir=out_dir / service,
                    resource_ids=secrets.resource_ids,
                    response_max_bytes=args.max_response_bytes,
                    request_timeout_s=args.request_timeout,
                )
                last_request_at = time.time()
                resp_rel = os.path.relpath(out_path, workspace_root)
                row["Notes"] = append_note(row.get("Notes", ""), f"status={code}")
                row["Notes"] = append_note(row.get("Notes", ""), f"expected={row.get('Expected_Status','').strip() or '<any 2xx/3xx>'}")
                row["Notes"] = append_note(row.get("Notes", ""), f"resp={resp_rel}")
                row["Notes"] = append_note(row.get("Notes", ""), f"request_id={request_id}")

                log_file = resolve_log_file(cfg.log_path, workspace_root=workspace_root, service_name=service)
                log_snippet = grep_log_by_request_id(log_file, request_id=request_id, max_lines=max(1, int(args.max_log_snippet_lines)))
                log_rel = os.path.relpath(log_file, workspace_root) if log_file.exists() else ""
                expected_raw = (row.get("Expected_Status", "") or "").strip()
                expected_code = int(expected_raw) if expected_raw.isdigit() else None
                log_snippet_rel = ""

                if log_snippet and re.search(r"\b(ERROR|Exception|Stacktrace)\b", log_snippet):
                    row["Test_Status"] = "BLOCKED"
                    row["Notes"] = append_note(row.get("Notes", ""), "log_error_by_request_id")
                else:
                    if not log_snippet:
                        fallback = tail_log(log_file, max_lines=200)
                        if fallback and re.search(r"\b(ERROR|Exception|Stacktrace)\b", fallback):
                            row["Test_Status"] = "BLOCKED"
                            row["Notes"] = append_note(row.get("Notes", ""), "log_error_tail_fallback")
                            updated_rows.append(row)
                            continue
                    if expected_code is not None and code != expected_code:
                        row["Test_Status"] = "BLOCKED"
                        row["Notes"] = append_note(row.get("Notes", ""), f"expected_mismatch")
                    else:
                        if expected_code is None and not (200 <= code < 400):
                            row["Test_Status"] = "BLOCKED"
                            row["Notes"] = append_note(row.get("Notes", ""), "non_2xx_3xx")
                        else:
                            row["Test_Status"] = "DONE"

                if not log_snippet:
                    row["Notes"] = append_note(row.get("Notes", ""), "no_request_id_in_log")
                else:
                    # Persist the matched snippet so the agent can triage without re-grepping.
                    snippet_path = (out_dir / service / f"{slugify(method)}-{slugify(path)}.log.txt").resolve()
                    write_text_if_changed(snippet_path, log_snippet + "\n")
                    log_snippet_rel = os.path.relpath(snippet_path, workspace_root)
                    row["Notes"] = append_note(row.get("Notes", ""), f"log={log_rel}")
                    row["Notes"] = append_note(row.get("Notes", ""), f"log_snippet={log_snippet_rel}")
            except Exception as e:  # noqa: BLE001
                row["Test_Status"] = "BLOCKED"
                row["Notes"] = append_note(row.get("Notes", ""), f"error={type(e).__name__}")

            # Update report stats.
            svc = report["services"].setdefault(service, {"DONE": 0, "BLOCKED": 0, "SKIP": 0, "TODO": 0, "DOING": 0})
            st = (row.get("Test_Status", "") or "").strip().upper()
            if st in svc:
                svc[st] += 1
            if st in report["summary"]:
                report["summary"][st] += 1
            if st == "BLOCKED":
                if len(report["blocked"]) < max(0, int(args.max_report_blocked)):
                    report["blocked"].append(
                        {
                            "issue_id": row.get("Issue_ID", ""),
                            "service": service,
                            "method": method,
                            "path": path,
                            "expected_status": row.get("Expected_Status", ""),
                            "notes": row.get("Notes", ""),
                        }
                    )

            updated_rows.append(row)
            executed += 1

        write_csv_rows(csv_path, updated_rows)
        report_path = (out_dir / "report.json").resolve()
        for item in lint_blocked:
            report["summary"]["BLOCKED"] += 1
            report["blocked"].append(item)
        if openapi_used:
            report["openapi_used"] = openapi_used
        write_text_if_changed(report_path, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        fix_csv_path = (workspace_root / ".aiws" / "issues" / "server-fix-issues.csv").resolve()
        write_fix_issues_csv(
            fix_csv_path=fix_csv_path,
            endpoint_rows=updated_rows,
            blocked_items=report.get("blocked") or [],
            generated_at=report["generated_at"],
            workspace_root=workspace_root,
        )
        # Minimal human summary in Chinese (keep short to avoid token spam).
        md_lines = [
            "# API 测试报告（自动生成）",
            "",
            f"- ws: `{report['workspace']}`",
            f"- generated_at: `{report['generated_at']}`",
            f"- csv: `{report['csv']}`",
            f"- out_dir: `{report['out_dir']}`",
            f"- fix_issues: `{os.path.relpath(fix_csv_path, workspace_root)}`",
            "",
            "## 汇总",
            f"- DONE: {report['summary']['DONE']}",
            f"- BLOCKED: {report['summary']['BLOCKED']}",
            f"- SKIP: {report['summary']['SKIP']}",
            "",
            "## BLOCKED（最多展示 20 条）",
        ]
        for item in report["blocked"][:20]:
            md_lines.append(f"- {item.get('service')} {item.get('method')} {item.get('path')} (Issue_ID={item.get('issue_id')})")
        md_lines.append("")
        md_lines.append("提示：可用 `/server-fix` 基于 report.json + CSV 进入自动修复闭环。")
        write_text_if_changed((out_dir / "report.md").resolve(), "\n".join(md_lines) + "\n")

        # Exit code policy for automation:
        # - 0: all ok (no BLOCKED)
        # - 3: has BLOCKED (fix required)
        return 3 if int(report["summary"].get("BLOCKED", 0) or 0) > 0 else 0
    finally:
        if args.manage_service and procs:
            for service_name, proc in procs.items():
                server_dir = server_dir_by_name.get(service_name)
                if cfg.stop_cmd and server_dir is not None:
                    try:
                        run_shell(render_cmd(cfg.stop_cmd, service_dir=server_dir, service_name=service_name), cwd=workspace_root)
                        continue
                    except Exception:
                        pass
                stop_service(proc)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
