# Handoff: lead-followup-reminders

> Archived: 2026-08-26T13:01:11Z

## 本次完成

- 支持在后台配置提醒规则（到期提醒 due / 首次跟进 SLA），由 node-cron 定时扫描命中线索。
- 命中后写 `reminder-notices`（后台"待跟进"清单）+ 追加 `LeadActivities`（`reminder` 事件），看板展示待办提醒点。
- 同一线索同一规则在未处理前不重复提醒；提醒不改变线索本身状态。

## 改动文件

- (see git log for details)

## 关键决策

- **node-cron 承载调度**：自包含、自宿主、无外部依赖；挂 `payload.config.ts` 的 `onInit`，在 Next server 进程内常驻。用 `NEXT_PHASE==='phase-production-build'` 早退护栏并 `globalThis` 哨兵防 dev HMR 重复注册。
- **新增两集合**：`reminder-rules`（规则、可配置）+ `reminder-notices`（命中记录、兼作去重与待跟进清单）。与复用单集合相比，规则与记录职责分离，读模型清晰。
- **SLA 判据用 status**：`status='new'` 且创建超 `graceHours` 即判定"首响未做"，避免多一次 activity 关联。
- **`LeadActivities.type` 增 `reminder`**：只增不改的枚举演进，时间线可追溯"已提醒"。
- **判重依据**：`reminder-notices(lead+rule+kind, status=open)` 存在即跳过，保证风暴抑制。
- **手动触发接口** `/api/v2/reminders/run`（管理员）作为可复现验证入口，与 cron 共用 `runReminderScan` 单一实现路径。

## 协同记录

- analysis: 0 file(s)
- patches: 0 file(s)
- review: 2 file(s)
  - .aiws/changes/archive/2026-08-26-lead-followup-reminders/review/quality-review.md
  - .aiws/changes/archive/2026-08-26-lead-followup-reminders/review/spec-review.md
- evidence: 1 file(s)
  - .aiws/changes/archive/2026-08-26-lead-followup-reminders/evidence/verify-before-complete.md

## 下一步建议

- 可以开始: followup-reminders-webhook（企业微信机器人通知）

## 绑定

- Change_ID: lead-followup-reminders
- Req_ID: REQ-0002
