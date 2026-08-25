#!/usr/bin/env python3
"""Idempotent migration of legacy requirements contract CSV to JSONL.

Triggered automatically by `aiws update` after template projection.

States (idempotent, never incremental):
  - SKIP: no legacy CSV, or target JSONL already present and non-empty
  - MIGRATE: legacy CSV exists and JSONL missing -> convert via
    requirements_contract.migrate_from_csv (API_Impact split on " -> ")
  - FAIL: unexpected error (non-zero exit; `aiws update` logs a warning and continues)

The legacy CSV is never deleted by this script (verification happens in the
workspace); removal is a manual step after reviewing the migrated JSONL.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from requirements_contract import migrate_from_csv

REQ_DIR = ".aiws/requirements"
LEGACY_CSV = "requirements-issues.csv"
TARGET_JSONL = "requirements-issues.jsonl"


def decide(*, csv_path: Path, jsonl_path: Path) -> str:
    """Return 'migrate' or 'skip' based on current state (pure predicate)."""
    if not csv_path.exists():
        return "skip"
    if jsonl_path.exists() and jsonl_path.stat().st_size > 0:
        return "skip"
    return "migrate"


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        description="Idempotent CSV -> JSONL contract migration (called by aiws update)"
    )
    p.add_argument("--workspace", default=".", help="workspace root")
    p.add_argument("--csv", default=f"{REQ_DIR}/{LEGACY_CSV}", help="legacy CSV path (relative to workspace)")
    p.add_argument("--jsonl", default=f"{REQ_DIR}/{TARGET_JSONL}", help="target JSONL path (relative to workspace)")
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
