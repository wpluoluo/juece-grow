---
description: 收尾：fast-forward 合并并把 submodule 并回目标分支后顺序 push
---
<!-- AIWS_MANAGED_BEGIN:opencode:ws-finish -->
# ws finish

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：安全把 `change/<change-id>` fast-forward 合并回目标分支，避免手输分支名导致的错误。
补充：若团队希望减少 submodule detached 的人为差异，建议在 `.gitmodules` 配置 `submodule.<name>.branch`，并在日常拉取时使用 `aiws pull`。

前置（必须）：
- 工作区干净：`git status --porcelain` 无输出（否则先 commit 或 stash）
- change 分支存在（`change/<change-id>`；也支持 `changes/`、`ws/`、`ws-change/`）
- 普通 finish 的 `validate/evidence/state` 应在 `change/<change-id>` 分支完成；真正执行 `aiws change finish` 时，先确认已在目标分支或可 fast-forward（当前机制不创建独立 worktree，见 ADR-0002）
- 若 `aiws change status <change-id>` 输出 `governance_rule: finish_resume_required`：说明 merge 已发生，只需继续 push / archive / cleanup closeout；直接运行 `aiws change finish <change-id> --push`
- 若存在 `.gitmodules`：必须为每个 submodule 配置 `submodule.<name>.branch`（否则先运行 `aiws submodule-setup` 并提交 `.gitmodules`）

步骤（建议）：
0) 若存在 `.gitmodules`，先检查 submodule branch 配置是否齐全（缺失则停止并提示 setup）：
```bash
if [[ -f .gitmodules ]]; then
  missing=0
  while read -r key sub_path; do
    name="${key#submodule.}"; name="${name%.path}"
    b="$(git config --file .gitmodules --get "submodule.${name}.branch" 2>/dev/null || true)"
    if [[ -z "${b:-}" ]]; then
      echo "error: missing .gitmodules submodule.${name}.branch (path=${sub_path})"
      missing=1
    fi
  done < <(git config --file .gitmodules --get-regexp '^submodule\\..*\\.path$' 2>/dev/null || true)
  if [[ "$missing" -ne 0 ]]; then
    echo "hint: run aiws submodule-setup (and commit .gitmodules), then retry"
    exit 2
  fi
fi
```
1) 先运行 `/ws-preflight`（确保真值文件齐全）。
2) 先运行 `aiws change status <change-id>`，优先看稳定字段 `governance_rule:`。
   - 若为 `finish_resume_required`：直接跳到步骤 3 执行 `aiws change finish <change-id> --push`
   - 若不是该值：按普通 finish 继续；不要依赖自然语言提示句做分支判断
2.1) 普通 finish 时，`aiws validate . --stamp` / `aiws change evidence <change-id>` / `aiws change state <change-id> --write` 应在 `change/<change-id>` 分支完成。
   - 如果已经在目标分支，且 `governance_rule` 不是 `finish_resume_required`，不要在这里跑 `aiws validate . --stamp`；先切回 `change/<change-id>` 分支，或先跑 `aiws verify-bc`
3) 若不存在 `.gitmodules`，或 submodules 已按顺序处理完成，优先直接执行最小收尾闭环：
   - `aiws change finish <change-id> --push`
   - 若当前就在 `change/<change-id>` 分支上，也可省略 `<change-id>`
   - 该命令会在 fast-forward 合并成功后 push 目标分支；默认优先使用 upstream 配置（`branch.<name>.remote` + `branch.<name>.merge`），只有在你明确知道要推向别的 remote 时才追加 `--remote <name>`
   - `aiws change finish <change-id> --push` 会合并回目标分支；不再创建独立 worktree
   - AI 入口执行前，应先向用户说明将要 push 的 remote/branch；显式传入 `--push` 即视为确认
4) 若提示无法 fast-forward：先在 change 分支里 `git rebase <target-branch>`，再重试 `aiws change finish --push`。
5) 若需要先处理 submodules，则按顺序处理每个 submodule（减少 detached；再 push）：
   - 先显式解析 base branch，不要用当前分支名替代：
     - `python3 - <<'PY'`
     - `import json, pathlib; meta = pathlib.Path("changes") / "<change-id>" / ".ws-change.json"; print((json.loads(meta.read_text(encoding="utf-8")).get("base_branch") or "").strip())`
     - `PY`
   - 发现 submodules：`git config --file .gitmodules --get-regexp '^submodule\\..*\\.path$'`
   - 对每个 `<sub_path>`：
     - 读取 superproject 当前 gitlink：`git rev-parse "HEAD:<sub_path>"`
     - 目标分支真值：`changes/<change-id>/submodules.targets`；若条目里分支写 `.`，则展开为刚才解析出的 `base_branch`
     - 生成/检查 `submodules.targets` 时，detached HEAD 默认建议取 `.gitmodules` 的 `submodule.<name>.branch`；已附着在本地分支时默认建议取当前分支；这些都只是预填建议，不是 finish/push 的运行时真值
     - 不要直接切 `change/<change-id>` / `main` / `master` 来解 detached
     - 用目标分支挂回：`git -C "<sub_path>" checkout <target-branch>`
     - 仅当 `<gitlink-sha>` 属于 `origin/<target-branch>` 历史时才允许 push；否则停止并人工处理分叉
     - push（只允许 fast-forward）：`git -C "<sub_path>" push origin "<gitlink-sha>:refs/heads/<target-branch>"`
6) 任一 submodule 不满足 fast-forward 条件时立即停止（不要继续 push 主仓库）。
7) submodules 全部成功后，再回到主仓库执行：
   - `aiws change finish <change-id> --push`
8) `aiws change finish --push` 成功后会自动归档并生成 handoff；只有历史/异常场景才需要手工运行 `aiws change archive <change-id>`。
9) 输出本轮 change 的中文工作摘要，包含：
   - 目标：解决了什么问题
   - 改动范围：改了哪些文件/模块（可引用 handoff 或 evidence）
   - 验证结果：构建/测试/LSP/validate 等关键门禁的结果

安全：
- push 前先输出状态并说明远端/分支。
- 不执行破坏性命令。
<!-- AIWS_MANAGED_END:opencode:ws-finish -->

---
description: 收尾：fast-forward 合并并把 submodule 并回目标分支后顺序 push
---
# ws-finish

Thin CLI wrapper. Delegates to `aiws finish`.

```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws finish
elif command -v aiws >/dev/null 2>&1; then
  aiws finish
else
  npx @aipper/aiws finish
fi
```

可在下方追加本项目对 OpenCode 的额外说明（托管块外内容会被保留）。
