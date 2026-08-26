---
title: 线索跟进提醒自动化
created: '2026-08-26T12:42:36.019Z'
updated: '2026-08-26T12:42:36.020Z'
summary: >-
  线索跟进自动化 change 完成。改动：新增 reminder-rules/reminder-notices 两集合 + lead-activities 增 reminder 事件；node-cron 调度 +
  runReminderScan 判重落写；新增 POST /api/v2/reminders/run（管理员）。关键决策：构建期不启定时器（NEXT_PHASE 早退 + glob...
disclosure: boot
tags:
  - reminders
  - node-cron
  - lead
---
线索跟进自动化 change 完成。改动：新增 reminder-rules/reminder-notices 两集合 + lead-activities 增 reminder 事件；node-cron 调度 + runReminderScan 判重落写；新增 POST /api/v2/reminders/run（管理员）。关键决策：构建期不启定时器（NEXT_PHASE 早退 + globalThis 哨兵）；open 判重防风暴；receiver=target??owner。验证：build 通过 + 手动扫描 created 1/重复 0 + 未登录 403。教训：Payload collection access 不能直接放裸 isGlobalAdmin（回调传 {req}），需包 ({req})=>isGlobalAdmin(req.user)；where 需用 Payload Where 类型。
