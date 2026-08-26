# Requirements Changelog

本文件记录“需求变更历史”。`REQUIREMENTS.md` 始终表示“当前有效需求”，变更过程在此追踪。

规则：
- 任何需求变更必须追加一条记录（不要覆盖历史）。
- 记录应可审计：说明变更内容、原因、影响范围、关联 issues/PR。
- 不要写入 secrets。

| 日期 | 变更内容 | 原因/背景 | 影响范围（模块/接口） | 关联 issues/PR | 记录人 |
|---|---|---|---|---|---|
| 2026-08-26 | 新增 REQ-0002：线索跟进提醒自动化（到期 + 首次跟进 SLA，核心） | 现有 nextFollowUpAt 无消费机制，跟进无提醒；new 线索首响无信号 | 新建 reminder-rules / reminder-notices 集合；LeadActivities 增 reminder 枚举；新增 POST /api/v2/reminders/run；看板待办提醒点 | change/lead-followup-reminders | owner |
| YYYY-MM-DD | | | | | |

