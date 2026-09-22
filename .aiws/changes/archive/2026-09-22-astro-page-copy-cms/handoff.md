# Handoff: astro-page-copy-cms

> Archived: 2026-09-22T03:17:20Z

## 本次完成

- 运营在 Payload 后台即可修改三站（juece / erp / yunque）四页（首页 / 功能 / 方案 / 价格）的文案，改完重新构建公开站即生效，不需要改代码、不需要评审发版。
- 首页 hero 与 CTA 区块的子条目支持后台增删与拖拽排序，公开站按后台顺序渲染。
- 建模形态（owner 2026-09-20 裁决）：**方案 B 打底** —— 每页一个结构化 Payload 集合，字段与 `apps/astro/src/content/{home,features,solutions,pricing}.ts` 的 TS 类型一比一，保留编译期字段校验。

## 改动文件

- (see git log for details)

## 关键决策

- `lib/payload.ts`：新增 `getPageCopy<T>(page): Promise<T>`，对 `!res.ok` / `!success` / 缺 `data.page` 一律抛可读错误 ⇒ Astro frontmatter 抛错即 `astro build` 非零退出。`CMS_ORIGIN` 缺失即在模块求值时抛（把 `:5` 注释的承诺变成代码）——该校验的落处见下面 P6 追加条：在 `lib/cmsOrigin.ts`，不在 `lib/payload.ts`。
- 不加「拉不到就用代码内旧文案」的兜底路径（那是本 change 要删的东西）。
- 去 `SITE_ID` 兜底：`site.ts:168` 与 `astro.config.mjs:4` 的 `|| 'juece'` 删除，改由 `apps/astro/package.json` 的 `dev` / `build` 脚本用 `cross-env SITE_ID=juece` 显式赋值（实测 `.env` 里没有 `SITE_ID` 键，全靠兜底 ⇒ 只删代码不改脚本会让根 `build.mjs:48` 与 e2e 前置 `astro dev` 直接红）。
- 负向验证：`PUBLIC_CMS_ORIGIN` 指向死端口跑 `astro:build` 必须非零退出（注意 `scripts/build.mjs:24-38` 有 Windows libuv 退出码 `3221226505` 白名单，它只放行「产物已生成」的情形，不能拿来解释这次的失败）。
- **（P6 追加）`CMS_ORIGIN` 常量的唯一实现处是客户端安全模块 `apps/astro/src/lib/cmsOrigin.ts`，不在 `lib/payload.ts`**：Vite/Astro 只把 `PUBLIC_` 前缀的环境变量内联进客户端 bundle，`SITE_ID` 没有该前缀 ⇒ `lib/payload.ts`（`import { siteId } from '../site'`）一旦被浏览器侧脚本传递引到，站点解析代码就进浏览器，`import.meta.env.SITE_ID` 恒 undefined，2.15 之前被 `|| 'juece'` 静默兜住、删兜底后模块顶层即抛，整块 `<script>` 的监听器注册全部丢失（PROB-026）。服务端继续从该模块 import，不建第二份常量、不加 re-export 垫片。
- 否决的替代方案：`define:vars` 或 `data-cms-origin` 把地址注入 DOM ⇒ 会改属性，违反非目标第 3 条（迁移前后 DOM 逐字一致）；给 `SITE_ID` 补 `PUBLIC_` 前缀 ⇒ 把服务端站点解析变成公开可覆写的运行时输入，且要动三站脚本与 `astro.config.mjs`，代价与风险都更大。
- 机器对面：`scripts/astro-copy-client-bundle.mjs`（零参数，直查三站产物的 `_astro/*.js`）——前几道门禁只看服务端产物，抓不到这类断裂，见 D6 负向验证与 tasks 3.11。
- 类型从 `content/*.ts` 抽到 `apps/astro/src/types/pages/*.ts`，页面、组件（`PageHero.astro:6-13`、`PricingTable.astro:2-12` 的结构复制品）、导入脚本共用同一份；`content/*.ts` 数据文件导入完成后删除。

## 协同记录

- analysis: 0 file(s)
- patches: 0 file(s)
- review: 2 file(s)
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/review/quality-review.md
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/review/spec-review.md
- evidence: 200 file(s)
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/aiws-validate-stamp-20260920-224221Z.json
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/astro-read-path-switch.md
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/change-status-20260920-224221Z.json
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/change-sync-stamp-20260920-224221Z.json
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/change-validate-strict-20260920-224221Z.json
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/client-bundle-regression-fix.md
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/collaboration-summary-20260920-224221Z.json
  - .aiws/changes/archive/2026-09-22-astro-page-copy-cms/evidence/delivery-build-gates-p8.md
  - ...(truncated)

## 下一步建议

- 可以开始: （无）

## 绑定

- Change_ID: astro-page-copy-cms
- Req_ID: REQ-0003
- Problem_ID: PROB-024
