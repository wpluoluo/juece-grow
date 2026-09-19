# Requirements Changelog

本文件记录“需求变更历史”。`REQUIREMENTS.md` 始终表示“当前有效需求”，变更过程在此追踪。

规则：
- 任何需求变更必须追加一条记录（不要覆盖历史）。
- 记录应可审计：说明变更内容、原因、影响范围、关联 issues/PR。
- 不要写入 secrets。

| 日期 | 变更内容 | 原因/背景 | 影响范围（模块/接口） | 关联 issues/PR | 记录人 |
|---|---|---|---|---|---|
| 2026-08-26 | 新增 REQ-0002：线索跟进提醒自动化（到期 + 首次跟进 SLA，核心） | 现有 nextFollowUpAt 无消费机制，跟进无提醒；new 线索首响无信号 | 新建 reminder-rules / reminder-notices 集合；LeadActivities 增 reminder 枚举；新增 POST /api/v2/reminders/run；看板待办提醒点 | change/lead-followup-reminders | owner |
| 2026-09-19 | 同步 REQUIREMENTS.md 真值：REQ-0001 / REQ-0002 由 Backlog 整体移入「## 已完成」（标题加 ✓ 前缀），13 条验收标准全部勾选为 [x]，并各追加一行复验证据指针；合并原第 27、54 行重复的 `## Backlog` 标题为唯一空区 | 合同 requirements-issues.jsonl 中两条 Spec_Status=READY / Impl_Status=DONE 且 change 已归档于 2026-08-26，根 REQUIREMENTS.md 未同步造成真值漂移 | 文档/合同，无代码与接口变更；复验证据路径已声明，结论待 aiws verify-bc 收口 | change/cleanup-batch-20260919 | owner |

