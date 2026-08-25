---
description: 默认 workflow router：先判定阶段，再进入具体 ws-* 入口
---
<!-- AIWS_MANAGED_BEGIN:opencode:using-aiws -->
# using aiws

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 把当前任务先路由到正确的 AIWS workflow，而不是直接跳进实现。

执行建议：
1) 先读取 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`。
   - 若检测到 `.opencode/oh-my-opencode.json`：输出 `OpenCode mode: oMo-enabled`，并注明后续会优先借用 `planner-sisyphus` / `explore` / `librarian` / `oracle`
   - 若未检测到：输出 `OpenCode mode: standard-opencode`
2) 若缺失任一真值文件：先 `/ws-preflight`，必要时运行 `aiws init .`，不要继续实现。
3) 若任务意图、归因或验证入口不明确：先提 1-3 个关键澄清问题并停止。
4) 路由规则：
   - 需求/验收/合同变更：`/ws-req-review`
   - 中大型实现或需要 change：`/ws-plan`
   - 小步明确实现：`/ws-dev`（若是 simple/local 单点修复，可显式进入 `/ws-dev-lite`）
   - 评审/审计：`/ws-review`
   - finish / merge / push / cleanup：`/ws-finish`
   - handoff / archive summary：`/ws-handoff`
5) 输出 `OpenCode mode:` / `Task intent:` / `Binding:` / `Route:` / `Why:` / `Next:`。
6) 若 `Route: ws-dev` 且任务属于 simple/local 单点修复：`Next` 可显式建议 `/ws-dev-lite`。
7) 除非用户只要路由判断，否则给出 route 后继续遵循对应入口的契约。
<!-- AIWS_MANAGED_END:opencode:using-aiws -->

可在下方追加本项目对 OpenCode 的额外说明（托管块外内容会被保留）。
