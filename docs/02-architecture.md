# juece-grow · 架构设计

> 技术基线时间：2026-08。选型均按当前最新稳定版核实，避免一上线就落后。

## 1. 架构总览

公开站点用 Astro 静态渲染（内容/营销站/SEO 主场景），后台与数据用 Payload 3 自托管 + 自有 PostgreSQL。没有第二套 CMS、没有第三方内容库；Chatwoot 仅作客服收件箱。

```
┌──────────────────────────────────────────────────────────┐
│                     juece-grow                            │
│                                                          │
│  公开站点层  Astro (SSG 静态)                            │
│  ├─ 首页 / 文章列表 / 文章详情 / 落地页                   │
│  └─ SSG 预渲染 + SEO 元信息 + sitemap                     │
│                                                          │
│  内容/数据层  Payload 3 (Node)                           │
│  ├─ Admin 后台 / Auth / Lexical 富文本                   │
│  ├─ collections: 项目/站点/页面/区块/文章/表单/线索        │
│  └─ payload.config.ts + Drizzle adapter                  │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
       ┌───────▼───────┐      ┌───────▼────────┐
       │  PostgreSQL 16 │      │  Chatwoot      │
       │  (自有 schema) │      │  (客服收件箱)   │
       │  站点/内容/线索 │      │  多渠道收件     │
       └───────────────┘      └────────────────┘
```

## 2. 技术栈

> 决策记录（2026-08）：公开站历经 Nuxt / Next / Astro 对比，选 Astro（内容优先、SSG、部署成本低）；后台与数据选 Payload 3（MIT、角色不限、后台即出）。数据自持 PostgreSQL（Payload 官方 stable 适配器），内容与线索不进第三方 SaaS。

| 组件 | 选型 | 版本/状态 | 理由 |
|---|---|---|---|
| 公开站点 | Astro | 6.x，SSG | 内容/营销站主场景，0KB 默认 JS，SEO 与多站构建最优 |
| CMS/后台 | Payload | 3.x，MIT 自托管 | 自带 admin、Auth、角色、Content、form，后台即出；角色不限，避开 Strapi 收费门控 |
| 数据库 | PostgreSQL | 16.x | Payload 官方 stable 适配器；自持数据，一套 schema 建模内容与线索 |
| ORM | Payload 内建(Adapter → Drizzle) | Payload 3 | schema 即业务结构 |
| 富文本 | Payload Lexical 内置 | 当前 | 开箱即用，运营直接发文 |
| 客服收件 | Chatwoot | MIT 开源 | 唯一成熟开源收件箱，API 通道接抖音/小红书 |
| 认证 | Payload 内建 Auth | JWT/Cookie | 成熟安全，不手写 |
| UI 层 | Tailwind + 现成组件 | 当前 | 后台由 Payload admin 提供；公开站组件提速 |

## 3. 选型理由（对比记录）

- 公开站点：Astro vs Next vs Nuxt。本项主场景为多营销站 + 文章 + SEO，Astro 内容优先、SSG 纯静态、部署成本近零；Next 每页带较重 React 运行时，Nuxt 与 Payload 集成弱。故公开站选 Astro。
- 数据库：Payload 官方 stable 适配器为 PostgreSQL / MongoDB / SQLite；MySQL 仅社区级（非官方 stable）。本项为强关系业务，选 Postgres 16，自持不依赖 SaaS。
- CMS：Payload vs Strapi / Directus / Halo。Payload 3 自托管、MIT、角色不限，原生 admin + Auth + form，最贴合"少自研后台 + 数据自持"；故弃用其他。
- 结论：**Astro + Payload 3 + PostgreSQL 16**，用最少手写量拿到"后台即出 + 内容站点 + 线索自持"。

## 4. 模块边界（目录组织，Phase 1 单站点优先）

```
root/
├─ apps/astro/              公开站点（Astro，SSG）
│  ├─ src/pages/            首页/文章列表/文章详情/落地页
│  ├─ src/layouts/          站点通用布局
│  ├─ src/lib/              Payload 数据拉取(rest/sdk)与工具
│  └─ astro.config.mjs
├─ apps/cms/                内容/数据服务（Payload，Node）
│  ├─ src/collections/      Payload collections(项目/站点/页面/区块/文章/表单/线索)
│  ├─ src/lib/              Payload 配置、数据库连接、工具
│  ├─ payload.config.ts
│  └─ package.json
└─ 共享规范：命名三层映射 + /api/v2 信封 + 门禁流程（见 AGENTS.md）
```

> 与旧 Nuxt/Next 结构最大的不同：**CMS 后台与内容建模由 Payload 接管**，不再手写 admin 路由、认证、富文本、CRUD。

## 5. 部署形态

- 独立进程：Astro 静态产物托管 + Payload(Node) 单容器 + PostgreSQL。
- SSG：公开站点静态预渲染出 HTML，搜索引擎可抓；文章更多时再评估增量构建。
- Chatwoot 独立自托管，仅作收件箱，线索数据最终回写自有 Postgres。
- 域名：每项目可选子域或路径挂到站点，SEO 字段独立配置（Phase 2 起）。

## 6. 响应与错误规范

- 成功：`{ success: true, data }`
- 失败：`{ success: false, error: { code, message } }`
- 不把数据库异常原样抛给前端，不暴露内部堆栈。