#!/usr/bin/env bash
set -euo pipefail

workspace_root="${1:-.}"
shift || true

helper_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
check_script="${helper_dir}/approval-whitelist-check.sh"

if [[ ! -x "${check_script}" && ! -f "${check_script}" ]]; then
  echo "error: missing checker: ${check_script}" >&2
  exit 2
fi

decision_json="$(bash "${check_script}" "${workspace_root}" "$@")"

python3 - "${workspace_root}" "${decision_json}" <<'PY'
import json
import os
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

workspace_root = Path(sys.argv[1]).resolve()
payload = json.loads(sys.argv[2])

out_dir = Path(os.environ.get("AIWS_OPENCODE_AUTONOMY_DIR", workspace_root / ".aiws" / "tmp" / "opencode-autonomy"))
out_dir.mkdir(parents=True, exist_ok=True)
log_file = out_dir / "approval-whitelist-exec.log"
result_file = out_dir / "approval-whitelist-exec-last.json"

decision = payload.get("decision", "manual")
command_text = str(payload.get("command", ""))

def finish(result: dict, exit_code: int) -> None:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result_file.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with log_file.open("a", encoding="utf-8") as fh:
        fh.write(
            f"[{timestamp}] decision={result.get('decision')} executed={result.get('executed')} exit_code={result.get('exit_code')} reason={result.get('reason')} command={result.get('command_signature') or '(empty)'}\n"
        )
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(exit_code)

if decision == "deny":
    finish({**payload, "executed": False, "exit_code": None, "reason": payload.get("reason", "deny_command")}, 4)

if decision != "allow":
    finish({**payload, "executed": False, "exit_code": None, "reason": payload.get("reason", "manual_review_required")}, 3)

if not command_text.strip():
    finish({**payload, "decision": "manual", "executed": False, "exit_code": None, "reason": "empty_command"}, 3)

unsafe_fragments = ["&&", "||", ";", "|", ">", "<", "$(", "`"]
if any(fragment in command_text for fragment in unsafe_fragments):
    finish({**payload, "decision": "manual", "executed": False, "exit_code": None, "reason": "unsupported_shell_syntax"}, 3)

command_args = shlex.split(command_text)
if not command_args:
    finish({**payload, "decision": "manual", "executed": False, "exit_code": None, "reason": "empty_command"}, 3)

proc = subprocess.run(
    command_args,
    cwd=str(workspace_root),
    text=True,
    capture_output=True,
    check=False,
)

result = {
    **payload,
    "executed": True,
    "exit_code": proc.returncode,
    "stdout_line_count": len(proc.stdout.splitlines()),
    "stderr_line_count": len(proc.stderr.splitlines()),
    "reason": "executed",
}

finish(result, proc.returncode)
PY
