#!/usr/bin/env bash
set -euo pipefail

workspace_root="${1:-.}"
shift || true

out_dir="${AIWS_OPENCODE_AUTONOMY_DIR:-${workspace_root}/.aiws/tmp/opencode-autonomy}"
queue_file="${out_dir}/approval-watchdog-queue.jsonl"
once=false
poll_ms=2000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --queue)
      queue_file="${2:-}"
      shift 2
      ;;
    --once)
      once=true
      shift
      ;;
    --poll-ms)
      poll_ms="${2:-2000}"
      shift 2
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

helper_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
runner_script="${helper_dir}/approval-whitelist-run.sh"

python3 - "$workspace_root" "$queue_file" "$runner_script" "$poll_ms" "$once" <<'PY'
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

workspace_root = Path(sys.argv[1]).resolve()
queue_file = Path(sys.argv[2]).resolve()
runner_script = Path(sys.argv[3]).resolve()
poll_ms = max(int(sys.argv[4]), 100)
once = sys.argv[5].lower() == "true"

out_dir = queue_file.parent
out_dir.mkdir(parents=True, exist_ok=True)
results_file = out_dir / "approval-watchdog-results.jsonl"
state_file = out_dir / "approval-watchdog-state.json"
log_file = out_dir / "approval-watchdog.log"

def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def load_state() -> dict:
    if not state_file.exists():
        return {"processed_ids": [], "last_run_at": None, "processed_count": 0}
    return json.loads(state_file.read_text(encoding="utf-8"))

def save_state(state: dict) -> None:
    state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def append_log(message: str) -> None:
    with log_file.open("a", encoding="utf-8") as fh:
        fh.write(f"[{now()}] {message}\n")

def normalize_entry(raw: dict, index: int) -> dict:
    entry_id = str(raw.get("id") or f"queue-{index}")
    kind = str(raw.get("kind") or "unknown")
    command = str(raw.get("command") or "")
    paths = raw.get("paths") if isinstance(raw.get("paths"), list) else []
    paths = [str(item) for item in paths if str(item).strip()]
    return {"id": entry_id, "kind": kind, "command": command, "paths": paths}

def run_entry(entry: dict) -> dict:
    args = ["bash", str(runner_script), str(workspace_root), "--kind", entry["kind"], "--command", entry["command"]]
    for path in entry["paths"]:
        args.extend(["--path", path])
    proc = subprocess.run(args, cwd=str(workspace_root), text=True, capture_output=True, check=False)
    stdout = proc.stdout.strip()
    payload = json.loads(stdout) if stdout else {}
    result = {
        "id": entry["id"],
        "queued_kind": entry["kind"],
        "queued_command": entry["command"],
        "queued_paths": entry["paths"],
        "runner_exit_code": proc.returncode,
        "result": payload,
        "processed_at": now(),
    }
    with results_file.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(result, ensure_ascii=False) + "\n")
    append_log(
        f"id={entry['id']} exit_code={proc.returncode} decision={payload.get('decision', 'unknown')} executed={payload.get('executed', False)}"
    )
    return result

def process_pending() -> int:
    state = load_state()
    processed_ids = set(str(item) for item in state.get("processed_ids", []))
    processed_now = 0
    if not queue_file.exists():
        state["last_run_at"] = now()
        save_state(state)
        append_log("queue_missing")
        return processed_now
    lines = queue_file.read_text(encoding="utf-8").splitlines()
    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue
        raw = json.loads(stripped)
        entry = normalize_entry(raw, index)
        if entry["id"] in processed_ids:
            continue
        run_entry(entry)
        processed_ids.add(entry["id"])
        processed_now += 1
    state["processed_ids"] = sorted(processed_ids)
    state["processed_count"] = len(processed_ids)
    state["last_run_at"] = now()
    save_state(state)
    append_log(f"cycle_complete processed_now={processed_now}")
    return processed_now

if once:
    process_pending()
    print(state_file)
    sys.exit(0)

append_log(f"watchdog_start poll_ms={poll_ms}")
try:
    while True:
        process_pending()
        time.sleep(poll_ms / 1000.0)
except KeyboardInterrupt:
    append_log("watchdog_stop keyboard_interrupt")
    print(state_file)
    sys.exit(0)
PY
