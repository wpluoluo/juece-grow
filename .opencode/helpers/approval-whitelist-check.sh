#!/usr/bin/env bash
set -euo pipefail

workspace_root="${1:-.}"
shift || true

command_text=""
decision_kind="unknown"
paths=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --command)
      command_text="${2:-}"
      shift 2
      ;;
    --kind)
      decision_kind="${2:-unknown}"
      shift 2
      ;;
    --path)
      paths+=("${2:-}")
      shift 2
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

python3 - "$workspace_root" "$command_text" "$decision_kind" "${paths[@]-}" <<'PY'
import json
import os
import shlex
import sys
from datetime import datetime, timezone
from fnmatch import fnmatch
from pathlib import Path

workspace_root = Path(sys.argv[1]).resolve()
command_text = sys.argv[2]
decision_kind = sys.argv[3]
paths = sys.argv[4:]

config_path = workspace_root / ".opencode" / "oh-my-opencode.json"
out_dir = Path(os.environ.get("AIWS_OPENCODE_AUTONOMY_DIR", workspace_root / ".aiws" / "tmp" / "opencode-autonomy"))
out_dir.mkdir(parents=True, exist_ok=True)
log_file = out_dir / "approval-whitelist.log"
result_file = out_dir / "approval-whitelist-last.json"

decision = "manual"
reason = "missing_policy"
policy = None

def normalize_signature(command: str) -> str:
    if not command.strip():
        return ""
    tokens = shlex.split(command)
    if not tokens:
        return ""
    if tokens[0] == "git" and len(tokens) >= 2:
        return f"git {tokens[1]}"
    return tokens[0]

if config_path.exists():
    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        payload = {
            "workspace_root": str(workspace_root),
            "config_path": str(config_path),
            "command": command_text,
            "command_signature": normalize_signature(command_text) if command_text.strip() else "",
            "kind": decision_kind,
            "paths": paths,
            "decision": "manual",
            "reason": "invalid_config_json",
        }
        result_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with log_file.open("a", encoding="utf-8") as fh:
            fh.write(f"[{timestamp}] decision=manual reason=invalid_config_json kind={decision_kind} signature={(payload['command_signature'] or '(empty)')} paths={paths}\n")
        print(json.dumps(payload, ensure_ascii=False))
        sys.exit(0)
    policy = raw.get("aiws", {}).get("autonomy", {}).get("approval_whitelist", {})

def path_matches(target: str, patterns: list[str]) -> bool:
    normalized = target.replace("\\", "/")
    for pattern in patterns:
        if fnmatch(normalized, pattern):
            return True
        if pattern.endswith("/") and fnmatch(normalized, f"{pattern}*"):
            return True
    return False

command_signature = normalize_signature(command_text)

payload = {
    "workspace_root": str(workspace_root),
    "config_path": str(config_path),
    "command": command_text,
    "command_signature": command_signature,
    "kind": decision_kind,
    "paths": paths,
    "decision": decision,
    "reason": reason,
}

if policy and policy.get("enabled") is True:
    deny_commands = [item for item in policy.get("deny_commands", []) if isinstance(item, str) and item.strip()]
    deny_paths = [item for item in policy.get("deny_paths", []) if isinstance(item, str) and item.strip()]
    read_only_commands = [item for item in policy.get("read_only_commands", []) if isinstance(item, str) and item.strip()]
    write_allow_paths = [item for item in policy.get("write_allow_paths", []) if isinstance(item, str) and item.strip()]
    SAFE_WHITELIST_DIRS = ["/tmp/", "/var/tmp/", ".aiws/tmp/", ".agentdocs/tmp/", "node_modules/.cache/"]
    host_permission_mode = policy.get("host_permission_mode", "")

    if decision_kind == "host-permission":
        decision = "manual"
        reason = f"host_permission_mode={host_permission_mode or 'missing'}"
    elif command_signature in deny_commands:
        if (
            decision_kind == "write"
            and paths
            and all(
                path_matches(path, write_allow_paths) or path_matches(path, SAFE_WHITELIST_DIRS)
                for path in paths
            )
        ):
            decision = "allow"
            reason = "deny_command_path_whitelisted"
        else:
            decision = "deny"
            reason = "deny_command"
    elif any(path_matches(path, deny_paths) for path in paths):
        decision = "deny"
        reason = "deny_path"
    elif decision_kind == "read" and command_signature in read_only_commands:
        decision = "allow"
        reason = "read_only_command"
    elif decision_kind == "write" and paths and all(path_matches(path, write_allow_paths) for path in paths):
        decision = "allow"
        reason = "write_allow_path"
    else:
        decision = "manual"
        reason = "policy_requires_manual_review"

    payload["host_permission_mode"] = host_permission_mode
    payload["policy_mode"] = policy.get("mode", "")

payload["decision"] = decision
payload["reason"] = reason
result_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
with log_file.open("a", encoding="utf-8") as fh:
    fh.write(f"[{timestamp}] decision={decision} reason={reason} kind={decision_kind} signature={command_signature or '(empty)'} paths={paths}\n")

print(json.dumps(payload, ensure_ascii=False))
PY
