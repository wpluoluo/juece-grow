#!/usr/bin/env python3
"""Idempotent migration of legacy problem-issues CSV to JSONL.

Counterpart of requirements_contract_migrate.py for .aiws/issues/problem-issues.

Triggered automatically by `aiws update` after template projection.

States (idempotent, never incremental):
  - SKIP: no legacy CSV, or target JSONL already present and non-empty
  - MIGRATE: legacy CSV exists and JSONL missing -> convert via
    migrate_from_csv (plain column copy; no array fields in problem-issues)
  - FAIL: unexpected error (non-zero exit; `aiws update` logs a warning and continues)

The legacy CSV is never deleted by this script (verification happens in the
workspace); removal is a manual step after reviewing the migrated JSONL.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

ISSUES_DIR = ".aiws/issues"
LEGACY_CSV = "problem-issues.csv"
TARGET_JSONL = "problem-issues.jsonl"

# Order preserved from the CSV header; JSONL keys mirror the header exactly.
COLUMNS = ["Issue_ID", "Type", "Title", "Status", "Priority", "Req_ID", "Problem_ID", "Notes"]


def write_rows(jsonl_path: Path, rows: List[Dict[str, Any]]) -> None:
    jsonl_path.parent.mkdir(parents=True, exist_ok=True)
    with jsonl_path.open("w", encoding="utf-8", newline="\n") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=False) + "\n")


def migrate_from_csv(*, csv_path: Path, jsonl_path: Path) -> Dict[str, Any]:
    """One-shot migration: read legacy problem-issues CSV -> write JSONL.

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
                row[k] = "" if raw is None else raw
            rows.append(row)
    write_rows(jsonl_path, rows)
    return {"migrated": len(rows), "csv": str(csv_path), "jsonl": str(jsonl_path)}


def decide(*, csv_path: Path, jsonl_path: Path) -> str:
    """Return 'migrate' or 'skip' based on current state (pure predicate)."""
    if not csv_path.exists():
        return "skip"
    if jsonl_path.exists() and jsonl_path.stat().st_size > 0:
        return "skip"
    return "migrate"


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        description="Idempotent problem-issues CSV -> JSONL migration (called by aiws update)"
    )
    p.add_argument("--workspace", default=".", help="workspace root")
    p.add_argument("--csv", default=f"{ISSUES_DIR}/{LEGACY_CSV}", help="legacy CSV path (relative to workspace)")
    p.add_argument("--jsonl", default=f"{ISSUES_DIR}/{TARGET_JSONL}", help="target JSONL path (relative to workspace)")
    args = p.parse_args(argv)

    root = Path(args.workspace).resolve()
    csv_path = (root / args.csv).resolve()
    jsonl_path = (root / args.jsonl).resolve()

    if decide(csv_path=csv_path, jsonl_path=jsonl_path) == "skip":
        reason = (
            f"no legacy CSV at {csv_path.relative_to(root)}"
            if not csv_path.exists()
            else f"JSONL already present at {jsonl_path.relative_to(root)} (non-empty; no incremental migration)"
        )
        print(f"SKIP: {reason}")
        return 0

    stats = migrate_from_csv(csv_path=csv_path, jsonl_path=jsonl_path)
    print(f"OK: migrated {stats['migrated']} rows -> {jsonl_path.relative_to(root)}")
    print(f"note: legacy CSV kept at {csv_path.relative_to(root)} (remove manually after verifying)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
