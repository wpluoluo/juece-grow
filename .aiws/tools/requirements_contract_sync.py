#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


FLOW_SPEC_BEGIN = "<!-- FLOW_SPEC_BEGIN -->"
FLOW_SPEC_END = "<!-- FLOW_SPEC_END -->"


COLUMNS = [
    "Req_ID",
    "Title",
    "Change_Type",
    "Module",
    "CRUD",
    "Actor",
    "Scenario",
    "Preconditions",
    "Inputs",
    "Outputs",
    "Data_Model",
    "Business_Logic",
    "API_Impact",
    "NonFunctional",
    "Spec_Status",
    "Impl_Status",
    "Tests",
    "Evidence",
    "Owner",
    "Created_At",
    "Updated_At",
    "Notes",
]

# API_Impact is stored as a JSON array of strings in JSONL; others are str.
ARRAY_FIELDS = {"API_Impact"}


def _now_utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def extract_flow_spec_json(requirements_text: str) -> Dict[str, Any]:
    if FLOW_SPEC_BEGIN not in requirements_text or FLOW_SPEC_END not in requirements_text:
        return {}
    body = requirements_text.split(FLOW_SPEC_BEGIN, 1)[1].split(FLOW_SPEC_END, 1)[0]
    start = body.find("```")
    if start == -1:
        return {}
    fence = body[start:]
    lines = fence.splitlines()
    if not lines:
        return {}
    header = lines[0].strip().lower()
    if not header.startswith("```") or "json" not in header:
        return {}
    payload_lines: List[str] = []
    for ln in lines[1:]:
        if ln.strip().startswith("```"):
            break
        payload_lines.append(ln)
    raw = "\n".join(payload_lines).strip()
    if not raw:
        return {}
    data = json.loads(raw)
    if not isinstance(data, dict):
        return {}
    return data


@dataclass(frozen=True)
class FlowStep:
    method: str
    path: str
    name: str = ""


@dataclass(frozen=True)
class Flow:
    flow_id: str
    title: str
    steps: List[FlowStep]
    notes: str = ""


def parse_flows(data: Dict[str, Any]) -> List[Flow]:
    flows_raw = data.get("flows")
    if not isinstance(flows_raw, list):
        return []
    out: List[Flow] = []
    for item in flows_raw:
        if not isinstance(item, dict):
            continue
        flow_id = str(item.get("id") or "").strip()
        if not flow_id:
            continue
        title = str(item.get("title") or flow_id).strip()
        notes = str(item.get("notes") or "").strip()
        steps_raw = item.get("steps") or []
        if not isinstance(steps_raw, list):
            continue
        steps: List[FlowStep] = []
        for s in steps_raw:
            if not isinstance(s, dict):
                continue
            method = str(s.get("method") or "GET").strip().upper()
            path = str(s.get("path") or "").strip()
            name = str(s.get("name") or "").strip()
            if not path:
                continue
            steps.append(FlowStep(method=method, path=path, name=name))
        if steps:
            out.append(Flow(flow_id=flow_id, title=title, steps=steps, notes=notes))
    return out


def _norm(key: str, value: Any) -> Any:
    if key in ARRAY_FIELDS:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v) for v in value]
        s = str(value).strip()
        return [s] if s else []
    return "" if value is None else str(value)


def _read_jsonl_rows(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(data, dict):
                continue
            rows.append({k: _norm(k, data.get(k)) for k in COLUMNS})
    return rows


def _write_jsonl_rows(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            record = {k: _norm(k, r.get(k)) for k in COLUMNS}
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _ensure_file(path: Path) -> None:
    if not path.exists():
        _write_jsonl_rows(path, [])


def _next_req_id(rows: List[Dict[str, Any]]) -> str:
    max_n = 0
    for r in rows:
        rid = (r.get("Req_ID") or "").strip()
        if rid.startswith("REQ-") and rid[4:].isdigit():
            max_n = max(max_n, int(rid[4:]))
    return f"REQ-{max_n+1:04d}"


def _find_row_by_source(rows: List[Dict[str, Any]], source: str) -> Optional[Dict[str, Any]]:
    needle = f"source={source}"
    for r in rows:
        notes = (r.get("Notes") or "").strip()
        if needle in notes:
            return r
    return None


def _append_source(notes: str, source: str) -> str:
    token = f"source={source}"
    s = (notes or "").strip()
    if token in s:
        return s
    return (s + ("\n" if s else "") + token).strip()


def _steps_list(flow: Flow) -> List[str]:
    return [f"{s.method} {s.path}".strip() for s in flow.steps]


def upsert_from_flows(
    *,
    jsonl_path: Path,
    flows: List[Flow],
    default_owner: str,
    default_tests: str,
) -> Dict[str, int]:
    _ensure_file(jsonl_path)
    rows = _read_jsonl_rows(jsonl_path)
    now = _now_utc()

    created = 0
    updated = 0

    for flow in flows:
        source = f"flow:{flow.flow_id}"
        row = _find_row_by_source(rows, source)
        steps = _steps_list(flow)
        if row is None:
            rid = _next_req_id(rows)
            rows.append(
                {
                    "Req_ID": rid,
                    "Title": flow.title,
                    "Change_Type": "CLARIFY",
                    "Module": "",
                    "CRUD": "",
                    "Actor": "",
                    "Scenario": flow.title,
                    "Preconditions": "",
                    "Inputs": "",
                    "Outputs": "",
                    "Data_Model": "",
                    "Business_Logic": flow.notes,
                    "API_Impact": steps,
                    "NonFunctional": "",
                    "Spec_Status": "DRAFT",
                    "Impl_Status": "TODO",
                    "Tests": default_tests,
                    "Evidence": "",
                    "Owner": default_owner,
                    "Created_At": now,
                    "Updated_At": now,
                    "Notes": _append_source("", source),
                }
            )
            created += 1
        else:
            row["Title"] = (row.get("Title") or "").strip() or flow.title
            row["Scenario"] = (row.get("Scenario") or "").strip() or flow.title
            row["Business_Logic"] = (row.get("Business_Logic") or "").strip() or flow.notes
            if not (row.get("API_Impact") or []):
                row["API_Impact"] = steps
            row["Tests"] = (row.get("Tests") or "").strip() or default_tests
            row["Owner"] = (row.get("Owner") or "").strip() or default_owner
            row["Notes"] = _append_source(row.get("Notes") or "", source)
            row["Updated_At"] = now
            updated += 1

    _write_jsonl_rows(jsonl_path, rows)
    return {"created": created, "updated": updated, "total_flows": len(flows)}


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="Backfill requirements contract JSONL from REQUIREMENTS.md FlowSpec.")
    p.add_argument("--workspace", default=".", help="workspace root")
    p.add_argument("--requirements", default="REQUIREMENTS.md", help="requirements markdown path (relative to workspace)")
    p.add_argument("--out-jsonl", default=".aiws/requirements/requirements-issues.jsonl", help="output contract JSONL path")
    p.add_argument("--owner", default="", help="default Owner for new rows")
    p.add_argument(
        "--default-tests",
        default="",
        help="default Tests for new rows (leave empty to force manual fill later)",
    )
    args = p.parse_args(argv)

    root = Path(args.workspace).resolve()
    req_path = (root / args.requirements).resolve()
    jsonl_path = (root / args.out_jsonl).resolve()

    if not req_path.exists():
        raise SystemExit(f"missing requirements file: {req_path}")

    spec = extract_flow_spec_json(_read_text(req_path))
    flows = parse_flows(spec) if spec else []
    if not flows:
        print("WARN: no FlowSpec found in REQUIREMENTS.md (or flows empty); nothing to sync.")
        print("hint: add/update FlowSpec between FLOW_SPEC markers, then re-run.")
        _ensure_file(jsonl_path)
        print(f"OK: ensured {jsonl_path.relative_to(root)}")
        return 0

    default_owner = args.owner.strip()
    default_tests = args.default_tests.strip()
    stats = upsert_from_flows(
        jsonl_path=jsonl_path,
        flows=flows,
        default_owner=default_owner,
        default_tests=default_tests,
    )

    print(f"OK: synced from FlowSpec -> {jsonl_path.relative_to(root)}")
    print(f"- flows: {stats['total_flows']}")
    print(f"- created: {stats['created']}")
    print(f"- updated: {stats['updated']}")
    print("next: fill missing fields, then run: python3 .aiws/tools/requirements_contract.py validate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(__import__('sys').argv[1:]))
