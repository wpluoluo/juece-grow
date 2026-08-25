---
title: REQUIREMENTS.md
created: '2026-08-25T15:35:10.600Z'
updated: '2026-08-25T15:35:10.600Z'
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
