# Design: phase1-skeleton

> Title: Astro + Payload + Postgres 工程骨架（单站点 + 表单线索入池）
>
> Created: 2026-08-25T12:42:59Z

## Context

- 项目：juece-grow（多产品增长平台）。公开站 Astro + 后台 Payload 3 + PostgreSQL 16（见 docs/02-architecture.md）。
- 现状：纯文档仓库，无工程骨架；真值 docs/01~06 与 GATE-001 门禁已就绪（docs/gates/GATE-001-phase1-skeleton.md）。
- 约束（AGENTS.md）：自研文件 ≤1000 行、禁止兜底/双写/兼容写法、命名三层映射 camelCase、线索数据持自有 Postgres、API 统一 /api/v2 信封。
- 部署形态：Astro SSG 静态输出；Payload 自托管 Node 服务。

## Goals / Non-Goals

**Goals:**
- 可跑通的单站点：Astro 首页/文章详情静态渲染，数据来自 Payload。
- Payload 后台：Auth + 首批 collections（Project / Site / Article / Lead / Form）。
- 表单提交 → 线索入自有 Postgres 的 Lead；/api/v2 统一信封。

**Non-Goals:**
- 多项目/多域名挂站、去重归因、Lexical 前端渲染、Chatwoot（均 Phase 2/3）。
- 不自研后台 UI；不自研认证（用 Payload 内建 Auth）。

## Decisions

- monorepo：根 pnpm workspaces，`apps/astro` + `apps/cms` 两包（快速开发 + 单仓治理）。
- 数据层：PostgreSQL 16 + @payloadcms/db-postgres（官方 stable 适配器），schema 由 Payload 自管。
- 内容/表单：Payload collections 建模；Lead 是表单提交的唯一主数据源，不依赖任何 SaaS。
- Astro↔Payload 拉取：Payload REST 端点 + 文档化模板，Phase 1 以单站点验证该链路。
- 接口信封：对外统一 `/api/v2`，成功 `{ success: true, data }`、失败 `{ success: false, error:{code,message} }`。

## Risks / Trade-offs

- Payload + Astro 集成非官方第一顺位 → 用 REST/SDK + 模板，本期单站点验证，验证通过再放量多站。
- 工程范围膨胀 → 严格按 GATE-001 作用域，超出拆下一门禁。
- 数据丢失 → 全新实例 Payload 自管 schema，本期以加字段为主，遵循 AGENTS §7 迁移纪律。

## Migration / Rollback

- 迁移：Postgres 全新实例，Payload `push` 建 schema（加字段为主）。
- 回滚：全部新增文件，无既有破坏 → 移除 `apps/` 与新增配置即回纯文档态，或 `git revert` 首个提交。