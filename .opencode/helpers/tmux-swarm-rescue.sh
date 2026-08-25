#!/usr/bin/env bash
set -euo pipefail

if ! command -v tmux >/dev/null 2>&1; then
  echo "error: tmux not found" >&2
  exit 1
fi

out_dir="${AIWS_OPENCODE_AUTONOMY_DIR:-.aiws/tmp/opencode-autonomy}"
scan_file="${1:-${out_dir}/tmux-scan.json}"
log_file="${out_dir}/tmux-rescue.log"
mkdir -p "${out_dir}"

if [[ ! -f "${scan_file}" ]]; then
  echo "error: scan file missing: ${scan_file}" >&2
  exit 1
fi

python3 - "${scan_file}" "${log_file}" <<'PY'
import json
import subprocess
import sys
from datetime import datetime, timezone

scan_file, log_file = sys.argv[1:3]

def tmux(*args):
    subprocess.run(["tmux", *args], check=True)

with open(scan_file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

actions = []
for pane in payload.get("panes", []):
    target = str(pane.get("target", ""))
    if not target:
        continue
    if pane.get("waiting_confirm") is True:
        tmux("send-keys", "-t", target, "y", "Enter")
        actions.append((target, "confirm_yes"))
        continue
    if pane.get("press_enter") is True:
        tmux("send-keys", "-t", target, "Enter")
        actions.append((target, "press_enter"))
        continue
    if pane.get("pane_in_mode") is True:
        tmux("send-keys", "-t", target, "-X", "cancel")
        actions.append((target, "cancel_copy_mode"))

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
with open(log_file, "a", encoding="utf-8") as fh:
    for target, action in actions:
        fh.write(f"[{timestamp}] {target} {action}\n")

print(log_file)
PY
