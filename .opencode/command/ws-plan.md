---
description: 规划：生成可落盘 plan 工件
---
<!-- AIWS_MANAGED_BEGIN:opencode:ws-plan -->
# ws plan

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 若尚未进入本次 change 的工作上下文：先建立 `change/<change-id>` 分支，再生成可落盘执行计划（供 /ws-dev 执行）。

执行建议：
1) 先运行 `/ws-preflight`（对齐 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`）。
   - 若检测到 `.opencode/oh-my-opencode.json` 或当前会话明确可用 `planner-sisyphus` / `explore` / `librarian`：优先按 `packages/spec/docs/opencode-omo-adapter.md` 借用这些 agent。
   - 计划主框架优先 `planner-sisyphus`；结构探索优先 `@explore`；规范/文档查证优先 `@librarian`。
2) 若当前不在 `change/<change-id>` 分支，先调用 `aiws change start <change-id>` 建立上下文：
   - 仓库已有提交：优先 `aiws change start <change-id> --hooks --switch`
   - 仓库尚无提交 / 不满足前置条件：回退 `aiws change start <change-id> --hooks --no-switch`
3) 继续在 `change/<change-id>` 分支工作区中写后续计划文件（当前机制不创建独立 worktree）。
4) 生成或更新计划文件：`plan/YYYY-MM-DD_HH-MM-SS-<slug>.md`。
5) 计划至少包含：`Bindings`、`Goal`、`Non-goals`、`Scope`、`Plan`、`Verify`、`Risks & Rollback`、`Evidence`。
6) 若已有 `changes/<change-id>/proposal.md`，对齐 `Plan_File` / `Contract_Row` / `Evidence_Path`。
7) 完成后先运行 `aiws plan-verify`，通过再进入 `/ws-dev`。
8) 若 oMo 不可用：回退为普通 OpenCode `plan` / 当前 agent 本地规划，但仍必须落盘完整 `plan/...`。

并发矩阵指针：explorer、read-only 与证据检查可并行且无需独立分支；worker 写代码/测试/共享文件必须串行，或在独立分支/不相交写集完成后由 integrator 合并。视觉任务须在 plan/tasks 声明证据文件路径、显式模型（`aipper/qwen3` 或 `aipper/gpt-5.5`）及 evidence 回收方式；只传路径，不把图片内容放入主上下文。
<!-- AIWS_MANAGED_END:opencode:ws-plan -->

可在下方追加本项目对 OpenCode 的额外说明（托管块外内容会被保留）。
