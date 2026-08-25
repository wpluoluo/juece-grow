#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


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

# API_Impact is stored as a JSON array of strings (e.g. ["POST /api/ai/query", ...]).
# All other fields are plain strings.
ARRAY_FIELDS = {"API_Impact"}


SPEC_STATUS = {"DRAFT", "READY"}
IMPL_STATUS = {"TODO", "DOING", "DONE", "BLOCKED", "SKIP"}
CHANGE_TYPE = {"ADD", "UPDATE", "DELETE", "CLARIFY"}


def now_utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _norm_value(key: str, value: Any) -> Any:
    """Normalize a raw value for JSONL storage.

    ARRAY_FIELDS are stored as list[str]; everything else as str.
    Accepts str input for array fields (single-element list; empty -> []).
    """
    if key in ARRAY_FIELDS:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v) for v in value]
        s = str(value).strip()
        return [s] if s else []
    return "" if value is None else str(value)


def read_rows(path: Path) -> List[Dict[str, Any]]:
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
            row: Dict[str, Any] = {}
            for k in COLUMNS:
                row[k] = _norm_value(k, data.get(k))
            rows.append(row)
    return rows


def write_rows(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            record = {k: _norm_value(k, r.get(k)) for k in COLUMNS}
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def ensure_header(path: Path) -> None:
    """Ensure the JSONL contract file exists (no header concept; kept for API compat)."""
    if not path.exists():
        write_rows(path, [])


def next_req_id(rows: List[Dict[str, Any]]) -> str:
    max_n = 0
    for r in rows:
        rid = (r.get("Req_ID") or "").strip()
        if rid.startswith("REQ-") and rid[4:].isdigit():
            max_n = max(max_n, int(rid[4:]))
    return f"REQ-{max_n+1:04d}"


def normalize_choice(value: str, allowed: set[str], field: str) -> str:
    v = value.strip().upper()
    if v and v not in allowed:
        raise SystemExit(f"invalid {field}: {value!r}, allowed: {sorted(allowed)}")
    return v


def add_row(
    *,
    path: Path,
    title: str,
    change_type: str,
    module: str,
    crud: str,
    actor: str,
    owner: str,
    spec_status: str,
    impl_status: str,
) -> str:
    rows = read_rows(path)
    rid = next_req_id(rows)
    ts = now_utc()
    rows.append(
        {
            "Req_ID": rid,
            "Title": title.strip(),
            "Change_Type": normalize_choice(change_type, CHANGE_TYPE, "Change_Type") or "ADD",
            "Module": module.strip(),
            "CRUD": crud.strip(),
            "Actor": actor.strip(),
            "Scenario": "",
            "Preconditions": "",
            "Inputs": "",
            "Outputs": "",
            "Data_Model": "",
            "Business_Logic": "",
            "API_Impact": [],
            "NonFunctional": "",
            "Spec_Status": normalize_choice(spec_status, SPEC_STATUS, "Spec_Status") or "DRAFT",
            "Impl_Status": normalize_choice(impl_status, IMPL_STATUS, "Impl_Status") or "TODO",
            "Tests": "",
            "Evidence": "",
            "Owner": owner.strip(),
            "Created_At": ts,
            "Updated_At": ts,
            "Notes": "",
        }
    )
    write_rows(path, rows)
    return rid


def set_fields(*, path: Path, req_id: str, updates: Dict[str, Any]) -> None:
    rows = read_rows(path)
    found = False
    ts = now_utc()
    for r in rows:
        if (r.get("Req_ID") or "").strip() == req_id:
            found = True
            for k, v in updates.items():
                if k not in COLUMNS:
                    raise SystemExit(f"unknown column: {k}")
                r[k] = _norm_value(k, v)
            r["Updated_At"] = ts
            break
    if not found:
        raise SystemExit(f"Req_ID not found: {req_id}")
    write_rows(path, rows)


@dataclass(frozen=True)
class ValidateProblem:
    req_id: str
    field: str
    message: str


def validate_rows(rows: List[Dict[str, Any]]) -> List[ValidateProblem]:
    problems: List[ValidateProblem] = []
    for r in rows:
        rid = (r.get("Req_ID") or "").strip()
        if not rid or rid == "REQ-000":
            continue
        spec = (r.get("Spec_Status") or "").strip().upper()
        impl = (r.get("Impl_Status") or "").strip().upper()
        if spec and spec not in SPEC_STATUS:
            problems.append(ValidateProblem(rid, "Spec_Status", f"invalid value: {spec}"))
        if impl and impl not in IMPL_STATUS:
            problems.append(ValidateProblem(rid, "Impl_Status", f"invalid value: {impl}"))
        ctype = (r.get("Change_Type") or "").strip().upper()
        if ctype and ctype not in CHANGE_TYPE:
            problems.append(ValidateProblem(rid, "Change_Type", f"invalid value: {ctype}"))

        if spec == "READY":
            required = [
                "Title",
                "Module",
                "CRUD",
                "Scenario",
                "Inputs",
                "Outputs",
                "Business_Logic",
                "Tests",
            ]
            for f in required:
                if not (r.get(f) or "").strip():
                    problems.append(ValidateProblem(rid, f, "required when Spec_Status=READY"))
        if impl == "DONE":
            for f in ["Evidence"]:
                if not (r.get(f) or "").strip():
                    problems.append(ValidateProblem(rid, f, "required when Impl_Status=DONE"))
    return problems


def migrate_from_csv(*, csv_path: Path, jsonl_path: Path) -> Dict[str, int]:
    """One-shot migration: read legacy CSV contract -> write JSONL contract.

    Does NOT delete the CSV; caller decides when to remove it.
    """
    if not csv_path.exists():
        raise SystemExit(f"missing legacy CSV: {csv_path}")
    rows: List[Dict[str, Any]] = []
    with csv_path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            row: Dict[str, Any] = {}
            for k in COLUMNS:
                raw = r.get(k)
                if k in ARRAY_FIELDS:
                    # legacy CSV stored API_Impact as a " -> " joined string
                    s = (raw or "").strip()
                    row[k] = [part.strip() for part in s.split("->")] if s else []
                else:
                    row[k] = "" if raw is None else raw
            rows.append(row)
    write_rows(jsonl_path, rows)
    return {"migrated": len(rows), "csv": str(csv_path), "jsonl": str(jsonl_path)}


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="Manage requirements execution contract JSONL (.aiws/requirements/requirements-issues.jsonl).")
    p.add_argument("--workspace", default=".", help="workspace root")
    p.add_argument("--jsonl", default=".aiws/requirements/requirements-issues.jsonl", help="contract JSONL path (relative to workspace)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="create JSONL file if missing")

    add = sub.add_parser("add", help="append a new requirement row (DRAFT by default)")
    add.add_argument("--title", required=True)
    add.add_argument("--change-type", default="ADD")
    add.add_argument("--module", default="")
    add.add_argument("--crud", default="")
    add.add_argument("--actor", default="")
    add.add_argument("--owner", default="")
    add.add_argument("--spec-status", default="DRAFT")
    add.add_argument("--impl-status", default="TODO")

    setp = sub.add_parser("set", help="update fields for a given Req_ID")
    setp.add_argument("req_id")
    setp.add_argument("--field", action="append", default=[], help="key=value (repeatable); API_Impact accepts value or value1->value2")

    sub.add_parser("validate", help="validate READY/DONE requirements for completeness")

    mig = sub.add_parser("migrate", help="migrate legacy requirements-issues.csv -> JSONL")
    mig.add_argument("--from-csv", default=".aiws/requirements/requirements-issues.csv", help="legacy CSV path (relative to workspace)")

    args = p.parse_args(argv)
    root = Path(args.workspace).resolve()
    jsonl_path = (root / args.jsonl).resolve()

    if args.cmd == "migrate":
        csv_path = (root / args.from_csv).resolve()
        stats = migrate_from_csv(csv_path=csv_path, jsonl_path=jsonl_path)
        print(f"OK: migrated {stats['migrated']} rows -> {jsonl_path.relative_to(root)}")
        print(f"    legacy CSV kept at: {csv_path.relative_to(root)} (delete manually after verification)")
        return 0

    if args.cmd == "init":
        ensure_header(jsonl_path)
        print(f"OK: ensured {jsonl_path.relative_to(root)}")
        return 0

    ensure_header(jsonl_path)

    if args.cmd == "add":
        rid = add_row(
            path=jsonl_path,
            title=args.title,
            change_type=args.change_type,
            module=args.module,
            crud=args.crud,
            actor=args.actor,
            owner=args.owner,
            spec_status=args.spec_status,
            impl_status=args.impl_status,
        )
        print(f"OK: added {rid} -> {jsonl_path.relative_to(root)}")
        return 0

    if args.cmd == "set":
        updates: Dict[str, Any] = {}
        for kv in args.field:
            if "=" not in kv:
                raise SystemExit(f"invalid --field: {kv!r}, expected key=value")
            k, v = kv.split("=", 1)
            if k in ARRAY_FIELDS:
                # support value1->value2 syntax on CLI for array fields
                parts = [part.strip() for part in v.split("->")] if v.strip() else []
                updates[k] = parts
            else:
                updates[k] = v
        if "Spec_Status" in updates:
            updates["Spec_Status"] = normalize_choice(updates["Spec_Status"], SPEC_STATUS, "Spec_Status")
        if "Impl_Status" in updates:
            updates["Impl_Status"] = normalize_choice(updates["Impl_Status"], IMPL_STATUS, "Impl_Status")
        if "Change_Type" in updates:
            updates["Change_Type"] = normalize_choice(updates["Change_Type"], CHANGE_TYPE, "Change_Type")
        set_fields(path=jsonl_path, req_id=args.req_id, updates=updates)
        print(f"OK: updated {args.req_id} -> {jsonl_path.relative_to(root)}")
        return 0

    if args.cmd == "validate":
        rows = read_rows(jsonl_path)
        problems = validate_rows(rows)
        if not problems:
            print(f"OK: contract validated ({jsonl_path.relative_to(root)})")
            return 0
        print(f"ERROR: contract validation failed ({jsonl_path.relative_to(root)})", file=sys.stderr)
        for pr in problems[:80]:
            print(f"- {pr.req_id}: {pr.field}: {pr.message}", file=sys.stderr)
        if len(problems) > 80:
            print(f"... and {len(problems)-80} more", file=sys.stderr)
        return 2

    raise SystemExit("unreachable")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
