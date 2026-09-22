# Design: astro-page-copy-cms

> Title: Astro 公开站页面文案入 CMS（每页一个结构化集合 + 首页 hero/CTA 可排序）
>
> Created: 2026-09-20T09:57:36Z

## Context

- 现状：三站四页文案在 `apps/astro/src/content/{home,features,solutions,pricing}.ts`（1933 行；类型与数据同文件），页面 `.astro` 只做渲染。取数接缝唯一：`apps/astro/src/lib/payload.ts`（59 行）→ `/api/v2/content/articles`。
- 约束：
  - Astro `output: 'static'`，构建期取数 ⇒ CMS 必须在 `:3000` 监听（上一批次 finish 门禁已实测：不在就 `ECONNREFUSED 127.0.0.1:3000`）。
  - AGENTS.md §4：禁兜底、禁双写、单文件 ≤1000 行（`scripts/astro-copy-agents9.mjs` 按此限额自检，生成物由 `migrations/index.ts` 登记的批次推导豁免）；§7：schema 变更走安全演进（本 change 纯新增集合，无破坏性改表）。
  - 仓内约定：`CollectionConfig` 具名导出、kebab 复数 slug、双语 label、`status` 用 `select`（**全仓无 `versions`/`drafts`/`livePreview`**）、types 再生到 `src/payload-types.ts`。
  - 迁移事实（记忆 `payload-migrations-not-automatic`）：生产永不自动 migrate；本地账本 `batch=-1`，DDL 走 psql 单事务 + `information_schema` 复核。
- 规模实测：leaf 单引号字符串 home 132/133/133、features 140/139/139、solutions 136/136/136、pricing 53/49/48（juece/erp/yunque）⇒ 合计 1374，减 203 个结构键 ⇒ **≈1171 个待导入文本单元**（home 315 / features 337 / solutions 390 / pricing 129）。

## Goals / Non-Goals

**Goals:**
- 每页一个结构化集合，字段与 TS 类型一比一，保留编译期校验（owner 裁决的方案 B）。
- 首页 hero 与 CTA 子条目后台可增删排序，公开站按后台顺序渲染。
- 迁移前后渲染文本逐字一致；构建期拉不到 CMS / 无已发布记录 ⇒ 非零退出，不静默。
- SEO 三件套逐页齐全：标题 / 描述走一比一镜像的 `meta` 组（后台可配）；canonical 由构建期页面 URL 派生（不入库，见 D8）。

**Non-Goals:**
- 通用 `PageBlocks` 区块表、整页拖拽搭建、i18n、发布审批流、定时发布。
- `versions` / `drafts` / `livePreview`（不为本 change 引入新范式）。
- 法务页 / 404 / `feed.xml` / 文章 JSON-LD 的品牌硬编码（PROB-023，另立 change）。
- 任何线上执行。

## Decisions

### D1 每页一个集合，页面身份 = 集合身份

四个 TS 类型**都没有 `id` / `slug` 字段**（实测：home/features/solutions/pricing 的类型定义中零命中），所以不需要为「页面标识」造字段：

| 集合文件 | slug | 镜像类型 | 记录数 |
|---|---|---|---|
| `collections/pages/PageHome.ts` | `page-home` | `HomeContent`（`home.ts:11-80`） | 每 project 一条 |
| `collections/pages/PageFeatures.ts` | `page-features` | `FeaturesContent`（`features.ts:27-39`） | 同上 |
| `collections/pages/PageSolutions.ts` | `page-solutions` | `SolutionsContent`（`solutions.ts:19-30`） | 同上 |
| `collections/pages/PagePricing.ts` | `page-pricing` | `PricingContent`（`pricing.ts:25-41`） | 同上 |

站归属复用 `project` relationship（与 `Articles.ts` 同一条路，不新增站枚举）。唯一性由 `beforeChange` 钩子保证：同集合内 `project` 重复即抛 ⇒ 后台列表天然一 project 一行，不需要 `slug` 也不需要 `sortOrder`。

### D2 有序性用 Payload 原生 array 索引，不存 `sortOrder`

Payload `array` 字段在 admin 里就是拖拽排序 + 增删，读接口按索引原样返回 ⇒ 「后台顺序 = 展示顺序」无需额外列。加 `sortOrder` 数字列会和索引表达同一事实，属 AGENTS.md §4 禁的双写。⇒ `docs/03-data-model.md` 里我先前写的「带 sortOrder」表述本轮改齐。

**但位置耦合的列表必须锁长度**（放开增删会产出静默丢内容或渲染 `undefined`）：

| 字段 | 渲染器耦合 | schema 约束 |
|---|---|---|
| `hero.diagram.chips` | `index.astro:146-148` 硬编码 `chip-a/b/c`，第 4 项被丢弃 | `min:3, max:3` + validate 报错文案 |
| `hero.diagram.nodes` | y 偏移 `92 + i*112`，固定 `viewBox 0 0 480 500`，>3 溢出 | `max:3` |
| `cases.minis` | 标签取 `['A','B'][i]`，第 3 项渲染 `undefined` | `max:2` |
| `hero.titleLines` / `hero.stats` / `cta.rows` | 纯 `.map()`，可自由增删排序 | 只设 `min:1` |

### D3 字段类型映射（不是全部 text/textarea）

非文本语义字段若图省事做成 textarea，等于把结构焊死成字符串，渲染器立刻不可信。分类如下：

| TS 字段 | Payload 字段 |
|---|---|
| `IconKey = 'saas'\|'erp'\|'yunque'`（曾声明于 `home.ts:8`，被 `solutions.ts:7` 与 `index.astro` import；`features.ts` 从未内联第二份——它的 `10-14` 行是 `FeaturePanel` 的五路 `kind` 判别联合。2.2 起唯一声明收在 `types/icons.ts:6`） | `select` + 三 option；类型源全仓唯一化 |
| `action: 'lead' \| 'href'`（hero.primary、cta.rows[].action） | `select` |
| `external` / `ghost` / `highlight` / `reverse` / `em` | `checkbox` |
| `FeaturePanel.kind`（blocks/chips/bars/journey/agent） | Payload `blocks` 字段（5 个 block 类型），避免「五个可选组全显示」的噪音表单 |
| `pegs[].pos: 'p1'..'p4'`、`pegs[].icon: 'task'\|'memory'\|'gov'\|'ext'` | `select` |
| `tagTone?: 'yb'` | `select`（可空）；同时修 PROB-024 的类名拼接 |
| `rows[].w: number`、`bars: number[]` | `number` |
| `blocks[].w: string`（CSS 几何值） | `text` + 校验 `/^\d+(\.\d+)?%$/` |
| `no`（编号 token）、`price` / `unit` / `currency` | `text`；价格页模板对 `/^[0-9]+$/` 有判定，validate 保持该口径 |
| 其余 `{text, strong, val, label, title, desc, ...}[]` | `text` / `textarea` |

跨站差异（导入不能假设同形）：`features` 的 panel `kind` **顺序按站不同**；`chips` 长度 6/5/5；`months[]` 在云雀语义另指；`pricing` 差异最大（`unit` 仅 juece、`currency` 三站均未用、`price` 有数字 / `'面议'` / `'按团队'` 三种形态、`features[]` 长度不一）；`solutions` 零差异；`*.external` 仅 juece 用。⇒ schema 一律「可选字段留空」而非「按站裁剪」。

### D4 富文本：不做 Lexical，统一 `{ text, emphasis }` 组

现状有两套并存的高亮机制：`hero.titleLines[]{text, em?}`（home）与 `titleA` + `titleEm`（features/solutions/pricing）。方案：全部收敛为可重复的 `{ text: string, emphasis: checkbox }` 组（即 `titleA`/`titleEm` 折成两条 titleLines），渲染器只保留一种循环。
不用 Lexical 富文本：页面文案是行级强调 + 固定 DOM 结构，富文本会产出渲染器不认识的标记，破坏「渲染逐字一致」这条验收。
`*heading` 里的字面 `\n`（`solutions.heading` / `cases.heading`，在 `index.astro:210` / `:243` split 成 `<br>`）：存成 textarea 原样保留 `\n`，渲染逻辑不动 —— 导入脚本禁止转义或折叠换行。

### D5 读端点契约（唯一接缝）

`GET /api/v2/content/pages?site=<siteId>&page=<home|features|solutions|pricing>`

| 情形 | 响应 |
|---|---|
| `site` 缺失或未知 | 400 `INVALID_SITE`（**不给 `?? 'juece'` 默认**；`articles/route.ts:84` 的默认对文章成立，对页面文案不成立 —— 静默按主站会把主站文案发到分站） |
| `page` 缺失或未知 | 400 `INVALID_PAGE` |
| 站点无对应 project（`siteProjectSlug` 三站全部显式：juece→`juece-grow`、erp→`juece-erp`、yunque→`yunque`） | 404 `SITE_NOT_FOUND` |
| 该 project 无已发布记录（含只有草稿） | 404 `PAGE_COPY_NOT_FOUND`（**不再学 `articles/route.ts:119` 回空数组**） |
| 同一 project 有 ≥2 条已发布记录（`limit: 2` 探测） | 500 `PAGE_COPY_DUPLICATE`（PROB-029）：执行者是 `page_home/project_idx` 等四条数据库唯一索引，本分支只在「线上 DDL 落后于代码 / 有人绕过迁移直接写库」时响；不静默取第一条 |
| 异常 | `logger.error` + 500 `CONTENT_FETCH_FAILED`（吸取 PROB-021：不静默吞） |

响应体走 `lib/envelope.ts` 的 `ok/err` 唯一实现（含 CORS 白名单），只返回结构化文案（页面标题/描述即其中的 `meta`，见 D8），不外泄 project 联系人等内部字段。

### D6 Astro 侧失败即构建失败

- `lib/payload.ts`：新增 `getPageCopy<T>(page): Promise<T>`，对 `!res.ok` / `!success` / 缺 `data.page` 一律抛可读错误 ⇒ Astro frontmatter 抛错即 `astro build` 非零退出。`CMS_ORIGIN` 缺失即在模块求值时抛（把 `:5` 注释的承诺变成代码）——该校验的落处见下面 P6 追加条：在 `lib/cmsOrigin.ts`，不在 `lib/payload.ts`。
- 不加「拉不到就用代码内旧文案」的兜底路径（那是本 change 要删的东西）。
- 去 `SITE_ID` 兜底：`site.ts:168` 与 `astro.config.mjs:4` 的 `|| 'juece'` 删除，改由 `apps/astro/package.json` 的 `dev` / `build` 脚本用 `cross-env SITE_ID=juece` 显式赋值（实测 `.env` 里没有 `SITE_ID` 键，全靠兜底 ⇒ 只删代码不改脚本会让根 `build.mjs:48` 与 e2e 前置 `astro dev` 直接红）。
- 负向验证：`PUBLIC_CMS_ORIGIN` 指向死端口跑 `astro:build` 必须非零退出（注意 `scripts/build.mjs:24-38` 有 Windows libuv 退出码 `3221226505` 白名单，它只放行「产物已生成」的情形，不能拿来解释这次的失败）。
- **（P6 追加）`CMS_ORIGIN` 常量的唯一实现处是客户端安全模块 `apps/astro/src/lib/cmsOrigin.ts`，不在 `lib/payload.ts`**：Vite/Astro 只把 `PUBLIC_` 前缀的环境变量内联进客户端 bundle，`SITE_ID` 没有该前缀 ⇒ `lib/payload.ts`（`import { siteId } from '../site'`）一旦被浏览器侧脚本传递引到，站点解析代码就进浏览器，`import.meta.env.SITE_ID` 恒 undefined，2.15 之前被 `|| 'juece'` 静默兜住、删兜底后模块顶层即抛，整块 `<script>` 的监听器注册全部丢失（PROB-026）。服务端继续从该模块 import，不建第二份常量、不加 re-export 垫片。
  - 否决的替代方案：`define:vars` 或 `data-cms-origin` 把地址注入 DOM ⇒ 会改属性，违反非目标第 3 条（迁移前后 DOM 逐字一致）；给 `SITE_ID` 补 `PUBLIC_` 前缀 ⇒ 把服务端站点解析变成公开可覆写的运行时输入，且要动三站脚本与 `astro.config.mjs`，代价与风险都更大。
  - 机器对面：`scripts/astro-copy-client-bundle.mjs`（零参数，直查三站产物的 `_astro/*.js`）——前几道门禁只看服务端产物，抓不到这类断裂，见 D6 负向验证与 tasks 3.11。

### D7 类型单一真值 + 导入快照

- 类型从 `content/*.ts` 抽到 `apps/astro/src/types/pages/*.ts`，页面、组件（`PageHero.astro:6-13`、`PricingTable.astro:2-12` 的结构复制品）、导入脚本共用同一份；`content/*.ts` 数据文件导入完成后删除。
- 导入前快照：`evidence/snapshot-pre-import/` 存 12 份 `(site,page)` JSON dump + 三站四页渲染文本基线 ⇒ 既是 parity 的比对基准，也是回滚依据。
- 导入脚本注意：`features.ts:158` 的文案内嵌 ASCII 双引号，解析/序列化不得把 `"` 当分隔符；dump 走 `JSON.stringify` 直读 TS 对象，不做文本切分。

### D8 SEO 载体唯一化 + 端点读模型投影契约

P3 建完四个集合后暴露出五处「一比一镜像」与「通用字段」叠加产生的重叠，逐条定案如下。

**① 页面标题/描述的唯一载体 = 一比一镜像出来的 `meta` 组，不设 `seoTitle`/`seoDescription`。**
实测：四个 TS 类型都有页级 `meta: { title, description }`（如 `types/pages/features.ts:27`），12 份快照的 `meta` 全部有值；四页把它直送布局（`pages/index.astro:72-73`、`features.astro:20-21`、`solutions.astro:11-12`、`pricing.astro:11-12`）。若再加一对 `seo*`，就是同一事实的第二套载体，且零消费者（`Layout.astro:44` 的 `ogTitle = seoTitle || title` 只在调用方显式传 `seoTitle` 时才生效，四页都不传）⇒ 命中 AGENTS.md §4 双写禁令。**已从 `pageCopyCommonFields()` 删除**，四集合的 `admin.useAsTitle` 改 `'id'`（Payload `validateUseAsTitle` 禁止嵌套路径，`meta.title` 不可作标题），`defaultColumns` 改为 `['project', 'status', 'updatedAt']`。

**② canonical 保持构建期派生，不入 CMS。**
`Layout.astro:43 const canonical = url || Astro.url.href`：静态构建时 `Astro.url` 即该页最终 URL，三站各自的 `siteUrl` 已在品牌配置里。存进库反而会产生「库里写的和实际部署域名不一致」的第二真值。⇒ SEO 三件套仍逐页齐全，其中两项后台可配、一项构建期推导。

**③ 端点输出 = Astro 类型形态，不是 Payload 存储形态。**存储形态受 Payload 框架约束，直吐会迫使渲染器读框架细节：

| 存储形态 | 端点投影后 | 为何投影 |
|---|---|---|
| `blocks` 字段判别键 `blockType` | `kind` | `blockType` 是 Payload 框架字段名；TS 判别联合的键是 `kind` |
| `panel: [{ blockType, … }]`（`minRows=maxRows=1`） | `panel: { kind, … }` 单对象 | Payload `blocks` 只能是数组，TS 里面板是单个可判别对象 |
| `hero.titleLines: { text, emphasis }[]` | **原样，不反向折叠** | D4 已定「只留一种高亮机制」；反向拆回 `titleA/titleEm` 等于把结构重新焊死成两根字符串 |
| `meta: { title, description }` | 原样（即 ① 的载体） | — |
| 数组行 / block 行的 `id`、`blockName`、`_order` | **删除** | Payload 的记账列，不是文案字段；Astro 类型里也不存在，留着就是把框架细节推给渲染器 |
| 记录根的 `project`、`status`、`createdAt`、`updatedAt` | **删除** | 站归属与发布态由端点按契约自己决定（`site`/`page` 已在信封里回显），文案体不带第二套身份 |
| 未填的可选字段返回 `null` | **折回「键不存在」** | TS 侧 `desc?`/`href?` 是可选键；`null` 会让 `cap.tagTone ?? ''` 这类写法与 `in` 判断分叉。实测 12 份快照的 `null` 与空串叶子数均为 0 ⇒ 该归一只可能消掉「后台没填」，擦不掉任何真实文案 |

⇒ 「读归一」与三条改名/折叠规则同在一份实现里（`apps/cms/src/lib/pageCopyProjection.ts` 的 `stripRecordKeys`/`fromRecord`/`toReaderShape`），端点、parity、覆盖度三处共用；模块原在仓库根 `scripts/astro-copy-projection.mjs`，P4 因其消费方已含 CMS 运行时代码（端点与导入脚本）而迁入 CMS `src/lib`。
⇒ 配套动作落在 2.14：`types/pages/{features,solutions,pricing}.ts` 的 `hero` 从 `titleA: string; titleEm: string` 改为 `titleLines: { text: string; emphasis?: boolean }[]`，`home.ts` 的 `em` 改名 `emphasis`，四个渲染器只保留一种 `titleLines.map()` 循环。

**2.14 落地口径（把「只留一种循环」说精确）。**收敛的对象是**两套标题机制**（`titleA`/`titleEm` 成对字段 vs `titleLines` 可重复组），不是四处调用点：四页各自保留一行 `c.hero.titleLines.map(...)`，**行内包裹元素按页原样不动**——首页 `<span class="line">`（`styles/home.css:24` 驱动），features/solutions/pricing 为 `{text}<br /><em>{text}</em>`（`PageHero.astro` 的 `<slot />`）。不把这三处抽成共享组件、也不把 `<em>` 挪进 `PageHero`：Astro 的作用域样式哈希按**作者文件**分配（实测三页 slot 元素分别带 `fsswmxcn`/`6dt247gv`/`lmkygsfs`），移动元素即改 cid 归属 → 改样式命中 → 违反 `REQUIREMENTS.md` REQ-0003 非目标第 3 条「不改公开站视觉与 DOM 结构」。为把这条非目标钉成机器可核对，新增 `scripts/astro-copy-hero-dom.mjs`（抓 12 条 `<h1 class="hero-title">` 内部 HTML，只剥 `data-astro-cid-*` 与空白噪声），基线落 `evidence/snapshot-pre-import/hero-dom.json`——既有文本抽取器看不见 `span` 与 `<br />` 的差别，这条能。**P8 补**：该抽取器入参是 `<distDir> <site> <outFile>`，不是验收入口；零参数入口是包装器 `scripts/astro-copy-hero-diff.mjs`（见 Test Seams 第 6 条）。

**④ parity / 覆盖度比对必须带显式映射表。**快照 dump 是**迁移前的 TS 形状**（`titleA/titleEm`、`kind`、单对象 `panel`），CMS 记录是**投影前形态**，直接深比必产生差集。⇒ `scripts/astro-copy-parity.mjs` 与 `.aiws/tmp/astro-page-copy-cms/63-coverage-check.mjs` 都以 ③ 表为唯一允许的形变：parity 期望侧 = 快照 → `toSchemaShape` → `toReaderShape`，实际侧 = 端点 `data.copy` **原样取用**（实测修正：`toReaderShape` 的 R3⁻¹ 只认数组形态的 `panel`，对端点输出二次施加会直接抛——被测对象正是服务端那一次投影，不能在外面再包一层）。映射表未覆盖的任何差集即缺陷，禁止用「忽略字段」消音。

**⑤ 生成类型名的单数化不算泄漏。**`generate:types` 按 slug 推导接口名（`page-features` → `PageFeature` 等），是 `payload-types.ts` 的内部类型名，不出现在 JSON 里；为它改 slug 会连带改 URL 与既有约定，代价大于收益 ⇒ 接受。

## Test Seams

唯一接缝 = D5 的 `/api/v2/content/pages`。断言 1..4 全打这条缝，不新增测试专用端点（第 5、6 条不打接缝，它们查的是构建产物本身）：
1. **数据层**（P-V1）：parity 脚本 12 组深比 —— 覆盖导入正确性与 schema 完整性。
2. **渲染层**（P-V4）：切换前后三站四页正文**文本** diff —— 覆盖可见文本逐字不变；它看不见 `<span class="line">` 与 `<br />` 的结构性差别，那半边由第 6 条钉。
3. **浏览器层**（P-V5）：e2e 断言后台改后的字符串出现在公开页、旧串消失 —— 覆盖端到端自助改稿这条产品目标。**P9 落地为两层**，因为 SSG 下这两层不同源：dev 层是常驻用例（`apps/e2e/tests/page-copy.spec.ts` 第 6 组，`:4321` 按请求重渲染 ⇒ 当场看到新串，`finally` 复原并把整份 copy 与改前快照深比）；产物层是一次性回环（PATCH → `pnpm astro:build` → 断 `dist/pricing/index.html` 新串命中且旧串零残留 → 复原再重建），因为「后台改完必须重建才生效」（本文 Risks 第 4 条）只有查产物能证。
4. **负向**（P-V6，P9 起有常驻入口）：`node scripts/astro-copy-cms-unreachable.mjs`（零参数）—— 覆盖「不许静默」，且把「不许静默」扩到**报错文本也不许静默**：四条判定 = 死端口先探监听（前提不成立不算绿）/ 构建退出码非零 / 输出含 `ECONNREFUSED`+端口号（反证进程 env 覆盖了 `.env`）且含「不回退」/ `dist` 内 HTML 计数 0。PROB-028 的教训：四条判定只成立前两条时（`227` 实测只抛 `fetch failed`）失败路径等于把静默从产物层挪到报错层。
5. **产物层守卫·客户端**（P-V8，P6 追加）：`scripts/astro-copy-client-bundle.mjs` 直查三站产物的 `_astro/*.js` —— 上面 1..4 全在服务端产物层，浏览器运行时的断裂（PROB-026：客户端脚本传递引到 `src/site.ts`）只有查产物能抓到；它由第 3 层（e2e）先发现，再由本条固化成门禁。
6. **产物层守卫·DOM 结构**（P-V9，P8 追加）：`scripts/astro-copy-hero-diff.mjs` 零参数把三站 12 条 `<h1 class="hero-title">` 内部 HTML 与导入前基线逐字节比 —— REQ-0003 非目标第 3 条钉的是 DOM 而不是文本，抽取器 `astro-copy-hero-dom.mjs` 本身要三个入参（裸跑 `exit=1`，日志 `200`），故验收入口必须是这条包装器；解析实现仍只有抽取器一份。**边界（P9）**：它比的是**导入前**基线 ⇒ 上线后任何一次合法改稿都会让它红，所以是**迁移期守卫**，不得串进 `scripts/build.mjs` 的常驻构建链。

## Risks / Trade-offs

- 字段一比一 ⇒ schema 代码量大（4 文件，估计 home 最大 ≈450 行）。取舍：接受，换来后台表单可信 + 编译期校验；单文件控制在 ≤500 行，符合 §4。
- `FeaturePanel` 用 Payload `blocks` 而非判别联合的 5 个可选组：更贴渲染，但 `payload-types.ts` 里会变成 block 数组，Astro 侧需一小段判别映射（保留 `kind` 作为判别键，不引入双写）。
- 页面文案与站点品牌配置（`site.ts` 的 nav/beian/品牌名）仍分两处：本 change 只搬「页面文案」，品牌配置入后台是另一件事（若做，独立需求）。
- 后台改完必须重新构建才生效（SSG 决定了这一点，无增量预览）：这是产品既有形态，不在本 change 改成 ISR/SSR。

## Migration / Rollback

**本地落地（唯一执行环境）**
1. `payload generate:types` 后，`pnpm --filter cms exec payload migrate:create page_copy_collections` 生成建表迁移（`.ts` + `.json` 双份，`migrations/index.ts` 自动登记）：实测 39 张 `CREATE TABLE` + 15 个 `CREATE TYPE` 枚举 + 4 条 `project_id → projects` 外键 + 锁文档表 4 列，零 `DROP`/`RENAME`。
2. 因本地账本 `batch=-1` 会被 Payload 自身门禁拒跑：迁移文件 `up()` 内的 SQL 由 `.aiws/tmp/astro-page-copy-cms/86-apply-migration.mjs` 提取（187 条语句）经 `pg` 驱动在 `127.0.0.1:5434` 的**单事务**内执行（失败即 `ROLLBACK`），执行前断言库内无任何 `page_*` 表 ⇒ 二次执行硬拒（实测 `exit=1`），执行后用 `information_schema` 复核 39 表 / 15 枚举 / 4 外键齐全；账本不入账（与 20260919 删表同处置）。
3. 跑导入脚本 → 12 条已发布记录 → parity 绿。

**线上（本 change 不执行，只登记为发布前置）**
- 部署后需人工在维护窗口外按 owner 裁决处理：迁移文件随代码入库但线上不会自动执行 ⇒ 线上新集合为空，公开站构建会 404（正确行为，但部署顺序必须是「先跑迁移 + 先导入，再切 Astro 构建」）。此项在 delivery 说明里标注「线上未执行、未核实」。

**回滚**
- 代码：`git revert` 本 change 提交；`content/*.ts` 可从 `evidence/snapshot-pre-import/` 逐文件还原（快照即原样副本）。
- 数据：本地库执行本次迁移的 `down`（纯新增表，无既有表变更，DROP 无数据损失风险）。
- 顺序：先回滚 Astro（恢复读代码内文案）再删表，避免构建期 404。
