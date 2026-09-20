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
| 2026-09-20 | 自定义端点接口行为收敛：`POST /api/leads/assign` 与 `POST /api/sites/clone` 的「记录不存在」由 `500` 改回 `404`（错误码 `LEAD_NOT_FOUND` / `ASSIGNEE_NOT_FOUND` / `SOURCE_NOT_FOUND`）；`/assign` 成功响应 `data.owner` 由填充后的用户对象收敛为裸 id（不再带出他人 `sessions[]`）；经端点写出的 `lead_activities(type=assigned)` 补齐审计 `actor`；两处 `catch` 改为记服务端日志后再回统一 500 信封 | 清理批 e2e 补齐时登记 PROB-005/006，owner 裁决「不各自立项，合并为一个改动」后随批落地；修复轮按同类模式复查端点带出 PROB-015/016 | 仅两个自定义端点的响应契约，无需求条目变更；仓内无产品侧消费方（admin UI 走 Payload 原生 REST，`grep --exclude-dir=.next` 命中只有注释与 e2e），e2e 断言由敏感键黑名单升级为键集白名单；实测 `Running 60 tests → 58 passed / 2 skipped` 与探针日志见 change 的 `evidence/verification.jsonl` 第 37–41 条 | change/cleanup-batch-20260919 | owner |

