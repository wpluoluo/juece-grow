# Handoff: phase1-skeleton

> Archived: 2026-08-26T11:51:01Z

## 本次完成

- 建立 monorepo：`apps/astro`（公开站，SSG）+ `apps/cms`（Payload 3 自托管后台）。
- `apps/cms` 可跑通：连接 PostgreSQL 16、Payload Auth、首批 collections（Project / Site / Article / Lead / Form）。
- `apps/astro` 可跑通：SSG 骨架 + 首页/文章详情静态渲染 + 从 Payload 拉取数据（单站点）。

## 改动文件

- (see git log for details)

## 关键决策

- monorepo：根 pnpm workspaces，`apps/astro` + `apps/cms` 两包（快速开发 + 单仓治理）。
- 数据层：PostgreSQL 16 + @payloadcms/db-postgres（官方 stable 适配器），schema 由 Payload 自管。
- 运行形态（本机）：Postgres 跑在 Docker 容器（`docker-compose` 只起 postgres，`DATABASE_URI=localhost:5434`）；Payload cms 与 Astro dev 跑在本机 host，**不进容器**。
- 内容/表单：Payload collections 建模；Lead 是表单提交的唯一主数据源，不依赖任何 SaaS。
- Astro↔Payload 拉取：Payload REST 端点 + 文档化模板，Phase 1 以单站点验证该链路。
- 接口信封：对外统一 `/api/v2`，成功 `{ success: true, data }`、失败 `{ success: false, error:{code,message} }`。

## 协同记录

- analysis: 0 file(s)
- patches: 0 file(s)
- review: 2 file(s)
  - .aiws/changes/archive/2026-08-26-phase1-skeleton/review/quality-review.md
  - .aiws/changes/archive/2026-08-26-phase1-skeleton/review/spec-review.md
- evidence: 1 file(s)
  - .aiws/changes/archive/2026-08-26-phase1-skeleton/evidence/verify-before-complete.md

## 下一步建议

- 可以开始: phase2-multisite
- 可以开始: phase2-lead-dedup-attribution

## 绑定

- Change_ID: phase1-skeleton
- Req_ID: REQ-0001
- Problem_ID: N/A
