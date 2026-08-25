#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


CHANGE_BRANCH_RE = re.compile(r"^(change|changes|ws|ws-change)/([a-z0-9]+(?:-[a-z0-9]+)*)$")
CHANGE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FINISH_DONE_COMPLETED_CLEANUPS = {
    "removed",
    "pruned-missing",
    "skipped:no_separate_change_worktree",
    "skipped:current_worktree",
}


def eprint(msg: str) -> None:
    sys.stderr.write(msg + "\n")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def list_submodules_from_gitmodules(root: Path) -> List[Tuple[str, str]]:
    """Return [(name, sub_path), ...] from .gitmodules, or [] if none."""
    gm = root / ".gitmodules"
    if not gm.exists():
        return []
    try:
        res = subprocess.run(
            ["git", "-C", str(root), "config", "--file", ".gitmodules", "--get-regexp", r"^submodule\..*\.path$"],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except Exception:
        return []
    if res.returncode != 0:
        return []
    subs: List[Tuple[str, str]] = []
    for raw in (res.stdout or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        idx = line.find(" ")
        if idx <= 0:
            continue
        key = line[:idx].strip()
        sub_path = line[idx + 1 :].strip()
        m = re.match(r"^submodule\.(.+)\.path$", key)
        if not m:
            continue
        name = (m.group(1) or "").strip()
        if name and sub_path:
            subs.append((name, sub_path))
    return subs


def parse_submodule_targets(path: Path) -> Tuple[Dict[str, Tuple[str, str]], List[str]]:
    """Parse a submodules.targets file. Returns (parsed_dict, error_messages)."""
    parsed: Dict[str, Tuple[str, str]] = {}
    perr: List[str] = []
    if not path.exists():
        return parsed, perr
    text = read_text(path)
    for i, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = re.split(r"\s+", line)
        if len(parts) < 2:
            perr.append(f"{path.name}:{i} invalid line (expected: <path> <target_branch> [remote])")
            continue
        sub_path = parts[0].strip()
        target_branch = parts[1].strip()
        remote = (parts[2].strip() if len(parts) >= 3 else "origin") or "origin"
        if not sub_path:
            perr.append(f"{path.name}:{i} missing submodule path")
            continue
        if sub_path in parsed:
            perr.append(f"{path.name}:{i} duplicate submodule path: {sub_path}")
            continue
        if not target_branch or target_branch in ("<fill-me>", "<fill_me>", "tbd", "TBD"):
            perr.append(f"{path.name}:{i} missing/placeholder target_branch for {sub_path}")
            continue
        parsed[sub_path] = (target_branch, remote)
    return parsed, perr


def git_text(root: Path, args: List[str]) -> Tuple[int, str, str]:
    try:
        res = subprocess.run(
            ["git", "-C", str(root), *args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return (res.returncode, (res.stdout or "").strip(), (res.stderr or "").strip())
    except Exception as exc:
        return (1, "", str(exc))


def resolve_change_gitlink_commit(root: Path, change_id: str, sub_path: str) -> str:
    for spec in (f"change/{change_id}:{sub_path}", f"HEAD:{sub_path}"):
        code, out, _ = git_text(root, ["rev-parse", spec])
        if code == 0 and out:
            return out
    return ""


def git_ref_exists(root: Path, ref: str) -> bool:
    code, _, _ = git_text(root, ["show-ref", "--verify", "--quiet", ref])
    return code == 0


def git_revision_exists(root: Path, rev: str) -> bool:
    code, _, _ = git_text(root, ["cat-file", "-e", f"{rev}^{{commit}}"])
    return code == 0


def git_is_ancestor(root: Path, older: str, newer: str) -> bool:
    code, _, _ = git_text(root, ["merge-base", "--is-ancestor", older, newer])
    return code == 0


def resolve_branch_ref(repo_root: Path, remote: str, branch: str) -> str:
    remote_ref = f"refs/remotes/{remote}/{branch}"
    if git_ref_exists(repo_root, remote_ref):
        return remote_ref
    local_ref = f"refs/heads/{branch}"
    if git_ref_exists(repo_root, local_ref):
        return local_ref
    return ""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def git_root(cwd: Path) -> Optional[Path]:
    try:
        root = subprocess.check_output(
            ["git", "-C", str(cwd), "rev-parse", "--show-toplevel"],
            text=True,
        ).strip()
        if root:
            return Path(root).resolve()
    except Exception:
        return None
    return None


def current_branch(root: Path) -> Optional[str]:
    try:
        b = subprocess.check_output(
            ["git", "-C", str(root), "symbolic-ref", "--quiet", "--short", "HEAD"],
            text=True,
        ).strip()
        return b or None
    except Exception:
        return None


def infer_change_id_from_branch(branch: Optional[str]) -> Optional[str]:
    if not branch:
        return None
    m = CHANGE_BRANCH_RE.match(branch)
    if not m:
        return None
    return m.group(2)


def parse_archived_change_dir_name(entry_name: str) -> Optional[Tuple[str, str, str]]:
    m = re.match(r"^(\d{4}-\d{2}-\d{2})-(.+?)(?:-(\d{8}-\d{6}Z))?$", entry_name or "")
    if not m:
        return None
    change_id = (m.group(2) or "").strip()
    if not CHANGE_ID_RE.match(change_id):
        return None
    return (m.group(1) or "", change_id, m.group(3) or "")


def find_archived_change(root: Path, change_id: str) -> Optional[Path]:
    archive_root = root / ".aiws" / "changes" / "archive"
    if not archive_root.exists():
        return None
    matches: List[Path] = []
    for entry in archive_root.iterdir():
        if not entry.is_dir():
            continue
        parsed = parse_archived_change_dir_name(entry.name)
        if parsed and parsed[1] == change_id:
            matches.append(entry)
    if not matches:
        return None
    return sorted(matches, key=lambda item: item.name)[-1]


def classify_finish_lifecycle_event(ev: Dict[str, Any]) -> Optional[Tuple[str, str]]:
    event_type = str((ev or {}).get("type") or "").strip()
    if not event_type:
        return None
    if event_type == "finish_local":
        return ("local", "")
    if event_type == "finish_failed":
        return ("failed", str((ev or {}).get("payload", {}).get("error") or ""))
    if event_type == "finish_cleanup_pending":
        payload = (ev or {}).get("payload") or {}
        return ("cleanup_pending", str(payload.get("reason") or payload.get("cleanup") or ""))
    if event_type == "finish":
        return ("done", "")
    if event_type != "finish_done":
        return None
    payload = (ev or {}).get("payload")
    if not isinstance(payload, dict):
        payload = {}
    push_present = "push" in payload
    push_completed = payload.get("push") is True if push_present else None
    cleanup = str(payload.get("cleanup") or "").strip()
    if push_completed is False or cleanup == "not_requested":
        return ("local", "")
    if not cleanup or cleanup in FINISH_DONE_COMPLETED_CLEANUPS:
        return ("done", "")
    reason = cleanup[len("skipped:") :] if cleanup.startswith("skipped:") else cleanup
    return ("cleanup_pending", reason)


def summarize_finish_state(change_dir: Path) -> str:
    metrics_path = change_dir / "metrics.json"
    if not metrics_path.exists():
        return ""
    try:
        metrics = json.loads(read_text(metrics_path))
    except Exception:
        return ""
    events = metrics.get("events")
    if not isinstance(events, list):
        return ""
    finish_state = ""
    for ev in events:
        event_type = str((ev or {}).get("type") or "").strip()
        if not event_type:
            continue
        if finish_state == "done" and event_type not in ("finish_done", "finish"):
            continue
        classified = classify_finish_lifecycle_event(ev)
        if not classified:
            continue
        finish_state = classified[0]
    return finish_state


def terminated_change_message(root: Path, change_id: str) -> Optional[str]:
    change_dir = root / ".aiws" / "changes" / change_id
    if change_dir.exists() and summarize_finish_state(change_dir) == "done":
        return (
            f"change/{change_id} already reached finish, but archive/push closeout is still pending; "
            f"rerun `aiws change finish {change_id} --push` instead of continuing development on this branch"
        )
    archived = find_archived_change(root, change_id)
    if archived:
        handoff = archived / "handoff.md"
        details = f"change/{change_id} is already archived at {archived.relative_to(root)}"
        if handoff.exists():
            details += f" (handoff: {handoff.relative_to(root)})"
        return details + "; create a new follow-up change instead of reusing this branch"
    return None


def has_truth_files(root: Path) -> Tuple[bool, List[str]]:
    required = ["AI_PROJECT.md", "AI_WORKSPACE.md", "REQUIREMENTS.md"]
    missing = [f for f in required if not (root / f).exists()]
    return (len(missing) == 0, missing)


def extract_id(label: str, text: str) -> str:
    m = re.search(rf"(?m)^.*{re.escape(label)}.*?[:=][ \t]*(.*)$", text)
    if not m:
        return ""
    v = m.group(1).strip()
    v = re.sub(r"<!--.*?-->", "", v).strip()
    v = v.strip("`").strip()
    return v


def extract_first_id(labels: List[str], text: str) -> str:
    for label in labels:
        v = extract_id(label, text)
        if v:
            return v
    return ""


def normalize_optional_id(value: str) -> str:
    normalized = (value or "").strip()
    if normalized.upper() in {"N/A", "NA", "NONE", "NULL", "-"}:
        return ""
    return normalized


def split_declared_values(value: str) -> List[str]:
    parts = re.split(r"[,;\n]+", value or "")
    out: List[str] = []
    for part in parts:
        v = part.strip().strip("`").strip()
        if v:
            out.append(v)
    return out


def normalize_contract_ref(raw: str) -> Tuple[str, str]:
    token = raw.strip().strip("`").strip()
    token = re.sub(r"^(\.aiws/requirements/requirements-issues\.(?:csv|jsonl)|\.aiws/issues/problem-issues\.(?:csv|jsonl))\s*[:#]\s*", "", token)
    m = re.match(r"(?i)^(req[_-]?id|problem[_-]?id)\s*=\s*(.+)$", token)
    if m:
        key = m.group(1).lower()
        value = m.group(2).strip()
        if key.startswith("req"):
            return ("Req_ID", value)
        return ("Problem_ID", value)
    if token.upper().startswith("PROB-"):
        return ("Problem_ID", token)
    return ("Any", token)


def normalize_heading_token(raw: str) -> str:
    token = (raw or "").strip().lower()
    token = re.sub(r"<!--.*?-->", "", token)
    token = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", token)
    return token


def find_markdown_section(text: str, aliases: List[str]) -> str:
    lines = text.splitlines()
    alias_tokens: List[str] = []
    for alias in aliases:
        token = normalize_heading_token(alias)
        if token:
            alias_tokens.append(token)
    if not alias_tokens:
        return ""

    start = -1
    start_level = 0
    for i, line in enumerate(lines):
        m = re.match(r"^\s{0,3}(#{2,6})\s+(.+?)\s*$", line)
        if not m:
            continue
        heading_norm = normalize_heading_token(m.group(2))
        if any(alias in heading_norm for alias in alias_tokens):
            start = i + 1
            start_level = len(m.group(1))
            break

    if start < 0:
        return ""

    end = len(lines)
    for j in range(start, len(lines)):
        m = re.match(r"^\s{0,3}(#{1,6})\s+.+$", lines[j])
        if m and len(m.group(1)) <= start_level:
            end = j
            break

    return "\n".join(lines[start:end]).strip()


def has_markdown_heading(text: str, aliases: List[str]) -> bool:
    lines = text.splitlines()
    alias_tokens: List[str] = []
    for alias in aliases:
        token = normalize_heading_token(alias)
        if token:
            alias_tokens.append(token)
    if not alias_tokens:
        return False
    for line in lines:
        m = re.match(r"^\s{0,3}(#{2,6})\s+(.+?)\s*$", line)
        if not m:
            continue
        heading_norm = normalize_heading_token(m.group(2))
        if any(alias in heading_norm for alias in alias_tokens):
            return True
    return False


def extract_action_items(text: str) -> List[str]:
    return [
        m.group(1).strip()
        for m in re.finditer(r"(?m)^\s*(?:- \[[ xX]\]|[-*+]|\d+[.)])\s+(.+)$", text or "")
        if m.group(1).strip()
    ]


def has_runnable_command(text: str) -> bool:
    if not text:
        return False
    if re.search(
        r"(?i)\b(aiws|npx|node|npm|pnpm|yarn|python3?|pytest|bash|git|cargo|go|make|uv|\.\/gradlew)\b",
        text,
    ):
        return True
    if re.search(
        r"(?mi)^\s*(?:aiws|npx|node|npm|pnpm|yarn|python3?|pytest|bash|git|cargo|go|make|uv|\.\/gradlew)\b",
        text,
    ):
        return True
    for inline in re.findall(r"`([^`]+)`", text):
        if re.search(
            r"(?i)\b(aiws|npx|node|npm|pnpm|yarn|python3?|pytest|bash|git|cargo|go|make|uv|\.\/gradlew)\b",
            inline,
        ):
            return True
    return False


def is_concrete_plan_item(item: str) -> bool:
    if re.search(r"`[^`]+`", item):
        return True
    if re.search(r"(?i)\b(aiws|npx|node|npm|pnpm|yarn|python3?|pytest|bash|git|cargo|go|make|uv|\.\/gradlew)\b", item):
        return True
    if re.search(r"\b(?:[A-Za-z0-9._-]+/)+[A-Za-z0-9._/-]+\b", item):
        return True
    return False


def validate_plan_quality(plan_text: str, plan_rel: str, strict: bool) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    required_sections: List[Tuple[str, List[str]]] = [
        ("Bindings", ["bindings", "主索引绑定", "绑定"]),
        ("Goal", ["goal", "目标"]),
        ("Non-goals", ["nongoals", "非目标"]),
        ("Scope", ["scope", "范围", "改动范围"]),
        ("Plan", ["plan", "执行步骤", "实施计划", "步骤"]),
        ("Verify", ["verify", "verification", "验证"]),
        ("Risks & Rollback", ["risksrollback", "riskrollback", "风险与回滚", "回滚"]),
        ("Evidence", ["evidence", "证据"]),
    ]

    section_content: Dict[str, str] = {}
    missing_sections: List[str] = []
    empty_sections: List[str] = []
    for section_name, aliases in required_sections:
        exists = has_markdown_heading(plan_text, aliases)
        body = find_markdown_section(plan_text, aliases)
        section_content[section_name] = body
        if not exists:
            missing_sections.append(section_name)
        elif not body.strip():
            empty_sections.append(section_name)

    if missing_sections:
        (errors if strict else warnings).append(
            f"{plan_rel} missing required sections: {', '.join(missing_sections)}"
        )
    if empty_sections:
        (errors if strict else warnings).append(
            f"{plan_rel} has empty sections: {', '.join(empty_sections)}"
        )

    scope_items = extract_action_items(section_content.get("Scope", ""))
    if scope_items and len(scope_items) > 12:
        (errors if strict else warnings).append(
            f"{plan_rel} scope is too broad ({len(scope_items)} items > 12); split into smaller phases"
        )

    plan_items = extract_action_items(section_content.get("Plan", ""))
    if section_content.get("Plan", "").strip() and not plan_items:
        (errors if strict else warnings).append(
            f"{plan_rel} Plan section has no actionable items (`- [ ]` / bullet / numbered list)"
        )
    if plan_items:
        if len(plan_items) > 8:
            (errors if strict else warnings).append(
                f"{plan_rel} Plan section is too long ({len(plan_items)} steps > 8); keep to small verifiable steps"
            )
        concrete_count = sum(1 for item in plan_items if is_concrete_plan_item(item))
        min_concrete = 1 if len(plan_items) <= 2 else ((len(plan_items) * 3 + 4) // 5)
        if concrete_count < min_concrete:
            (errors if strict else warnings).append(
                f"{plan_rel} Plan steps are too abstract ({concrete_count}/{len(plan_items)} concrete, need >= {min_concrete}); include files/commands per step"
            )

    verify_body = section_content.get("Verify", "")
    if verify_body.strip():
        if not has_runnable_command(verify_body):
            (errors if strict else warnings).append(
                f"{plan_rel} Verify section must contain runnable command(s)"
            )
        if not re.search(r"(?i)(期望|预期|expected)", verify_body):
            (errors if strict else warnings).append(
                f"{plan_rel} Verify section must include expected result (期望/预期/expected)"
            )

    return errors, warnings


def csv_has_id(path: Path, column: str, value: str) -> bool:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return False
        if column in reader.fieldnames:
            for row in reader:
                if (row.get(column) or "").strip() == value:
                    return True
            return False
        for row in reader:
            for cell in row.values():
                if (cell or "").strip() == value:
                    return True
        return False


def jsonl_has_id(path: Path, column: str, value: str) -> bool:
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(row, dict):
                continue
            if column in row:
                cell = row[column]
                if isinstance(cell, str) and cell.strip() == value:
                    return True
                if isinstance(cell, list) and value in [str(v) for v in cell]:
                    return True
                continue
            for cell in row.values():
                if isinstance(cell, str) and cell.strip() == value:
                    return True
                if isinstance(cell, list) and value in [str(v) for v in cell]:
                    return True
    return False


def truth_snapshot(root: Path) -> Dict[str, Dict[str, Any]]:
    truth_files = ["AI_PROJECT.md", "AI_WORKSPACE.md", "REQUIREMENTS.md"]
    out: Dict[str, Dict[str, Any]] = {}
    for rel in truth_files:
        p = root / rel
        if not p.exists():
            continue
        st = p.stat()
        out[rel] = {"mtime": int(st.st_mtime), "sha256": sha256(p)}
    return out


def validate_change(
    *,
    root: Path,
    change_id: str,
    strict: bool,
    allow_truth_drift: bool,
    check_evidence: bool,
    check_scope: bool,
) -> int:
    change_dir = root / ".aiws" / "changes" / change_id
    required_files = ["proposal.md", "tasks.md"]

    errors: List[str] = []
    warnings: List[str] = []

    # Submodule targets constraint: when `.gitmodules` declares submodules, require a per-change target mapping.
    # In strict mode this is an error (blocks delivery); in non-strict mode it's a warning (informational).
    subs = list_submodules_from_gitmodules(root)
    if subs:
        targets_path = change_dir / "submodules.targets"
        if not targets_path.exists() or targets_path.stat().st_size == 0:
            msg = "missing/empty: .aiws/changes/<change-id>/submodules.targets (required when .gitmodules declares submodules)"
            hint = f"hint: create it under {change_dir} (format: <sub_path> <target_branch> [remote])"
            if strict:
                errors.append(msg)
                errors.append(hint)
            else:
                warnings.append(msg)
                warnings.append(hint)
        else:
            targets, perr = parse_submodule_targets(targets_path)
            for pe in perr:
                errors.append(pe)
            declared_paths = {p for _, p in subs}
            missing_paths = sorted([p for p in declared_paths if p not in targets])
            if missing_paths:
                msg = f"{targets_path.name} missing entries for submodules: {', '.join(missing_paths)}"
                if strict:
                    errors.append(msg)
                else:
                    warnings.append(msg)
            extra_paths = sorted([p for p in targets.keys() if p not in declared_paths])
            if extra_paths:
                warnings.append(
                    f"{targets_path.name} includes unknown submodule paths (ignored): {', '.join(extra_paths)}"
                )

    def file_state(rel: str) -> Optional[Path]:
        p = change_dir / rel
        if not p.exists():
            errors.append(f"missing: {rel}")
            return None
        if p.stat().st_size == 0:
            errors.append(f"empty: {rel}")
            return None
        return p

    proposal_path = file_state("proposal.md")
    tasks_path = file_state("tasks.md")

    meta_path = change_dir / ".ws-change.json"
    meta: Optional[Dict[str, Any]] = None
    if not meta_path.exists():
        (errors if strict else warnings).append("missing: .ws-change.json (created by aiws change new / aiws change sync)")
    else:
        try:
            meta = json.loads(read_text(meta_path))
        except Exception as e:
            errors.append(f"invalid .ws-change.json: {e}")

    if meta:
        created_truth = meta.get("base_truth_files") or {}
        synced_truth = meta.get("synced_truth_files") or {}
        baseline = synced_truth if synced_truth else created_truth
        baseline_label = "last sync" if synced_truth else "creation"
        baseline_at = meta.get("synced_at") if synced_truth else meta.get("created_at")

        for rel, base in (baseline or {}).items():
            p = root / rel
            if not p.exists():
                (errors if strict else warnings).append(f"truth file missing now: {rel} (baseline={baseline_label})")
                continue
            try:
                cur_sha = sha256(p)
            except Exception as e:
                warnings.append(f"failed to hash truth file {rel}: {e}")
                continue
            base_sha = (base or {}).get("sha256") if isinstance(base, dict) else None
            if base_sha and cur_sha != base_sha:
                msg = (
                    f"truth file changed since {baseline_label}: {rel} "
                    f"(baseline_at={baseline_at}, baseline_sha={base_sha}, current_sha={cur_sha})"
                )
                if strict and not allow_truth_drift:
                    errors.append(msg + f"; run `aiws change sync {change_id}` to acknowledge")
                else:
                    warnings.append(msg)

        if subs:
            targets_path = change_dir / "submodules.targets"
            if targets_path.exists() and targets_path.stat().st_size > 0:
                targets, _ = parse_submodule_targets(targets_path)
                base_branch = str(meta.get("base_branch") or "").strip() or "main"
                for _, sub_path in subs:
                    target = targets.get(sub_path)
                    if not target:
                        continue
                    target_branch = target[0] if target[0] != "." else base_branch
                    remote = target[1] or "origin"
                    gitlink_sha = resolve_change_gitlink_commit(root, change_id, sub_path)
                    if not gitlink_sha:
                        warnings.append(f"unable to resolve gitlink commit for submodule path: {sub_path}")
                        continue
                    sub_root = root / sub_path
                    if not sub_root.exists():
                        warnings.append(f"submodule path not initialized locally (skip target consistency check): {sub_path}")
                        continue
                    if not git_revision_exists(sub_root, gitlink_sha):
                        warnings.append(
                            f"{sub_path}: gitlink commit {gitlink_sha} is not available in local submodule clone; run `git submodule update --init --recursive`"
                        )
                        continue
                    branch_ref = resolve_branch_ref(sub_root, remote, target_branch)
                    if not branch_ref:
                        warnings.append(
                            f"{sub_path}: cannot verify target branch history locally (missing {remote}/{target_branch} and local branch {target_branch})"
                        )
                        continue
                    if git_is_ancestor(sub_root, gitlink_sha, branch_ref):
                        continue
                    errors.append(
                        f"{sub_path}: gitlink commit {gitlink_sha} is not contained in declared target branch {remote}/{target_branch}"
                    )
                    errors.append(
                        f"hint: fix `.gitmodules` / `.aiws/changes/{change_id}/submodules.targets`, or move the submodule gitlink onto a commit reachable from {remote}/{target_branch}"
                    )

    def placeholder_scan(rel: str, text: str) -> None:
        if "{{CHANGE_ID}}" in text or "{{TITLE}}" in text or "{{CREATED_AT}}" in text:
            errors.append(f"unrendered template placeholders in {rel}")
        if "WS:TODO" in text:
            (errors if strict else warnings).append(f"WS:TODO markers remain in {rel}")

    def evidence_is_persistent(p: str) -> bool:
        p2 = p.replace("\\", "/")
        return p2.startswith(f".aiws/changes/{change_id}/evidence/") or p2.startswith(f".aiws/changes/{change_id}/review/")

    def parse_scope_patterns_from_plan(plan_text: str) -> List[str]:
        # Extract allow-list bullet items from a plan's scope section.
        # Supports either:
        # - direct bullets under "## Scope"
        # - nested "### In Scope" / "### Out of Scope" sections
        lines = (plan_text or "").splitlines()
        patterns: List[str] = []
        in_scope = False
        has_scope_subsections = False
        scope_subsection = ""
        for raw in lines:
            line = raw.rstrip("\n")
            if line.startswith("## "):
                in_scope = line.strip() in ("## Scope", "## 影响范围（Scope）", "## 影响范围 (Scope)")
                has_scope_subsections = False
                scope_subsection = ""
                continue
            if not in_scope:
                continue
            if line.startswith("## "):
                break
            if line.startswith("### "):
                has_scope_subsections = True
                heading = line.strip().lower()
                if "in scope" in heading or "本次改动范围" in line:
                    scope_subsection = "in"
                elif "out of scope" in heading or "明确不改动" in line:
                    scope_subsection = "out"
                else:
                    scope_subsection = "other"
                continue
            s = line.strip()
            if not s:
                continue
            if s.startswith("- "):
                if has_scope_subsections and scope_subsection != "in":
                    continue
                v = s[2:].strip()
                if v.startswith("`") and v.endswith("`") and len(v) >= 2:
                    v = v[1:-1].strip()
                if v.upper() == "TBD":
                    continue
                # Normalize common "path (note)" into "path"
                v = v.split("（", 1)[0].split("(", 1)[0].strip()
                if v:
                    patterns.append(v)
        return patterns

    def normalize_scope_pattern(pat: str) -> str:
        p = (pat or "").strip().replace("\\", "/")
        if p.startswith("./"):
            p = p[2:]
        # Treat trailing slash as directory prefix match.
        if p.endswith("/") and not p.endswith("/**"):
            p = p + "**"
        return p

    def match_scope_pattern(relpath: str, pat: str) -> bool:
        import fnmatch

        rp = (relpath or "").replace("\\", "/")
        p = normalize_scope_pattern(pat)
        if not p:
            return False
        # If the pattern contains glob syntax, fnmatch it.
        if any(ch in p for ch in ["*", "?", "[", "]"]):
            return fnmatch.fnmatch(rp, p)
        # Otherwise treat as prefix (file or directory).
        if rp == p:
            return True
        return rp.startswith(p.rstrip("/") + "/")

    def check_declared_paths(rel: str, decl: str) -> None:
        paths = split_declared_values(decl)
        if not paths:
            return
        has_persistent = any(evidence_is_persistent(p) for p in paths)
        if not has_persistent:
            (errors if strict else warnings).append(
                f"{rel} Evidence_Path should include at least one persistent path under .aiws/changes/<id>/evidence or .aiws/changes/<id>/review"
            )
        for raw in paths:
            p = raw.strip()
            if not p:
                continue
            if p.startswith("./"):
                p = p[2:]
            if p.startswith("~") or os.path.isabs(p):
                errors.append(f"{rel} Evidence_Path must be workspace-relative, got absolute path: {raw}")
                continue
            if ".." in Path(p).parts:
                errors.append(f"{rel} Evidence_Path must not contain '..': {raw}")
                continue
            abs_p = (root / p).resolve()
            try:
                abs_p.relative_to(root)
            except Exception:
                errors.append(f"{rel} Evidence_Path points outside workspace: {raw}")
                continue
            if not abs_p.exists():
                errors.append(f"{rel} Evidence_Path missing file: {raw}")

    def scope_check_from_plan(plan_rel: str, plan_text: str) -> None:
        if not check_scope:
            return
        patterns = [normalize_scope_pattern(p) for p in parse_scope_patterns_from_plan(plan_text)]
        patterns = [p for p in patterns if p]
        if not patterns:
            (errors if strict else warnings).append(f"{plan_rel} scope check enabled but no patterns found under '## Scope' / '### In Scope'")
            return

        meta_path = change_dir / ".ws-change.json"
        base_branch = ""
        if meta_path.exists():
            try:
                meta = json.loads(read_text(meta_path))
                base_branch = str((meta or {}).get("base_branch") or "").strip()
            except Exception:
                base_branch = ""
        if not base_branch:
            (errors if strict else warnings).append(
                "scope check requires base_branch recorded in .aiws/changes/<id>/.ws-change.json (run `aiws change start <id>` to record it)"
            )
            return

        # Compute changed files vs merge-base with base_branch (include staged + unstaged).
        try:
            mb = subprocess.run(
                ["git", "-C", str(root), "merge-base", base_branch, "HEAD"],
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except Exception as e:
            (errors if strict else warnings).append(f"scope check failed to run git merge-base: {e}")
            return
        if mb.returncode != 0:
            (errors if strict else warnings).append(f"scope check failed to compute merge-base vs {base_branch}: {mb.stderr.strip() or mb.stdout.strip()}")
            return
        base = (mb.stdout or "").strip()
        if not base:
            (errors if strict else warnings).append(f"scope check failed to compute merge-base vs {base_branch}: empty output")
            return

        def diff_names(args: List[str]) -> List[str]:
            try:
                res = subprocess.run(
                    ["git", "-C", str(root), "diff", "--name-only", "--diff-filter=ACMR", *args],
                    check=False,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
            except Exception:
                return []
            if res.returncode != 0:
                return []
            return [ln.strip() for ln in (res.stdout or "").splitlines() if ln.strip()]

        # Include untracked files as "changed" too (new files are common in dev/deliver stages).
        untracked: List[str] = []
        try:
            ls = subprocess.run(
                ["git", "-C", str(root), "ls-files", "--others", "--exclude-standard"],
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            if ls.returncode == 0:
                untracked = [ln.strip() for ln in (ls.stdout or "").splitlines() if ln.strip()]
        except Exception:
            untracked = []

        changed = sorted(set(diff_names([base]) + diff_names(["--cached", base]) + untracked))
        if not changed:
            return

        # Always allow core workflow artifacts.
        always_allow = [
            f".aiws/changes/{change_id}/**",
            ".aiws/plan/**",
            "REQUIREMENTS.md",
            ".aiws/requirements/requirements-issues.csv",
            ".aiws/requirements/requirements-issues.jsonl",
            ".aiws/issues/problem-issues.csv",
            ".aiws/issues/problem-issues.jsonl",
        ]
        all_patterns = patterns + always_allow

        out_of_scope = [p for p in changed if not any(match_scope_pattern(p, pat) for pat in all_patterns)]
        if out_of_scope:
            msg = "out-of-scope files detected (update plan Scope or explain): " + ", ".join(out_of_scope[:20]) + (" ..." if len(out_of_scope) > 20 else "")
            (errors if strict else warnings).append(f"{plan_rel} {msg}")

    req_id = ""
    prob_id = ""
    change_id_decl = ""
    contract_row_decl = ""
    plan_file_decl = ""
    evidence_path_decl = ""
    req_jsonl = root / ".aiws" / "requirements" / "requirements-issues.jsonl"
    prob_jsonl = root / ".aiws" / "issues" / "problem-issues.jsonl"

    if proposal_path:
        t = read_text(proposal_path)
        placeholder_scan("proposal.md", t)
        if "验证" not in t:
            warnings.append("proposal.md does not mention 验证 (recommended to include reproducible verification)")
        if "AI_WORKSPACE.md" not in t:
            warnings.append("proposal.md does not reference AI_WORKSPACE.md (recommended)")

        change_id_decl = extract_id("Change_ID", t)
        req_id = normalize_optional_id(extract_id("Req_ID", t))
        prob_id = normalize_optional_id(extract_id("Problem_ID", t))
        contract_row_decl = extract_first_id(["Contract_Row", "Contract_Row(s)"], t)
        plan_file_decl = extract_first_id(["Plan_File", "Plan file"], t)
        evidence_path_decl = extract_first_id(["Evidence_Path", "Evidence_Path(s)"], t)

        if strict and not change_id_decl:
            errors.append("proposal.md must include non-empty Change_ID")
        if change_id_decl and change_id_decl != change_id:
            (errors if strict else warnings).append(f"Change_ID mismatch in proposal.md: {change_id_decl} (expected: {change_id})")
        if strict and not (req_id or prob_id):
            errors.append("proposal.md must include a non-empty Req_ID or Problem_ID (attribution)")
        if strict and not contract_row_decl:
            errors.append("proposal.md must include non-empty Contract_Row")
        if strict and not plan_file_decl:
            errors.append("proposal.md must include non-empty Plan_File")
        if strict and not evidence_path_decl:
            errors.append("proposal.md must include non-empty Evidence_Path")
        if check_evidence and evidence_path_decl:
            check_declared_paths("proposal.md", evidence_path_decl)

        if req_id and req_jsonl.exists():
            ok = False
            try:
                ok = jsonl_has_id(req_jsonl, "Req_ID", req_id)
            except Exception as e:
                warnings.append(f"failed to read .aiws/requirements/requirements-issues.jsonl: {e}")
            if not ok:
                (errors if strict else warnings).append(f"Req_ID not found in .aiws/requirements/requirements-issues.jsonl: {req_id}")

        if prob_id and prob_jsonl.exists():
            ok = False
            try:
                ok = jsonl_has_id(prob_jsonl, "Problem_ID", prob_id)
            except Exception as e:
                warnings.append(f"failed to read .aiws/issues/problem-issues.jsonl: {e}")
            if not ok:
                (errors if strict else warnings).append(f"Problem_ID not found in .aiws/issues/problem-issues.jsonl: {prob_id}")

        normalized_contract_refs: List[Tuple[str, str]] = []
        for raw_ref in split_declared_values(contract_row_decl):
            kind, value = normalize_contract_ref(raw_ref)
            found = False
            resolved_kind = kind
            try:
                if kind == "Req_ID":
                    found = req_jsonl.exists() and jsonl_has_id(req_jsonl, "Req_ID", value)
                elif kind == "Problem_ID":
                    found = prob_jsonl.exists() and jsonl_has_id(prob_jsonl, "Problem_ID", value)
                else:
                    if req_jsonl.exists() and jsonl_has_id(req_jsonl, "Req_ID", value):
                        found = True
                        resolved_kind = "Req_ID"
                    elif prob_jsonl.exists() and jsonl_has_id(prob_jsonl, "Problem_ID", value):
                        found = True
                        resolved_kind = "Problem_ID"
            except Exception as e:
                warnings.append(f"failed to resolve Contract_Row reference {raw_ref}: {e}")
            if not found:
                (errors if strict else warnings).append(f"Contract_Row not found in .aiws/requirements problem CSVs/JSONL: {raw_ref}")
                continue
            normalized_contract_refs.append((resolved_kind, value))

        if req_id:
            has_req_binding = any(kind == "Req_ID" and value == req_id for kind, value in normalized_contract_refs)
            if not has_req_binding:
                (errors if strict else warnings).append(
                    f"Contract_Row must include Req_ID binding for proposal Req_ID: {req_id}"
                )
        if prob_id:
            has_prob_binding = any(kind == "Problem_ID" and value == prob_id for kind, value in normalized_contract_refs)
            if not has_prob_binding:
                (errors if strict else warnings).append(
                    f"Contract_Row must include Problem_ID binding for proposal Problem_ID: {prob_id}"
                )

        plan_files = split_declared_values(plan_file_decl)
        if strict and len(plan_files) > 1:
            errors.append("proposal.md Plan_File must contain exactly one plan path")
        if plan_files:
            plan_rel = plan_files[0]
            if plan_rel.startswith("./"):
                plan_rel = plan_rel[2:]
            if os.path.isabs(plan_rel):
                (errors if strict else warnings).append(f"Plan_File must be workspace-relative, got absolute path: {plan_rel}")
            if not plan_rel.startswith(".aiws/plan/"):
                (errors if strict else warnings).append(f"Plan_File should be under .aiws/plan/: {plan_rel}")

            plan_abs = (root / plan_rel).resolve()
            try:
                plan_abs.relative_to(root)
            except Exception:
                (errors if strict else warnings).append(f"Plan_File points outside workspace: {plan_rel}")
            else:
                if not plan_abs.exists():
                    (errors if strict else warnings).append(f"Plan_File does not exist: {plan_rel}")
                else:
                    plan_text = read_text(plan_abs)
                    plan_change_id = extract_id("Change_ID", plan_text)
                    plan_req_id = normalize_optional_id(extract_id("Req_ID", plan_text))
                    plan_prob_id = normalize_optional_id(extract_id("Problem_ID", plan_text))
                    plan_contract_row = extract_first_id(["Contract_Row", "Contract_Row(s)"], plan_text)
                    plan_file_from_plan = extract_first_id(["Plan_File", "Plan file"], plan_text)
                    plan_evidence_path = extract_first_id(["Evidence_Path", "Evidence_Path(s)"], plan_text)

                    if strict and not plan_change_id:
                        errors.append(f"{plan_rel} must include non-empty Change_ID")
                    if plan_change_id and plan_change_id != change_id:
                        (errors if strict else warnings).append(
                            f"Change_ID mismatch in {plan_rel}: {plan_change_id} (expected: {change_id})"
                        )
                    if strict and not (plan_req_id or plan_prob_id):
                        errors.append(f"{plan_rel} must include non-empty Req_ID or Problem_ID")
                    if req_id and plan_req_id != req_id:
                        (errors if strict else warnings).append(
                            f"Req_ID mismatch between proposal.md and {plan_rel}: proposal={req_id}, plan={plan_req_id or '(empty)'}"
                        )
                    if prob_id and plan_prob_id != prob_id:
                        (errors if strict else warnings).append(
                            f"Problem_ID mismatch between proposal.md and {plan_rel}: proposal={prob_id}, plan={plan_prob_id or '(empty)'}"
                        )
                    if strict and not plan_contract_row:
                        errors.append(f"{plan_rel} must include non-empty Contract_Row")
                    if strict and not plan_file_from_plan:
                        errors.append(f"{plan_rel} must include non-empty Plan_File")
                    if strict and not plan_evidence_path:
                        errors.append(f"{plan_rel} must include non-empty Evidence_Path")
                    if check_evidence and plan_evidence_path:
                        check_declared_paths(plan_rel, plan_evidence_path)
                    scope_check_from_plan(plan_rel, plan_text)

                    if plan_file_from_plan:
                        plan_file_refs = split_declared_values(plan_file_from_plan)
                        normalized_plan_ref = plan_file_refs[0] if plan_file_refs else ""
                        if normalized_plan_ref.startswith("./"):
                            normalized_plan_ref = normalized_plan_ref[2:]
                        if normalized_plan_ref and normalized_plan_ref != plan_rel:
                            (errors if strict else warnings).append(
                                f"Plan_File mismatch in {plan_rel}: {normalized_plan_ref} (expected: {plan_rel})"
                            )

                    proposal_contract_set = {normalize_contract_ref(v) for v in split_declared_values(contract_row_decl)}
                    plan_contract_set = {normalize_contract_ref(v) for v in split_declared_values(plan_contract_row)}
                    missing_contract = proposal_contract_set - plan_contract_set
                    if missing_contract:
                        missing_text = ", ".join([f"{kind}={value}" for kind, value in sorted(missing_contract)])
                        (errors if strict else warnings).append(
                            f"{plan_rel} missing Contract_Row bindings declared in proposal.md: {missing_text}"
                        )

                    proposal_evidence_set = set(split_declared_values(evidence_path_decl))
                    plan_evidence_set = set(split_declared_values(plan_evidence_path))
                    missing_evidence = proposal_evidence_set - plan_evidence_set
                    if missing_evidence:
                        missing_text = ", ".join(sorted(missing_evidence))
                        (errors if strict else warnings).append(
                            f"{plan_rel} missing Evidence_Path entries declared in proposal.md: {missing_text}"
                        )

                    quality_errors, quality_warnings = validate_plan_quality(plan_text, plan_rel, strict)
                    errors.extend(quality_errors)
                    warnings.extend(quality_warnings)

    if tasks_path:
        t = read_text(tasks_path)
        placeholder_scan("tasks.md", t)
        if not re.search(r"(?m)^- \[[ xX]\]", t):
            errors.append("tasks.md has no checkbox tasks ('- [ ]' or '- [x]')")

    design_path = change_dir / "design.md"
    if design_path.exists() and design_path.stat().st_size > 0:
        placeholder_scan("design.md", read_text(design_path))

    for e in errors:
        eprint(f"error: {e}")
    for w in warnings:
        eprint(f"warn: {w}")

    return 2 if errors else 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Validate ws change artifacts for hooks/CI.")
    parser.add_argument("--workspace-root", default="", help="Workspace root (defaults to git root).")
    parser.add_argument("--change-id", default="", help="Change id (defaults to infer from branch).")
    parser.add_argument(
        "--branch",
        default="",
        help="Branch name to validate against (for CI detached HEAD). When set, enforces change/<id> naming.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat WS:TODO as errors; require main bindings and enforce plan quality gate (sections, step granularity, verify commands).",
    )
    parser.add_argument(
        "--allow-truth-drift",
        action="store_true",
        help="Do not fail strict validation on truth drift (use only for emergencies).",
    )
    parser.add_argument(
        "--check-evidence",
        action="store_true",
        help="Validate Evidence_Path points to workspace-relative existing files; require at least one persistent evidence path.",
    )
    parser.add_argument(
        "--check-scope",
        action="store_true",
        help="Scope gate: compare git diff vs base_branch with plan '## Scope' / '### In Scope' patterns and warn/error on out-of-scope files.",
    )
    parser.add_argument(
        "--allow-branches",
        default="main,master",
        help="Comma-separated branch names that are exempt (default: main,master).",
    )
    args = parser.parse_args(argv)

    cwd = Path(os.getcwd())
    root = Path(args.workspace_root).resolve() if args.workspace_root else (git_root(cwd) or cwd.resolve())

    ok_truth, missing = has_truth_files(root)
    if not ok_truth:
        # Not an AI Workspace; do not block.
        eprint(f"warn: skip ws-change check (missing truth files): {missing}")
        return 0

    change_id = args.change_id.strip()
    if change_id and not CHANGE_ID_RE.match(change_id):
        eprint(f"error: invalid change id (use kebab-case): {change_id}")
        return 2

    branch_arg = (args.branch or "").strip()
    branch = branch_arg or current_branch(root)
    inferred_from_branch = False
    if not change_id:
        # Detached HEAD during rebase/merge; do not block unless CI passes --branch.
        if not branch:
            eprint("warn: skip ws-change check (detached HEAD; pass --branch in CI to enforce)")
            return 0
        allow = {b.strip() for b in (args.allow_branches or "").split(",") if b.strip()}
        if branch in allow:
            return 0
        inferred = infer_change_id_from_branch(branch)
        if not inferred:
            eprint(f"error: branch must be change/<change-id> (current: {branch})")
            eprint("hint: switch/create: git switch -c change/<change-id>")
            return 2
        change_id = inferred
        inferred_from_branch = True
    else:
        # If CI provides --branch, cross-check branch naming even when --change-id is provided.
        if branch_arg:
            allow = {b.strip() for b in (args.allow_branches or "").split(",") if b.strip()}
            if branch_arg not in allow:
                inferred = infer_change_id_from_branch(branch_arg)
                if not inferred:
                    eprint(f"error: branch must be change/<change-id> (current: {branch_arg})")
                    return 2
                if inferred != change_id:
                    eprint(f"error: change-id does not match branch (branch={branch_arg}, change_id={change_id})")
                    return 2

    change_dir = root / ".aiws" / "changes" / change_id
    terminated = terminated_change_message(root, change_id) if (inferred_from_branch or bool(branch_arg)) else None
    if terminated:
        eprint(f"error: {terminated}")
        eprint(
            f"hint: stop using change/{change_id} for new work; rerun `aiws change finish {change_id} --push` "
            "or archive manually only for local recovery"
        )
        return 2
    if not change_dir.exists():
        eprint(f"error: missing change dir: {change_dir}")
        eprint(f"hint: create: aiws change new {change_id} --no-design")
        return 2

    return validate_change(
        root=root,
        change_id=change_id,
        strict=args.strict,
        allow_truth_drift=args.allow_truth_drift,
        check_evidence=args.check_evidence,
        check_scope=args.check_scope,
    )


if __name__ == "__main__":
    raise SystemExit(main())
