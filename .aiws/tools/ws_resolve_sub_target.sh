#!/usr/bin/env bash
# ws_resolve_sub_target.sh — Resolve the target branch & remote for a submodule path.
#
# Usage:
#   source .aiws/tools/ws_resolve_sub_target.sh
#   ws_resolve_sub_target <sub_path> <sub_name> <targets_file> <base_branch>
#
# Outputs two variables: _resolved_branch and _resolved_remote.
# Returns 0 on success, 2 on failure (with error printed to stderr).

ws_resolve_sub_target() {
  local sub_path="$1" sub_name="$2" targets="$3" base_branch="$4"
  _resolved_branch=""
  _resolved_remote=""

  # Priority 1: .aiws/changes/<id>/submodules.targets (per-change override)
  local override=""
  if [[ -f "${targets}" ]]; then
    override="$(awk -v p="${sub_path}" '
      $1==p && $0 !~ /^[[:space:]]*#/ {
        b=$2; r=$3;
        if (r=="") r="origin";
        if (b!="") { print b " " r; exit }
      }
    ' "${targets}" 2>/dev/null || true)"
  fi

  if [[ -n "${override:-}" ]]; then
    _resolved_branch="${override%% *}"
    _resolved_remote="${override#* }"
    if [[ "${_resolved_branch:-}" == "." ]]; then _resolved_branch="${base_branch}"; fi
  else
    # Priority 2: .gitmodules submodule.<name>.branch
    local cfg_branch
    cfg_branch="$(git config --file .gitmodules --get "submodule.${sub_name}.branch" 2>/dev/null || true)"
    if [[ "${cfg_branch:-}" == "." ]]; then cfg_branch="${base_branch}"; fi
    _resolved_branch="${cfg_branch}"
    _resolved_remote="origin"
  fi

  if [[ -z "${_resolved_branch:-}" ]]; then
    echo "error: cannot resolve target branch for submodule path=${sub_path}" >&2
    echo "hint: add an entry to ${targets} (preferred for multi-channel), or set .gitmodules submodule.<name>.branch" >&2
    return 2
  fi
  return 0
}
