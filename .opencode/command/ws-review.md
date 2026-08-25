---
description: 评审：提交前审计改动并落盘证据
---
<!-- AIWS_MANAGED_BEGIN:opencode:ws-review -->
# ws review

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在提交/交付前审计当前改动，对照真值文件检查是否越界，并把审计证据优先落盘到 `changes/<change-id>/review/`（若无法确定 `change-id` 再回退 `.agentdocs/tmp/review/`）。

步骤（建议）：
1) 先运行 `/ws-preflight`。
   - 若检测到 `.opencode/oh-my-opencode.json` 或当前会话明确可用 `oracle` / `explore` / `librarian`：优先按 `packages/spec/docs/opencode-omo-adapter.md` 借用这些 agent。
   - 独立审查优先 `@oracle`；diff 影响面优先 `@explore`；规范/文档上下文优先 `@librarian`。
2) 基于 `git status` / `git diff`（以及你实际运行过的测试结果），对照 `AI_PROJECT.md` 与 `REQUIREMENTS.md` 检查：
   - 是否存在越界目录改动/危险操作
   - 是否有可复现验证命令与证据
   - 是否维护了 `changes/<change-id>/` 或相关 `issues/*.csv`
   - 视觉任务是否有路径指针、显式视觉模型、`summary.md`/结构化结果/`done.signal`；reviewer 只消费这些产物，不要求主 session 读取图片本体
   - 并发写集是否满足 explorer 只读，以及 worker 写代码/测试/共享文件串行或隔离
3) 将审计落盘到（目录不存在则创建）：
   - 默认：`changes/<change-id>/review/codex-review.md`
   - 回退：`.agentdocs/tmp/review/codex-review.md`（仅在无法确定 `change-id` 时使用）
4) 若当前任务已进入“准备提交/交付/finish”的语境，继续补齐 dual review gate：
   - 运行/收敛 `/ws-spec-review`，落盘 `changes/<change-id>/review/spec-review.md`
   - 运行/收敛 `/ws-quality-review`，落盘 `changes/<change-id>/review/quality-review.md`
   - 不要把单个 `codex-review.md` 误当成 finish gate 已完成
5) 回复中输出：
   - `证据（Evidence）:` 证据文件路径
   - `主要风险（Top risks）:` 3–8 条（高→低）
   - `下一步（Next）:` 最小修复清单 + 最小验证命令
5) 若 oMo 不可用：回退为当前 agent 本地 review，不阻断流程。

安全：
- 不打印 secrets。
- 不执行破坏性命令。
<!-- AIWS_MANAGED_END:opencode:ws-review -->

可在下方追加本项目对 OpenCode 的额外说明（托管块外内容会被保留）。
