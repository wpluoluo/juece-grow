# CLAUDE.md · juece-grow 项目上下文

本文件为 Claude/AI Agent 在本仓库的项目总上下文，与 AGENTS.md 互补。
- AGENTS.md：执行规范、红线、命名、流程（含门禁与代码硬性约束）
- 本文件：项目身份、文档索引、工作原则、选型背景

## 项目身份
- 项目名：juece-grow（英文项目名，觉策增长）
- 定位：开源独立项目，统一管理你名下多个产品的获客官网、文章、留资、线索与渠道归因。
- 根目录：F:\juece-grow
- 与 juecesass 相互独立：不混合依赖、不混用模块、字段。

## 技术栈口径
- 公开站点：Astro（SSG 静态，内容/营销站/SEO 主场景）
- 后台/内容/线索/数据：Payload 3 自托管（admin / Auth / Lexical 富文本，后台即出，不自研）
- 数据库：PostgreSQL 16（Payload 官方 stable 适配器，数据自持）
- 客服收件：Chatwoot（仅收件箱，线索主数据在自有库）
- 认证：Payload 内建 Auth（JWT/Cookie）

## 文档索引
- docs/01-plan.md          需求与范围
- docs/02-architecture.md  架构与技术选型
- docs/03-data-model.md    数据模型
- docs/04-pages-seo.md     页面清单与 SEO
- docs/05-lead-flow.md     线索流程
- docs/06-roadmap.md       分阶段路线图
- docs/gates/*.md          门禁记录（重大改动先行）

## 工作原则
1. 先理解再修改：读相关文档/代码后再动手。
2. 遵守现有架构：不发明新架构，不引入外部 CMS。
3. 最小改动：只解决要求的问题，不超范围重构。
4. 命名规范极高优先：一贯 camelCase，禁止兼容写法。
5. 文档/代码/接口口径一致：改动涉及字段或接口时同步文档。
6. 数据优先：升级保证内容数据不丢失、配置不被覆盖。
7. 门禁优先：重大改动先立门禁（方案对比+风险+影响范围），确认后再落地。
8. 代码硬约束：自研文件 ≤1000 行，禁止兜底/双写/兼容逻辑。

## 通用目标优先级
1. 用户当前明确要求
2. 本仓文档真值（01-plan / 02-architecture / 03-data-model / 06-roadmap）
3. AGENTS.md 执行红线
4. 已有代码模式
5. 可维护性与最小改动

## 建议查阅
- Node.js 常用；Astro、Payload、Drizzle、PostgreSQL 官方文档。
- 涉及 UI 用本项目相关前端设计技能；Payload schema 变更用官方迁移文档。

## 选型背景（2026-08）
- 应用层历经 Nuxt / Next / Astro 对比：本项主场景为多营销站 + 文章 + SEO，公开站选 Astro（内容优先、SSG、部署成本低）。
- 后台与数据选 Payload 3（MIT、角色不限、后台即出），数据库选 Postgres 16（Payload 官方 stable 适配器）；不采用 MySQL（非官方 stable）、不引入外部 CMS（Strapi / Directus / Halo）或内容 SaaS。
- 决策记录详见 docs/02-architecture.md 与 docs/gates/。