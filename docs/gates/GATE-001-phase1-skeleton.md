# GATE-001 · Phase 1 工程骨架（单站点 + 表单线索入池）

> 门禁规则见 AGENTS.md §8：重大改动先立门禁，获确认后才落地。
> 状态：**待确认** → 确认后标记 ACCEPTED 再开工。ID：GATE-001，slug：phase1-skeleton。

## 1. 背景
- 项目：juece-grow（多产品增长平台）。已定栈：公开站 Astro + Payload 3 + PostgreSQL 16。
- Phase 1 目标（见 docs/06-roadmap.md）：搭出一个可跑通的单站点，能发文章、收表单线索入池。
- 范围本次门禁仅到「工程骨架」：monorepo 目录 + 两端最小可运行 + 首批 collections + Auth。

## 2. 方案对比
### 2.1 应用框架（结论已定，记录对比）
| 方案 | 结论 |
|---|---|
| Astro（公开站） | ✅ 采纳：SSG 静态、0KB 默认 JS、多营销站与 SEO 主场景 |
| Next.js | 未选：每页较重 React 运行时，内容站偏重 |
| Nuxt | 未选：与 Payload 集成弱 |

### 2.2 数据库
| 方案 | 结论 |
|---|---|
| PostgreSQL 16 | ✅ 采纳：Payload 官方 stable 适配器，强关系业务匹配 |
| MySQL 8 | 未选：Payload 非官方 stable（仅社区级），JSON/full-text 更弱 |
| MongoDB | 未选：与强关系业务建模不符 |

### 2.3 CMS/后台
| 方案 | 结论 |
|---|---|
| Payload 3 | ✅ 采纳：MIT、角色不限、后台即出（admin/Auth/Lexical/Form） |
| Strapi / Directus / Halo | 未选：自托管免费版角色/建模受限，或需外部系统 |

## 3. 作用域（本次门禁覆盖）
- 建 monorepo：`apps/astro`（公开站）+ `apps/cms`（Payload）。
- `apps/cms`：Payload 初始化 + Postgres 连接 + Auth + 首批 collections（Project / Site / Article / Lead / Form）。
- `apps/astro`：SSG 骨架 + 首页/文章详情静态渲染 + 从 Payload 拉取数据（单站点）。
- 共享信封 `/api/v2` 与错误规范（见 AGENTS.md §6）。

## 4. 不做（本期排除）
- 多项目/多域名挂站（Phase 2）。
- 去重合并/归因/CRM 插件（Phase 2 验明插件能力后再定）。
- 富文本 Lexical 前端渲染组件（先以结构化字段/列表代替文章正文）。
- Chatwoot 接入（Phase 3）。
- 任何外部 CMS / 内容 SaaS。

## 5. 风险与对策
| 风险 | 对策 |
|---|---|
| Payload + Astro 集成非官方第一顺位，需自拼拉取 | 用 Payload REST/SDK + 文档化模板；Phase 1 先以单站点验证该链路 |
| 工程范围膨胀拖速度 | 严格按本门禁作用域，超出即拆下一门禁 |
| 数据/配置升级丢数据 | 遵循 AGENTS §7 迁移纪律；Phase 1 以加字段为主 |

## 6. 影响范围
- 前端：新增 `apps/astro` 骨架。
- 后端/数据：新增 `apps/cms` + PostgreSQL schema（Payload 自管）。
- 文档：docs/02、docs/03、docs/06 已同步；本门禁新增 docs/gates/。

## 7. 自检清单（完成后必过）
- [ ] 命名 camelCase 三层映射
- [ ] 未引入外部 CMS/新依赖（对照红线）
- [ ] API 统一 /api/v2 信封
- [ ] SEO 字段（首页/文章 title/description）
- [ ] 线索数据存自有 Postgres
- [ ] 自研文件 ≤1000 行、无兜底/双写/兼容写法
- [ ] 影响范围已说明（前端/后端/数据）

## 8. 结论
- 待确认。确认后触发 Phase 1 骨架搭建（task 绑定：change/gate-001-skeleton）。