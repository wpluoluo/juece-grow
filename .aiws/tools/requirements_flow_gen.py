#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


FLOW_SPEC_BEGIN = "<!-- FLOW_SPEC_BEGIN -->"
FLOW_SPEC_END = "<!-- FLOW_SPEC_END -->"


SCENARIO_JSONL_FIELDS = [
    "Scenario_ID",
    "Title",
    "Steps",
    "Status",
    "Evidence",
    "Notes",
    "Created_At",
    "Updated_At",
]

# Steps is stored as a JSON array of strings in JSONL.
ARRAY_FIELDS = {"Steps"}


@dataclass(frozen=True)
class FlowStep:
    method: str
    path: str
    name: str = ""


@dataclass(frozen=True)
class Flow:
    flow_id: str
    title: str
    steps: Tuple[FlowStep, ...]
    notes: str = ""


def _now_utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def extract_flow_spec_json(requirements_text: str) -> Dict[str, Any]:
    if FLOW_SPEC_BEGIN not in requirements_text or FLOW_SPEC_END not in requirements_text:
        raise ValueError(f"missing flow spec markers: {FLOW_SPEC_BEGIN} / {FLOW_SPEC_END}")
    body = requirements_text.split(FLOW_SPEC_BEGIN, 1)[1].split(FLOW_SPEC_END, 1)[0]
    start = body.find("```")
    if start == -1:
        raise ValueError("missing fenced code block inside flow spec markers")
    fence = body[start:]
    lines = fence.splitlines()
    if not lines:
        raise ValueError("empty fenced code block")
    header = lines[0].strip().lower()
    if not header.startswith("```"):
        raise ValueError("invalid fenced code block header")
    if "json" not in header:
        raise ValueError("flow spec code block must be ```json")
    payload_lines: List[str] = []
    for ln in lines[1:]:
        if ln.strip().startswith("```"):
            break
        payload_lines.append(ln)
    raw = "\n".join(payload_lines).strip()
    if not raw:
        raise ValueError("empty json in flow spec")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("flow spec json must be an object")
    return data


def parse_flows(data: Dict[str, Any]) -> List[Flow]:
    flows_raw = data.get("flows")
    if flows_raw is None:
        return []
    if not isinstance(flows_raw, list):
        raise ValueError("flow spec 'flows' must be a list")

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
        if not isinstance(steps_raw, list) or not steps_raw:
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
            out.append(Flow(flow_id=flow_id, title=title, steps=tuple(steps), notes=notes))
    return out


def _slug(text: str) -> str:
    out = []
    for ch in text:
        if ch.isalnum() or ch in ("_", "-"):
            out.append(ch)
        else:
            out.append("_")
    s = "".join(out).strip("_")
    return s[:64] if s else "flow"


def render_mermaid(flows: List[Flow]) -> str:
    lines: List[str] = []
    lines.append("flowchart TD")
    if not flows:
        lines.append('  empty["No flows defined in REQUIREMENTS.md"]')
        return "\n".join(lines) + "\n"

    for flow in flows:
        fid = _slug(flow.flow_id)
        title = flow.title.replace('"', "'")
        lines.append(f'  subgraph {fid}["{flow.flow_id}: {title}"]')
        prev_node: Optional[str] = None
        for i, step in enumerate(flow.steps, start=1):
            label = f"{step.method} {step.path}".replace('"', "'")
            node = f"{fid}_{i}"
            lines.append(f'    {node}["{label}"]')
            if prev_node:
                lines.append(f"    {prev_node} --> {node}")
            prev_node = node
        lines.append("  end")
    return "\n".join(lines) + "\n"


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
            rows.append({k: _norm(k, data.get(k)) for k in SCENARIO_JSONL_FIELDS})
    return rows


def _write_jsonl_rows(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            record = {k: _norm(k, r.get(k)) for k in SCENARIO_JSONL_FIELDS}
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def sync_scenario_jsonl(*, jsonl_path: Path, flows: List[Flow], generated_at: str) -> None:
    existing = _read_jsonl_rows(jsonl_path)
    existing_by_id: Dict[str, Dict[str, Any]] = {}
    for r in existing:
        sid = (r.get("Scenario_ID", "") or "").strip()
        if sid:
            existing_by_id[sid] = r

    out_rows: List[Dict[str, Any]] = []
    used_ids: Set[str] = set()

    for flow in flows:
        sid = flow.flow_id.strip()
        used_ids.add(sid)
        prev = existing_by_id.get(sid)
        steps = [f"{s.method} {s.path}".strip() for s in flow.steps]
        created_at = (prev.get("Created_At", "") if prev else "").strip() or generated_at
        status = (prev.get("Status", "") if prev else "").strip() or "TODO"
        notes = (prev.get("Notes", "") if prev else "").strip()
        evidence = (prev.get("Evidence", "") if prev else "").strip()
        out_rows.append(
            {
                "Scenario_ID": sid,
                "Title": flow.title,
                "Steps": steps,
                "Status": status,
                "Evidence": evidence,
                "Notes": notes,
                "Created_At": created_at,
                "Updated_At": generated_at,
            }
        )

    for r in existing:
        sid = (r.get("Scenario_ID", "") or "").strip()
        if not sid or sid in used_ids:
            continue
        out_rows.append(
            {
                "Scenario_ID": sid,
                "Title": (r.get("Title", "") or "").strip(),
                "Steps": r.get("Steps", []) or [],
                "Status": (r.get("Status", "") or "").strip(),
                "Evidence": (r.get("Evidence", "") or "").strip(),
                "Notes": (r.get("Notes", "") or "").strip(),
                "Created_At": (r.get("Created_At", "") or "").strip() or generated_at,
                "Updated_At": (r.get("Updated_At", "") or "").strip(),
            }
        )

    _write_jsonl_rows(jsonl_path, out_rows)


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description="Generate concise API flow diagram + scenario JSONL from REQUIREMENTS.md FlowSpec")
    p.add_argument("--workspace", default=".", help="workspace root")
    p.add_argument("--requirements", default="REQUIREMENTS.md", help="requirements markdown path (relative to workspace)")
    p.add_argument("--out-mermaid", default="docs/api-flow.mmd", help="output mermaid file (relative to workspace)")
    p.add_argument("--out-jsonl", default=".aiws/issues/server-scenario-issues.jsonl", help="output scenario JSONL (relative to workspace)")
    args = p.parse_args(argv)

    root = Path(args.workspace).resolve()
    req_path = (root / args.requirements).resolve()
    if not req_path.exists():
        raise SystemExit(f"missing requirements file: {req_path}")

    data = extract_flow_spec_json(_read_text(req_path))
    flows = parse_flows(data)

    generated_at = _now_utc()
    mermaid_path = (root / args.out_mermaid).resolve()
    mermaid_path.parent.mkdir(parents=True, exist_ok=True)
    mermaid_path.write_text(render_mermaid(flows), encoding="utf-8", errors="replace")

    jsonl_path = (root / args.out_jsonl).resolve()
    sync_scenario_jsonl(jsonl_path=jsonl_path, flows=flows, generated_at=generated_at)

    print(f"OK: wrote {mermaid_path.relative_to(root)}")
    print(f"OK: wrote {jsonl_path.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))
