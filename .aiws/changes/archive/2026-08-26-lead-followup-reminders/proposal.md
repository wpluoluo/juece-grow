# Change Proposal: lead-followup-reminders

> Title: 线索跟进自动化：到期提醒+首次跟进SLA（核心，后台内提醒）
>
> Created: 2026-08-26T12:14:46Z

## 目标与非目标

**目标：**
- 支持在后台配置提醒规则（到期提醒 due / 首次跟进 SLA），由 node-cron 定时扫描命中线索。
- 命中后写 `reminder-notices`（后台"待跟进"清单）+ 追加 `LeadActivities`（`reminder` 事件），看板展示待办提醒点。
- 同一线索同一规则在未处理前不重复提醒；提醒不改变线索本身状态。

**非目标：**
- 外部渠道触达（企业微信/钉钉/邮件 webhook）—— 后续独立 change 接入。
- 自动改线索状态 / 自动分配 / 自动外呼 —— 仅提醒，不代执行动作。
- 规则叠加多条件（来源+标签）与第三方订阅 —— 先支持项目范围 + 适用阶段。

## 主索引绑定（强制）

- `Change_ID` = lead-followup-reminders
- 需求交付：`Req_ID` = REQ-0002
- 问题修复：`Problem_ID` =
- `Contract_Row` = REQ-0002
- `Plan_File` = .aiws/plan/2026-08-26-lead-followup-reminders.md
- `Evidence_Path` = .aiws/changes/lead-followup-reminders/evidence/verify-before-complete.md

## 依赖关系（可选）

- `Depends_On` = （无）
- `Blocks` = followup-reminders-webhook（企业微信机器人通知）

## 现状与问题

- `Leads` 已有 `owner / status / activity / nextFollowUpAt / followUpNote`，但 `nextFollowUpAt` 无任何消费机制，跟进全凭人工记忆，逾期/漏跟无提醒。
- `LeadActivities` 是可读事件时间线，可自动记录"提醒已触发"，无需新增订阅。
- 无任何后台"待跟进"清单或提醒点；`new` 线索长期无人首响无信号。

## 方案概述（What changes）

- 新增 `reminder-rules` collection：可配置规则。字段含 name、project(空=全局)、kind(due/sla)、applyStatuses(适用阶段)、graceHours(sla 小时阈值)、target(提醒对象，空=跟进人)、enabled。
- 新增 `reminder-notices` collection：触发落一条（lead/project/rule/kind/receiver/status open|done/dueAt），即后台"待跟进"清单，兼作去重依据。
- `LeadActivities.type` 新增 `reminder` 选项（只增不改，安全演进）。
- 新增 `src/lib/reminderCron.ts`：node-cron 调度 + `runReminderScan`（按规则查命中线索→判重→写 notice+activity）。用全局哨兵防 dev HMR 重复注册；构建期不启动定时器（`NEXT_PHASE==='phase-production-build'` 早退）。
- 新增 `POST /api/v2/reminders/run`（管理员）手动触发扫描，返回 `{ success, data:{ created } }`，便于验证。
- 看板(Dashboard 组件)新增待办提醒点：展示 `reminder-notices` 中 status=open 的数量/摘要。
- `payload.config.ts` 注册新 collections + `onInit` 启动调度。

## 协同与委托（可选）

- `review/`：交付前跑 `/ws-review`（spec + quality）。

## 影响范围（Scope）

### In Scope（本次改动范围）

- `apps/cms/src/collections/reminder-rules.ts` - 新增规则集合
- `apps/cms/src/collections/reminder-notices.ts` - 新增提醒清单集合
- `apps/cms/src/lib/reminderCron.ts` - 调度与扫描逻辑
- `apps/cms/src/app/api/v2/reminders/run/route.ts` - 手动触发接口
- `apps/cms/src/collections/LeadActivities.ts` - 新增 `reminder` 事件类型
- `apps/cms/src/app/(payload)/custom.scss` - 看板待办提醒点样式
- `apps/cms/components/Dashboard.tsx` - 待办提醒点
- `apps/cms/src/payload.config.ts` - 注册集合 + onInit
- `apps/cms/src/payload-types.ts` - 重新生成
- `apps/cms/package.json` / `pnpm-lock.yaml` - 新增 node-cron
- `REQUIREMENTS.md` / `.aiws/changes/lead-followup-reminders/**` - 需求与 change 工件

### Out of Scope（明确不改动）

- `webhook` 外部推送（企业微信/钉钉/邮件）——后续 change
- `Leads` 既有字段语义与去重逻辑
- 公开站 `apps/astro` 相关代码

### 外部影响

- 新增枚举值 `LeadActivities.type = reminder`（仅消费方为后台时间线，无破坏）。
- 新增两个内部集合与一个带鉴权的内部接口 `/api/v2/reminders/run`。

## 风险与回滚

- 风险：
  - node-cron 在 Next dev HMR / 构建期多实例重复触发 → 用 `globalThis` 哨兵 + 构建期早退规避。
  - 调度扫描频繁造成 DB 查询压力 → 默认每 30 分钟一次，规则全量扫描单表轻度。
  - 新集合建表与既有库列冲突 → 沿用既有"新增列安全演进"，冲突时先清残留列。
- 回滚方案（必须可执行）：
  - 撤销本轮 `main` 合入（`git revert` 单个 merge commit）。
  - 停用调度：重新 `build` 后 `start`，或删除对应规则并置 enabled=false；接口与集合保留但无规则即无动作。

## 验证计划（必须可复现）

- 命令：
  - `pnpm --filter cms build`（生产构建，TS 校验通过）
  - 起 db + cms dev → 后台建一条 sla 规则与一条 due 规则 → 造一条 `nextFollowUpAt` 已过、status=new 的线索 → `curl -X POST http://localhost:3000/api/v2/reminders/run`（携带 admin 会话）
  - `aiws validate .`；`aiws change validate lead-followup-reminders --strict`
- 期望结果：
  - 接口返回 `{ success:true, data:{ created: N } }`；`reminder-notices` 与 `LeadActivities(reminder)` 出现命中记录；重复调用不重复生成 open 记录；看板显示待办提醒数量；构建无 TS 错误。

## 真值文件/合同更新清单

- `REQUIREMENTS.md`：需要 —— 新增 REQ-0002 验收条款
- `.aiws/requirements/CHANGELOG.md`：需要 —— 记录 REQ-0002
- `.aiws/requirements/requirements-issues.csv`：需要 —— 追加 REQ-0002 行
- `.aiws/issues/problem-issues.csv`：不需要
- 证据落盘（推荐双层）：
  - 持久（建议入库）：`.aiws/changes/lead-followup-reminders/evidence/verify-before-complete.md`
  - 临时（可忽略入库）：`.aiws/tmp/aiws-validate/*.json`