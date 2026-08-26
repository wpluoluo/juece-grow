---
title: 'Plan: lead-followup-reminders'
created: '2026-08-26T12:42:42.524Z'
updated: '2026-08-26T12:42:42.524Z'
summary: '> Generated: 2026-08-26 · Change: lead-followup-reminders · Req: REQ-0002'
tags:
  - seed:plan
---
# Plan: lead-followup-reminders

_Source: `.aiws\plan\2026-08-26-lead-followup-reminders.md`_

# Plan: lead-followup-reminders

> Generated: 2026-08-26 · Change: lead-followup-reminders · Req: REQ-0002

## Bindings

- `Change_ID` = lead-followup-reminders
- `Req_ID` = REQ-0002
- `Problem_ID` =
- `Contract_Row` = REQ-0002
- `Plan_File` = .aiws/plan/2026-08-26-lead-followup-reminders.md
- `Evidence_Path` = .aiws/changes/lead-followup-reminders/evidence/verify-before-complete.md

## Goal

支持在后台配置跟进提醒规则（到期提醒 due / 首次跟进 SLA），由 node-cron 定时扫描命中线索；命中后写 `reminder-notices`（后台待跟进清单）+ 追加 `LeadActivities(type=reminder)`，看板展示待办提醒点。同一线索同一规则在未处理前不重复提醒；提醒不改变线索本身状态。

## Non-goals

- 外部渠道推送（企业微信/钉钉/邮件 webhook）——步骤二独立 change。
- 自动改线索状态 / 自动分配 / 自动外呼——仅提醒，不代执行动作。
- 规则叠加来源/标签等复杂条件与第三方订阅——先支持项目范围+适用阶段。
- 公开站 `apps/astro` 改动。

## Scope

- 新增 `apps/cms/src/collections/ReminderRules.ts`（规则：name/project/kind(due|sla)/applyStatuses/graceHours/target/enabled，双语 label）。
- 新增 `apps/cms/src/collections/ReminderNotices.ts`（待跟进清单：lead/project/rule/kind/receiver/dueAt/status(open|done)，read=projectScopedRead）。
- 改 `apps/cms/src/collections/LeadActivities.ts`：`type` 增 `reminder`（只增不改）。
- 新增 `apps/cms/src/lib/reminderCron.ts`（node-cron 调度 + runReminderScan）。
- 新增 `apps/cms/src/app/api/v2/reminders/run/route.ts`（管理员手动触发）。
- 改 `apps/cms/src/payload.config.ts`（注册集合 + onInit 启动调度）。
- 改 `apps/cms/components/Dashboard.tsx` + `custom.scss`（看板待办提醒点）。
- 重新生成 `apps/cms/src/payload-types.ts`；`apps/cms/package.json` + lock 增 node-cron。

## Plan

1. 新增 `ReminderRules.ts` / `ReminderNotices.ts` 两集合（双语 label，关系索引）；`LeadActivities.type` 增 `reminder`；注册进 `payload.config.ts`。
2. 安装 `node-cron`（`pnpm --filter cms add node-cron`）。
3. 新增 `src/lib/reminderCron.ts`：`startReminderCron`（`NEXT_PHASE` 早退 + `globalThis` 哨兵 + 默认 `*/30 * * * *`）与 `runReminderScan`（due/sla 命中 → open 判重 → 写 notice(receiver=target??owner) + append LeadActivity(reminder) → 返回 created）。
4. `payload.config.ts` 的 `onInit` 调用 `startReminderCron(payload)`。
5. 新增 `/api/v2/reminders/run`（authenticated + isGlobalAdmin），返回 `{success:true,data:{created}}`。
6. Dashboard 看板展示 open notices 待办数量/摘要；custom.scss 补样式。
7. `pnpm --filter cms payload generate:types` 重新生成类型。

## Risks & Rollback

- 风险：dev HMR / 构建期定时器重复或提前触发 → `globalThis` 哨兵 + `NEXT_PHASE` 早退规避；扫描压力 → 每 30 分钟一次单表轻度；新集合建表列冲突 → 沿用安全演进 + 先清残留列。
- 回滚：`git revert` 合入提交；或置规则 enabled=false（保留集合与接口但无规则即无动作）。

## Verify

- 命令：
  - `pnpm --filter cms build`（生产构建 TS 校验通过，构建期不启动定时器）
  - dev 起 db + cms，后台建 due/sla 规则 + 造 status=new、nextFollowUpAt 已过的线索；`curl -X POST http://localhost:3000/api/v2/reminders/run`（带 admin 会话）
  - `aiws change validate lead-followup-reminders --strict`
- 期望结果：接口返回 `{success:true,data:{created>0}}`；首次调用后 `reminder-notices` 与 `LeadActivities(reminder)` 各出现命中记录；重复调用 created=0（判重生效）；看板显示待办提醒数；生产构建无 TS 错误。

## Evidence

- `.aiws/changes/lead-followup-reminders/evidence/verify-before-complete.md`（持久）
- `.aiws/tmp/aiws-validate/*.json`（临时）
