# Design: lead-followup-reminders

> Title: 线索跟进自动化：到期提醒+首次跟进SLA（核心，后台内提醒）
>
> Created: 2026-08-26T12:14:46Z

## Context

- `Leads.nextFollowUpAt` 已存在但无消费机制；跟进全凭人工记忆，逾期/漏跟无提醒；`new` 线索首响无信号。
- 技术约束：Payload 3.88 + Next 16 自托管（Next 起 server 进程可承载 node-cron）；Postgres 16 数据自持；字段双语 i18n；`/api/v2` 统一信封；自研文件 ≤1000 行、无兜底/双写。
- 本项目红线：不引入外部 CMS；新增依赖需自宿主且必要。

## Goals / Non-Goals

**Goals:**
- 后台可配置提醒规则（due 到期 / sla 首次跟进超时）。
- node-cron 定时扫描命中线索，写 `reminder-notices`（待跟进清单）+ `LeadActivities(reminder)`，看板展示待办提醒点。
- 同一 lead+rule+kind 未处理前不重复提醒；提醒不改线索状态。

**Non-Goals:**
- 外部渠道推送（企业微信/钉钉/邮件）→ 步骤二。
- 自动改状态/分配/外呼；规则叠加多条件与第三方订阅。
- 公开站 `apps/astro` 改动。

## Decisions

- **node-cron 承载调度**：自包含、自宿主、无外部依赖；挂 `payload.config.ts` 的 `onInit`，在 Next server 进程内常驻。用 `NEXT_PHASE==='phase-production-build'` 早退护栏并 `globalThis` 哨兵防 dev HMR 重复注册。
- **新增两集合**：`reminder-rules`（规则、可配置）+ `reminder-notices`（命中记录、兼作去重与待跟进清单）。与复用单集合相比，规则与记录职责分离，读模型清晰。
- **SLA 判据用 status**：`status='new'` 且创建超 `graceHours` 即判定"首响未做"，避免多一次 activity 关联。
- **`LeadActivities.type` 增 `reminder`**：只增不改的枚举演进，时间线可追溯"已提醒"。
- **判重依据**：`reminder-notices(lead+rule+kind, status=open)` 存在即跳过，保证风暴抑制。
- **手动触发接口** `/api/v2/reminders/run`（管理员）作为可复现验证入口，与 cron 共用 `runReminderScan` 单一实现路径。

## Risks / Trade-offs

- dev HMR / 构建期定时器重复或提前触发 → `globalThis` 哨兵 + `NEXT_PHASE` 早退。
- 扫描频率 DB 压力 → 默认每 30 分钟，单表全量扫描轻度；不做分布式锁（单机自托管，若日后多实例再引入）。
- 新集合建表列冲突 → 沿用"新增列安全演进"，冲突先清残留列再起 Payload。
- 提醒风暴 → open 判重天然去重；sla 规则对同线索最多一条。

## Migration / Rollback

- 迁移：新增 `reminder-rules`、`reminder-notices` 两表（Payload schema push 自动建表）；`lead-activities.type` 加一枚举值（只增）。均属安全演进，无历史数据回流。
- 回滚：`git revert` 合入提交；或部署上将全部规则 `enabled=false`（集合与接口保留但无规则即无动作），再平滑移除。