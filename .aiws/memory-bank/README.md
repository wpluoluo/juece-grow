# Memory Bank（工作区上下文）

目的：给 OpenCode/Codex/Claude 一个“固定且可持续更新”的上下文集合，避免每次会话重新讲一遍导致跑偏。

在你的工作区中：
- `REQUIREMENTS.md` 仍是**需求真值**（不要复制到这里）。
- `AI_PROJECT.md` / `AI_WORKSPACE.md` 是**边界与运行真值**。
- 本目录补齐的是“实现过程中的稳定上下文”（更偏工程视角）。

建议规则：
- 改代码前：先看 `REQUIREMENTS.md` + `AI_PROJECT.md` + `AI_WORKSPACE.md`，再结合本目录的 `architecture.md`/`progress.md`。
- 每次完成一个可验证的小步：更新 `progress.md`（写清：做了什么、证据路径、下一步）。
- 发生重大结构变化：更新 `architecture.md`（只写高层关系，不要堆细节）。
