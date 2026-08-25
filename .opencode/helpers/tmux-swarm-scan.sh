#!/usr/bin/env bash
set -euo pipefail

if ! command -v tmux >/dev/null 2>&1; then
  echo "error: tmux not found" >&2
  exit 1
fi

out_dir="${AIWS_OPENCODE_AUTONOMY_DIR:-.aiws/tmp/opencode-autonomy}"
out_file="${out_dir}/tmux-scan.json"
mkdir -p "${out_dir}"

python3 - "$out_file" <<'PY'
import json
import subprocess
import sys

out_file = sys.argv[1]

def run(cmd):
    return subprocess.run(cmd, check=True, text=True, capture_output=True).stdout

panes_raw = run(["tmux", "list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_command}\t#{pane_current_path}\t#{pane_in_mode}"]).splitlines()
panes = []
for row in panes_raw:
    target, command, current_path, in_mode = row.split("\t", 3)
    capture = run(["tmux", "capture-pane", "-t", target, "-p", "-S", "-80"])
    lowered = capture.lower()
    panes.append(
        {
            "target": target,
            "command": command,
            "current_path": current_path,
            "pane_in_mode": in_mode == "1",
            "waiting_confirm": "(y/n)" in lowered,
            "press_enter": "press enter to continue" in lowered,
            "error_like": any(token in lowered for token in ["traceback", "error", "failed", "fatal"]),
            "tail": capture.splitlines()[-20:],
        }
    )

with open(out_file, "w", encoding="utf-8") as fh:
    json.dump({"panes": panes}, fh, ensure_ascii=False, indent=2)

print(out_file)
PY
