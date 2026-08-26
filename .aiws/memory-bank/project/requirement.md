---
title: REQUIREMENTS.md
created: '2026-08-25T15:35:10.600Z'
updated: '2026-08-26T12:42:42.488Z'
summary: <!-- AIWSMANAGEDBEGIN:requirements:contract --> 本文件是工作区需求的唯一真值来源。AI 在制定计划与执行测试时必须以此为准。
tags:
  - seed:requirement
---
# REQUIREMENTS.md

_Source: `REQUIREMENTS.md`_

# REQUIREMENTS.md

<!-- AIWS_MANAGED_BEGIN:requirements:contract -->
本文件是工作区需求的唯一真值来源。AI 在制定计划与执行测试时必须以此为准。

约束：
- 不写入任何 secrets（token、账号、内网端点等）
- `aiws update` 只维护本托管块；其余内容由项目自由编辑

相关合同：
- `requirements/requirements-issues.csv`：需求拆解执行合同（校验：`python3 tools/requirements_contract.py validate`）
<!-- AIWS_MANAGED_END:requirements:contract -->

本文件是当前项目的需求与验收标准唯一真值来源。请按以下约定维护：

## 如何编写需求

每条需求使用唯一 `Req_ID`（形如 `PROJ-001`），包含：

- **背景 / 问题**：为什么需要
- **目标**：要达成什么（可验证）
- **非目标**：明确不做哪些（防范围蔓延）
- **验收标准**：可机器或人工验证的条目

已完成的需求保留在历史区并标记 `✓`；新增需求追加到 Backlog 区。

## Backlog

### REQ-0002：线索跟进提醒自动化（到期 + 首次跟进 SLA，核心）

**背景 / 问题**
- 现有 `nextFollowUpAt` 字段已存在但无机制消费，跟进全凭人工记忆，逾期/漏跟无提醒。
- new 线索长时间无人首响、长期停在未跟进状态，无信号让跟进人感知。

**目标**
- 支持在后台配置提醒规则（到期提醒 / 首次跟进 SLA），由 node-cron 定时扫描命中线索。
- 命中后写 `reminder-notices`（后台"待跟进"清单）+ 追加 `LeadActivities`（`reminder` 事件），看板展示待办提醒点。
- 承诺：同一线索同一规则在未处理前不重复提醒；提醒不改变线索本身状态。

**非目标**
- 外部渠道触达（企业微信/钉钉/邮件 webhook 推送）—— 后续独立 change 接入。
- 自动改线索状态 / 自动分配 / 自动外呼 —— 仅提醒，不代执行动作。
- 提醒规则的第三方订阅与复杂条件编排（如叠加来源+多标签）—— 先支持项目范围+适用阶段。

**验收标准**
- [ ] 后台可配置规则：`reminder-rules` 集合含 type(due/sla)、适用阶段、sla 超时阈值(小时)、归属项目(空=全局)、启停，且字段均有中英双语 label
- [ ] 到期提醒：`nextFollowUpAt` 已过且阶段为进行中(new/contacted)的线索命中，未处理前不重复提醒
- [ ] 首次跟进 SLA：状态仍为 `new` 且创建超过阈值小时未跟进(pre)线索命中
- [ ] 命中后生成 `reminder-notices`（线索+类型+接收人+状态 open/done）并追加 `LeadActivities` 事件 `reminder`
- [ ] 提供 `/api/v2/reminders/run`(POST，管理员) 手动触发扫描，返回 `{ success, data:{ created } }`
- [ ] 看板展示待办提醒数量/清单；后台 `reminder-notices` 集合即"待跟进"列表
- [ ] CMS 生产构建通过 TS 校验；调度在构建期不启动定时器

## Backlog

### REQ-0001：Phase1 工程骨架（单站点可发文、表单线索入池）

**背景 / 问题**
- 仓库前身为纯文档仓库，无任何可运行工程。无法发文章、无法收表单线索，多产品增长平台无法落地。

**目标**
- 建立 monorepo（`apps/astro` 公开站 + `apps/cms` Payload 后台），Postgres 自持线索数据。
- 单站点可发布文章并在公开站静态渲染。
- 表单提交可将线索写入自有 Postgres 线索池。

**非目标**
- 多项目/多域名挂站（Phase 2）
- 去重合并/归因/CRM 插件（Phase 2）
- 富文本 Lexical 前端渲染组件（先以结构化字段/列表代替正文）
- Chatwoot 收件箱接入（Phase 3）
- 任何外部 CMS / 内容 SaaS

**验收标准**
- [ ] `docker compose up -d postgres` 起容器，cms 与 astro 在 host 运行，`DATABASE_URI=localhost:5434` 连通 Payload 建表
- [ ] `GET /api/v2/health` 返回 `{ success: true, data: { status: 'ok' } }`
- [ ] `POST /api/v2/leads`，缺 phone 且缺 wechat 时返回校验错误信封（`error.code=VALIDATION`）；非法/空 projectId 返回 `MISSING_PROJECT`；非法 JSON 返回 `INVALID_JSON`；DB 异常返回 `LEAD_CREATE_FAILED`(500)
- [ ] 合法提交（phone 或 wechat 至少填一）后线索落库 `leads` 表，返回 `{ success: true, data: { id } }`
- [ ] 公开站首页渲染 Payload 已发布文章列表，并展示留资表单；`/articles/[slug]` 渲染已发布文章
- [ ] Playwright 烟测覆盖：健康信封、首页渲染、表单→Lead 落库、API 直投、非法请求边界、OPTIONS/CORS

## 已完成

<!-- 已完成需求归档区。示例：

### ✓ PROJ-000：首个需求

- 状态：已完成
- 验收：全部通过

-->
