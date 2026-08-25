#!/usr/bin/env bash
# ws-plan: generate submodules.targets for the current change
# Usage: bash ws-plan-gen-submodule-targets.sh <change-id>
set -euo pipefail

change_id="${1:?missing change_id}"
targets=".aiws/changes/${change_id}/submodules.targets"

mkdir -p ".aiws/changes/${change_id}"

if [[ -f "${targets}" ]]; then
  bak="${targets}.bak.$(date -u +%Y%m%d-%H%M%SZ)"
  cp "${targets}" "${bak}"
  echo "info: backup: ${bak}"
fi

: > "${targets}"
echo "# path<TAB>target_branch<TAB>remote(optional, default=origin)" >> "${targets}"

while read -r key sub_path; do
  name="${key#submodule.}"; name="${name%.path}"
  b="$(git config --file .gitmodules --get "submodule.${name}.branch" 2>/dev/null || true)"
  [[ "${b:-}" == "." ]] && b="$(git branch --show-current)"  # '.' means "follow superproject branch"
  printf "%s\t%s\t%s\n" "${sub_path}" "${b:-<fill-me>}" "origin" >> "${targets}"
done < <(git config --file .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null || true)

echo "ok: wrote ${targets}"
