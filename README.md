# juece-grow · 觉策增长

开源独立项目：统一管理你名下多个产品的获客官网、文章、留资、线索与渠道归因。

## 定位
一个自己的获客营销平台，替你把每个产品的官网、文章、留资入口、线索跟进在一个平台统一管起来。

## 技术栈
- 公开站点：Astro 6（SSG 静态，内容/营销站/SEO 主场景）
- 后台/内容/线索/数据：Payload 3 自托管（原生 admin / Auth / Lexical 富文本）
- 数据库：PostgreSQL 16（Payload 官方 stable 适配器，数据自持）
- 客服收件：Chatwoot（仅收件箱，线索主数据在自有 Postgres）
- 认证：Payload 内建 Auth（JWT/Cookie）

## 仓库结构
```
apps/cms     Payload 后台 + /api/v2 + admin（统一运营看板）
apps/astro   公开站（SSG），首页/方案/文章/落地页
infra/       Chatwoot 等自托管编排
scripts/     构建与运维脚本
docs/        规划、架构、数据模型、SEO、线索流程、路线图、设计主题
```

## 本地开发
1. 起数据库：`pnpm db:up`（Docker，Payload 用，端口 5434）。
2. 复制并填写环境变量：`apps/cms/.env.example`、`apps/astro/.env.example`（本地按需覆盖为 `.env`）。
3. `pnpm cms:dev`（后台：<http://localhost:3000/admin>）、`pnpm astro:dev`（公开站：<http://localhost:4321>）。
4. 可选客服：`docker compose -f infra/chatwoot/docker-compose.yml up -d`，公网站配置 `PUBLIC_CHATWOOT_URL` / `PUBLIC_CHATWOOT_WEBSITE_TOKEN`，CMS 配置 `CHATWOOT_WEBHOOK_SECRET`，把 Chatwoot 收件 inbox 的 webhook 指向 `/api/v2/webhooks/chatwoot`。

## 文档
- [规划方案](docs/01-plan.md)
- [架构设计](docs/02-architecture.md)
- [数据模型](docs/03-data-model.md)
- [页面清单与 SEO](docs/04-pages-seo.md)
- [线索流程](docs/05-lead-flow.md)
- [路线图](docs/06-roadmap.md)
- [后台设计主题](docs/07-design-theme.md)
- [部署与备份](docs/08-deployment.md)
- [项目规范](AGENTS.md)
- [项目上下文](CLAUDE.md)

## 状态
Phase 1 链路跑通、Phase 2 多项目治理、Phase 3 全渠道收口均已完成（见 [docs/06-roadmap.md](docs/06-roadmap.md)）；收尾阶段（文档对齐、开源化、部署与备份策略）也已落地，见 [LICENSE](LICENSE)、[CONTRIBUTING.md](CONTRIBUTING.md)、[docs/08-deployment.md](docs/08-deployment.md)。
