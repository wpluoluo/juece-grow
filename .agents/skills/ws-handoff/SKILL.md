---
name: ws-handoff
description: 使用时机：需要将当前工作交接给后续 session 时。触发词：交接、handoff、转交、session 交接。注意：handoff 应在 finish 归档后执行。
---

# ws-handoff

Thin skill wrapper. Delegates to `aiws handoff`. See `aiws handoff --help` for details.

> aiws CLI：参考 `_shared/run-aiws.md`

## 方法论（引用 mattpocock `$handoff`）

> 执行细节引用 `$handoff`（mattpocock）：`aiws handoff` 生成 handoff 文档正文时，按完整方法论执行（`.agents/skills/handoff/SKILL.md`，pi 镜像 `.pi/skills/handoff/SKILL.md`），不复制正文。

- 触发指引：会话压缩成交接文档时，不重复已在其他工件（specs/plans/ADRs/issues/commits/diffs）中的内容，按路径/URL 引用；敏感信息（API key/密码/PII）脱敏；输出含 "suggested skills" 段，建议后续 session 应调用的技能。
- 注入点（AIWS 约束叠加）：真值/归因/产物由 AIWS 保证（change/<id> 工件、handoff-evidence.md 落盘），方法论只负责"怎么组织正文"；完成判定不降低——`aiws handoff` exit 0 且含 handoff-evidence.md 才算完成。

## 完成判定

- `aiws handoff` 执行成功（exit 0）：handoff 文档已生成（含 handoff-evidence.md）。
