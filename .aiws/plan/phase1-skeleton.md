# Plan: phase1-skeleton

> Branch: change/phase1-skeleton
> Created: 2026-08-25T12:42:59Z
> Change_Type: full-stack

## Bindings

- `Change_ID` = phase1-skeleton
- `Req_ID` = REQ-0001
- `Problem_ID` = N/A
- `Contract_Row` = Req_ID=REQ-0001
- `Plan_File` = .aiws/plan/phase1-skeleton.md
- `Evidence_Path` = .aiws/changes/phase1-skeleton/evidence/verify-before-complete.md
- `Change_Type` = full-stack

## Goal

搭出可跑通的单站点：Astro 首页/文章详情静态渲染（数据来自 Payload）+ Payload 后台（Auth + 首批 collections）+ 表单提交线索入自有 Postgres。共享 /api/v2 信封。

## Non-goals

- 多项目/多域名挂站（Phase 2）
- 去重归因/CRM 插件、Lexical 前端渲染、Chatwoot（Phase 2/3）

## Scope

- `apps/cms/**` — Payload 后台
- `apps/astro/**` — 公开站
- `package.json` / `pnpm-workspace.yaml` / `.gitignore` — monorepo 根
- `docs/**`、`.aiws/**` — 真值文档与门禁工件

## Plan

每步 ≤3 原子操作：

1. monorepo 根：写 `pnpm-workspace.yaml`（apps/*）、根 `package.json`、`.gitignore`（含 aiws 托管块）。
2. `apps/cms`：初始化 Payload 3 工程，装 `@payloadcms/db-postgres`，写 `payload.config.ts` + `.env`（DATABASE_URI=postgres://...）。
3. `apps/cms` collections：新建 `Project` / `Site` / `Article` / `Lead` / `Form`（camelCase 字段）。
4. `apps/cms` API：新增表单提交端点（/api/v2，写 Lead），统一 `{success:true,data}` 信封。
5. `apps/astro`：初始化 Astro SSG，写 `astro.config.mjs`、`src/layouts/`、`src/pages/index.astro`。
6. `apps/astro`：文章详情静态渲染 + `src/lib/` 从 Payload REST 拉取。
7. 收尾：根 `pnpm install`，跑 `aiws plan-verify` + 自检清单（AGENTS §9）。

## Verify

- 命令：
  - `pnpm install`
  - `pnpm --filter cms dev`（连本地 Postgres）
  - `pnpm --filter astro dev`
- 期望结果：
  - Payload admin 可登录，5 个 collections 列表可见。
  - Astro 首页/文章详情渲染出 Payload 数据。
  - 提交表单 → Lead 落库，/api/v2 返回 `{success:true,data}`。
  - 自研文件 ≤1000 行、无兜底/双写、命名 camelCase、无外部 CMS、线索在自有 Postgres。

## Risks & Rollback

- Payload+Astro 集成非官方第一顺位 → REST/SDK + 模板验证链路；验证不过再评估。
- 范围膨胀 → 严格按 GATE-001 作用域，超出拆下一门禁。
- 回滚 → 全部新增文件，移除 `apps/` 与新配置即回纯文档态，或 `git revert` 首个提交。

## Evidence

- `.aiws/changes/phase1-skeleton/proposal.md`、`design.md`、`tasks.md`
- `.aiws/changes/phase1-skeleton/evidence/verify-before-complete.md`（交付前落盘）