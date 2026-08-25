#!/usr/bin/env python3
"""
Generate an update_plan JSON payload from .aiws/changes/<id>/tasks.md checkbox tasks.

This script is intended to be used by the `p-tasks-plan` Codex skill.
It reads tasks.md only and does not modify it.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


_TASK_RE = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+(.*\S)\s*$")


@dataclass(frozen=True)
class Task:
    text: str
    done: bool


def _read_tasks_md(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return path.read_text(encoding="utf-8")


def _extract_tasks(markdown: str) -> list[Task]:
    tasks: list[Task] = []
    in_code_block = False
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip("\n")
        if line.lstrip().startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue
        m = _TASK_RE.match(line)
        if not m:
            continue
        mark = m.group(1)
        text = m.group(2).strip()
        if not text:
            continue
        tasks.append(Task(text=text, done=(mark.lower() == "x")))
    return tasks


def _plan_statuses(tasks: list[Task]) -> list[str]:
    first_todo_idx = next((i for i, t in enumerate(tasks) if not t.done), None)
    statuses: list[str] = []
    for i, t in enumerate(tasks):
        if t.done:
            statuses.append("completed")
        elif first_todo_idx is not None and i == first_todo_idx:
            statuses.append("in_progress")
        else:
            statuses.append("pending")
    return statuses


def cmd_status(args: argparse.Namespace) -> int:
    path = Path(args.file).resolve()
    try:
        tasks = _extract_tasks(_read_tasks_md(path))
    except FileNotFoundError:
        print(f"tasks.md not found: {path}", file=sys.stderr)
        return 2

    if not tasks:
        print(f"No checkbox tasks found in: {path}", file=sys.stderr)
        return 2

    total = len(tasks)
    done = sum(1 for t in tasks if t.done)
    first_todo_idx = next((i for i, t in enumerate(tasks) if not t.done), None)
    suffix = f" (IN_PROGRESS: {first_todo_idx + 1})" if first_todo_idx is not None else ""
    print(f"{done}/{total} DONE{suffix}")
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    path = Path(args.file).resolve()
    try:
        tasks = _extract_tasks(_read_tasks_md(path))
    except FileNotFoundError:
        print(f"tasks.md not found: {path}", file=sys.stderr)
        return 2

    if not tasks:
        print(f"No checkbox tasks found in: {path}", file=sys.stderr)
        return 2

    statuses = _plan_statuses(tasks)
    if len(tasks) != len(statuses):
        print("Internal error: tasks/statuses length mismatch", file=sys.stderr)
        return 2

    payload = {
        "explanation": args.explanation or "",
        "plan": [{"step": t.text, "status": s} for t, s in zip(tasks, statuses)],
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ws_tasks_plan.py")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_status = sub.add_parser("status", help="Print progress summary from tasks.md")
    p_status.add_argument("--file", required=True, help="Path to .aiws/changes/<id>/tasks.md")
    p_status.set_defaults(fn=cmd_status)

    p_plan = sub.add_parser("plan", help="Generate update_plan JSON payload from tasks.md")
    p_plan.add_argument("--file", required=True, help="Path to .aiws/changes/<id>/tasks.md")
    p_plan.add_argument("--explanation", default="", help="Explanation for update_plan payload")
    p_plan.set_defaults(fn=cmd_plan)

    return p


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
