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

## 文档
- [规划方案](docs/01-plan.md)
- [架构设计](docs/02-architecture.md)
- [数据模型](docs/03-data-model.md)
- [页面清单与 SEO](docs/04-pages-seo.md)
- [线索流程](docs/05-lead-flow.md)
- [路线图](docs/06-roadmap.md)
- [项目规范](AGENTS.md)
- [项目上下文](CLAUDE.md)

## 状态
规划阶段完成，进入 Phase 1 实现（见 docs/06-roadmap.md）。
