# changes/（变更工件目录）

本目录用于保存每一次“需求交付 / 问题修复”的可审计产物，避免关键约定只存在于聊天记录。

真值文件仍然是：
- `AI_PROJECT.md`（约束真值）
- `AI_WORKSPACE.md`（运行/测试真值）
- `REQUIREMENTS.md`（需求/验收真值）

建议结构：
```
.aiws/changes/
  README.md
  <change-id>/
    proposal.md
    design.md        # 可选
    tasks.md
    analysis/        # 可选：外部/子 agent 的分析结论（只读输入）
    patches/         # 可选：外部/子 agent 的 patch 草案（不自动应用）
    review/          # 可选：多个 reviewer 的审查结果
    evidence/        # 推荐：交付前收敛出的持久证据
    .ws-change.json
  archive/
    YYYY-MM-DD-<change-id>/
```

协同工件约定：
- `analysis/`：存放委托分析报告、调研结论、备选方案。默认视为“只读输入”，不要把它当作已实施结果。
- `patches/`：存放 patch / diff 草案。主 agent 或人工必须先审查，再决定是否应用；不要把该目录内容视为已经进代码库。
- `review/`：允许多名 reviewer 并行落盘，例如 `codex-review.md`、`reviewer-a.md`、`reviewer-b.md`。
- `evidence/`：存放 validate 总结、delivery summary、collaboration summary 等可持久引用的交付证据。
- `aiws change new <change-id>` 会预创建以上目录，减少临时约定漂移。

常用命令（推荐使用 `aiws`；不依赖 dotfiles）：
- `aiws change start <change-id>`（默认：切到 `change/<change-id>` 并初始化工件目录）
- `aiws change start <change-id> --no-switch`（superproject + submodule 场景：不切分支，仅准备 `change/<change-id>` 分支与工件目录）
- `aiws change start <change-id> --switch`（显式允许切换 superproject 分支；仅切 superproject，不递归切换 submodule）
- `aiws change finish <change-id>`（安全合并：fast-forward 合并回目标分支；在 `change/<change-id>` 分支上执行时会尝试使用 `.ws-change.json` 的 `base_branch` 作为目标分支）
- `aiws change finish <change-id> --push [--remote <name>]`（最小收尾闭环：若存在 `.gitmodules` 则先按 `.aiws/changes/<id>/submodules.targets` 顺序 push submodule，再 push 目标分支；默认优先遵循 upstream 配置；push 成功后把 `.aiws/changes/<id>/` 自动归档到 `.aiws/changes/archive/...`，同时生成 `handoff.md` 与 archive commit）
- 已 archive 的 `change/<change-id>` 才算真正终态；若只是"已 finish 但仍有 active `.aiws/changes/<id>/` 未归档"，默认应重跑 `aiws change finish <change-id> --push` 续完收尾，而不是继续开发或复用旧 branch 做新需求。
- `aiws change new <change-id>`
- `aiws change list`
- `aiws change status <change-id>`
- `aiws change next <change-id>`
- `aiws change validate <change-id>`
- `aiws change sync <change-id>`
- `aiws change archive <change-id>`（手工恢复 / 历史兼容入口；标准链路一般不需要单独执行）
- `aiws change evidence <change-id>`（收敛 review / validate / collaboration summary 到 `.aiws/changes/<id>/evidence/`）

Active change（推荐，团队共享）：
- 使用分支名声明当前变更：`change/<change-id>`（也支持 `changes/`、`ws/`、`ws-change/`）
- 切到该分支后，可省略 `<change-id>` 执行：`aiws change status|next|validate|sync`

计划质量门（推荐，执行前）：
- 先生成计划：`$ws-plan`（若尚未进入 `change/<change-id>` 上下文，应先由它调用 `aiws change start <change-id>` 建立分支，再在该上下文内写 `.aiws/plan/...`）
- 再执行计划质检：`aiws plan-verify`
- 最后进入实现：`$ws-dev`
- 若 `$ws-plan` 创建了独立 `change/<change-id>` 分支，后续 `aiws plan-verify` / `$ws-dev` / `$ws-finish` 都应优先在该分支内继续
- 目标：确保计划具备主索引绑定、步骤不过长、验证命令可复现且有预期结果

模板覆盖（可选）：
- 在工作区创建 `.aiws/changes/templates/` 可覆盖默认模板：
  - `.aiws/changes/templates/proposal.md`
  - `.aiws/changes/templates/tasks.md`
  - `.aiws/changes/templates/design.md`
- 快速初始化模板：`aiws change templates init`
- 查看模板来源：`aiws change templates which`

注意：
- 不要把任何 secrets 写进 proposal/design/tasks（账号、token、内网地址等用本地私有文件/环境变量）。
- 若真值文件（`AI_PROJECT.md` / `AI_WORKSPACE.md` / `REQUIREMENTS.md`）在变更期间发生变化，严格校验/归档会要求先运行 `aiws change sync <change-id>` 确认基线。

Hooks/CI（推荐，硬约束）：
- 工作区会安装 `.githooks/{commit-msg,pre-commit,pre-push}`：
  - `commit-msg`：默认行为按仓库角色区分
    - superproject / root 仓库（存在 `.gitmodules`）：默认 `off`，允许自由 commit message
    - submodule / 普通仓库：默认 `warn`，提示优先使用中文 commit message
    - 若执行 `git config aiws.commitMessagePolicy strict`，则会拒绝全英文首行（`Merge/Revert/fixup!/squash!` 例外）
  - `pre-commit` / `pre-push`：默认执行 `aiws validate .`
- 还会安装门禁脚本（`.aiws/tools/ws_change_check.py`、`.aiws/tools/requirements_contract.py`）。
- **启用 hooks 需要本地配置**（不会自动提交到 git）：
  - 直接启用：`git config core.hooksPath .githooks`
  - 或使用：`aiws hooks install .`（等价）
- CI 建议增加一步（对 PR 分支执行）：`aiws validate .`。
- 紧急跳过（不推荐）：`WS_CHANGE_HOOK_BYPASS=1 ...`（CI 不应允许跳过）。

合并建议（减少人为 merge 引入新问题）：
- 优先使用 fast-forward 合并：
  - 完成后在目标分支（例如 `main`）执行：`aiws change finish <change-id>`（等价于 `git merge --ff-only change/<change-id>`）
  - 若还要顺手 push：`aiws change finish <change-id> --push`
  - 若失败：先在 change 分支 `git rebase main`（或更新 main 后再 rebase），再重试 `--ff-only`

协同交付建议：
- 委托分析先落到 `.aiws/changes/<id>/analysis/`，由主 agent 在 `ws-review` 或 `review/*.md` 中收敛结论。
- patch 草案先落到 `.aiws/changes/<id>/patches/`，未经审查不要直接应用。
- 交付前建议执行：`aiws change evidence <change-id>`，让 `delivery-summary` 与 `collaboration-summary` 一起落到 `.aiws/changes/<id>/evidence/`。
- finish 自动归档后生成的 `handoff.md` 会包含协同工件摘要，便于下一次会话继续接力。
