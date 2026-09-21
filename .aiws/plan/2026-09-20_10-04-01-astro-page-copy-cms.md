# Plan: astro-page-copy-cms

> Generated: 2026-09-20 · Change: astro-page-copy-cms · Req: REQ-0003
> 建模形态由 owner 2026-09-20 裁决：**方案 B 打底**（每页一个结构化集合，字段与 TS 类型一比一），唯一例外是首页 hero 与 CTA 支持后台增删排序。

## Bindings

- `Change_ID` = astro-page-copy-cms
- `Req_ID` = REQ-0003
- `Problem_ID` = PROB-024
- `Contract_Row` = Req_ID=REQ-0003,Problem_ID=PROB-024
- `Plan_File` = .aiws/plan/2026-09-20_10-04-01-astro-page-copy-cms.md
- `Evidence_Path` = .aiws/changes/astro-page-copy-cms/evidence/verify-before-complete.md, .aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import.md, .aiws/changes/astro-page-copy-cms/design.md, .aiws/changes/astro-page-copy-cms/review/spec-review.md, .aiws/changes/astro-page-copy-cms/review/quality-review.md, .aiws/changes/astro-page-copy-cms/evidence/change-status-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/change-validate-strict-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/aiws-validate-stamp-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/change-sync-stamp-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/collaboration-summary-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/delivery-summary-20260920-224221Z.md
- `Change_Type` = full-stack（Payload schema + v2 读端点 + Astro SSG 取数改造 → 高风险，须双审查）

## Goal

让运营在 Payload 后台直接改三站（juece / erp / yunque）四页（首页 / 功能 / 方案 / 价格）的文案，无需改代码；首页 hero 与 CTA 的子条目可在后台增删与拖拽排序。迁移前后公开站渲染文本逐字一致。

## Non-goals

- **法务页 / 404 / 站点地图页 / feed.xml / 文章 JSON-LD publisher 的品牌与域名硬编码** —— 实测 7 处（`pages/404.astro:5`、`pages/privacy.astro:5` 与 `:15`、`pages/terms.astro:5` 与 `:15`、`pages/sitemap.astro:5`、`pages/feed.xml.ts:36`、`pages/articles/[slug].astro:79` 的 `name: '觉策科技'` 与 `url: 'https://juece.cloud'`）：erp / 云雀分站构建出的这些页面仍署觉策主站名。属独立缺陷（不是页面文案入 CMS 的必要条件，且修法要走站点级品牌配置而非页面集合）→ 登记 PROB-023，另立轻量 change。
  **例外**：`apps/astro/src/site.ts:168` 的 `|| 'juece'` 与 `astro.config.mjs:4` 的 `process.env.SITE_ID || 'juece'` **留在本 change 一起治**——它与本 change 的核心边界「构建期不许静默兜底」同源，且去兜底必须与「页面文案改从 CMS 按站点取」同时验证，拆开会让两边都验不清。
- **整页拖拽搭建 / 通用 `PageBlocks` JSON 区块表** —— owner 明确否决（丢编译期字段校验）。
- **草稿 + 版本历史 + Live Preview** —— 全仓 `versions|drafts|livePreview` 零命中，本 change 不引入新范式，沿用仓内 `status: select` 约定（`Articles.ts:176-190`、`Sites.ts:191`）。
- **多语言 i18n** —— 三站即三套文案。
- **线上操作** —— 生产 `payload migrate` 不单独开维护窗口（owner 2026-09-20 裁决）；本 change 只在本地 5434 容器库落地，交付说明必须写「线上未执行、未核实」。
- **`apps/cms/src/collections/Leads.ts` / `Sites.ts` 自定义端点的信封双写（PROB-022）** —— 不在本 change 顺手重构。

## Scope

> 机读口径（PROB-011）：`### In Scope` 每条 bullet 只写一个路径、条目 ≤12；allow-list 精度到目录即止，真实改动集由 `git status --porcelain` + spec-review 的 Out-of-Scope 表承担。

### In Scope

- `.aiws/`
- `REQUIREMENTS.md`
- `docs/`
- `AI_WORKSPACE.md`
- `apps/cms/`
- `apps/astro/`
- `apps/e2e/`
- `scripts/`
- `package.json`
- `.gitignore`

### 范围说明（人读，不参与机读 allow-list）

| 路径 | 本 change 改动 |
|---|---|
| `apps/cms/src/collections/pages/` | 新增 4 个页面内容集合（`PageHome` / `PageFeatures` / `PageSolutions` / `PagePricing`），字段一比一镜像 TS 类型；中英双语 label；`status` select；`beforeChange` 唯一性钩子 |
| `apps/cms/src/payload.config.ts` | 注册 4 个集合到 `内容` 分组 |
| `apps/cms/src/app/api/v2/content/pages/` | 新增公开只读端点（`site` 必填、`page` 必填、只回已发布、未命中 404、异常记日志） |
| `apps/cms/src/payload-types.ts` | `payload generate:types` 再生 |
| `apps/cms/src/migrations/` | 新增建表迁移（4 张表 + 外键） |
| `apps/astro/src/types/pages/` | 新增：从 `content/*.ts` 抽出的页面文案类型（单一真值） |
| `apps/astro/src/content/` | 删除 4 个数据文件（导入完成后不留代码内兜底副本） |
| `apps/astro/src/lib/payload.ts` | 新增 `getPageCopy()`；`CMS_ORIGIN` 缺失即抛（把 `:5` 注释里承诺的 fail-fast 落成代码） |
| `apps/astro/src/site.ts` + `astro.config.mjs` | 去 `SITE_ID` 兜底 |
| `apps/astro/src/pages/{index,features,solutions,pricing}.astro` | 取数改走 CMS；`features.astro:127` 的 `cap-tag${tagTone}` 缺分隔符缺陷就地修（PROB-024） |
| `apps/astro/src/components/sections/{PageHero,PricingTable}.astro` | 删结构复制品，改 import 共享类型 |
| `apps/astro/package.json` | `dev` / `build` 显式 `cross-env SITE_ID=juece`，删冗余 `build:juece` |
| `scripts/` | 新增导入脚本 + 逐字比对（parity）脚本 |
| `apps/e2e/` | 新增页面文案读路径用例 |
| `docs/03-data-model.md` | 已在规划轮改完（§2 `Page`/`Block`、§3 草稿行、§4 原则）：方案 B 口径 + 展示序＝数组索引序 + 站归属用 `project` |
| `.aiws/requirements/*`、`.aiws/issues/problem-issues.jsonl` | 已在规划轮追加 REQ-0003 合同行与 PROB-023 / PROB-024（台账 22 → 24 行）；交付时只做状态推进 |
| `.gitignore` | 根忽略表新增 `!/.aiws/changes/**/evidence/logs/*.log` 例外（P11-c，spec-review H-1）：上方 `*.log` 会把台账逐条引用的判定日志挡在库外，换 clone 即全断链；只放开这一层，其余日志仍忽略 |

## Plan（机读约束：`aiws change validate` 把本节**编号条目**逐步计数且上限 8 ⇒ 恰好 8 步；每步的原子操作拆分与派发依赖只以 `tasks.md` 为真值——原并生的 `tasks/tasks.jsonl` 因构成第二事实源已删除，见 tasks.md 首行与 spec-review 转交项）

1. **快照与基线**：把三站 × 四页 = 12 份 `(site,page)` 内容 JSON dump 与三站四页渲染文本基线落到 `.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import/`（导入前的原样副本，同时是 parity 基准与回滚依据）。
2. **类型单一真值**：新建 `apps/astro/src/types/pages/{home,features,solutions,pricing}.ts` 原样抽出 4 个类型（`IconKey` 收进 `types/icons.ts` 作全仓唯一声明并删去 `home.ts` 的前向转发垫片；实测规划轮「`features.ts:10-14` 内联重复一份 `IconKey`」为误记，该行是 `FeaturePanel` 的五路 `kind` 判别联合——真实的重复是三处同形 `{ value, label }`，收进 `types/shared.ts` 的 `LabeledValue`）；`components/sections/PageHero.astro:6-13`、`PricingTable.astro:2-12` 与实测新增发现的 `FeatureGrid.astro`（自抄的 `FeatureItem` 已与真值漂移）三处结构复制品改 import 该类型源。前置修复：`apps/astro` 无可运行类型检查入口（PROB-025），删 `tsconfig.json` 的 `baseUrl` 并把 `paths` 改相对写法，新增 `pnpm astro:typecheck`。
3. **CMS 四个页面集合**：在 `apps/cms/src/collections/pages/` 按 TS 类型一比一写 `PageHome` / `PageFeatures` / `PageSolutions` / `PagePricing`（双语 label、`project` relationship 必填、`status` select 默认 `draft`；页面标题/描述走一比一镜像的 `meta` 组，**不设** `seoTitle`/`seoDescription`——design D8① 实测该对字段零消费者，属双写；`FeaturePanel.kind` 用 Payload `blocks` 表达 5 个判别分支）；`beforeChange` 钩子令同集合内 `project` 唯一（页面身份 = 集合身份，不造 TS 里不存在的 `id`/`slug`）；有序性用原生 array 索引（`hero.titleLines`/`hero.stats`/`cta.rows` 可自由增删排序），位置耦合列表在 schema 锁长度（`hero.diagram.chips` = 3、`hero.diagram.nodes` ≤ 3、`cases.minis` ≤ 2）。
4. **注册 · 再生 · 建表**：`payload.config.ts` 挂 4 集合到 `内容与站点` 分组（与 `Articles`/`Sites` 同组，按仓内约定在注册处叠加 `admin.group`）→ `payload generate:types` 再生 `payload-types.ts` → `payload migrate:create` 生成建表迁移，其 `up` DDL 经 `psql` 单事务在本地 `127.0.0.1:5434` 执行并用 `information_schema.tables` 复核 4 张表（本地账本 `batch=-1`，不得拿 `payload migrate` 通过当证据；线上零操作）。
5. **公开读端点（唯一接缝）**：新增 `GET /api/v2/content/pages?site=&page=` —— `site` 必填（**不给 `?? 'juece'` 默认**，与 `articles/route.ts:84` 分道）、`page` ∈ {home,features,solutions,pricing}、project slug 三站全显式、只回已发布、未命中 404 `PAGE_COPY_NOT_FOUND`（不学 `:119` 的空数组）、异常先 `logger.error` 再 500；响应前施加 `apps/cms/src/lib/pageCopyProjection.ts` 的 `toReaderShape`（`blockType`→`kind`、单行 `panel` blocks 解包），端点输出逐字等于 Astro 类型形态；curl 跑三站四页正向 + 缺 `site` / 未知 `page` / 仅草稿三条负向。
6. **导入 + 逐字验收**：`apps/cms/scripts/import-astro-copy.ts` 读第 1 步的 dump，先过同一模块的 `toSchemaShape` 唯一投影再建 12 条已发布记录（按 `project + 集合` 幂等；`features.ts:158` 内嵌 ASCII 双引号 ⇒ 走对象序列化，不做文本切分）；`scripts/astro-copy-parity.mjs` 逐 `(site,page)` 拉端点、与「dump 过同一投影后的期望形状」深比（比对两侧同形、投影只有一份实现），≈1171 个文本单元任一差异即非零退出。
7. **Astro 切读路径 + 去兜底**：`lib/payload.ts` 加 `getPageCopy<T>(page)`（`!res.ok` / `!success` / 缺 `data.page` 一律抛）并让 `CMS_ORIGIN` 缺失即模块级抛（把 `:5` 注释的承诺变成代码；**P6 修正落处**：该校验必须在客户端安全模块 `lib/cmsOrigin.ts`，因为放在 `lib/payload.ts` 会让浏览器侧脚本经它引到 `site.ts`，见风险 R6）；四页 frontmatter 改 `await getPageCopy(...)` 并删除 `content/*.ts` 四个数据文件；同时删 `site.ts:168` 与 `astro.config.mjs:4` 的 `|| 'juece'` 兜底，并把 `apps/astro/package.json` 的 `dev`/`build` 改为显式 `cross-env SITE_ID=juece`（实测 `.env` 无 `SITE_ID` 键，只删代码不改脚本会把根 `build.mjs:48` 与 e2e 前置打红）；就地修 PROB-024（`features.astro:127` 类名拼接补分隔符）。
8. **门禁 · 审查 · 收尾**：跑 P-V1..P-V9 全部门禁（含 CMS 不可达的负向构建、后台改文案 → 重建 → e2e 断言新串出现旧串消失、客户端 bundle 污染检查、hero DOM 逐字节零参数比对）；`ws-spec-review` + `ws-quality-review` 双审查并 triage HIGH blocker；台账推进（REQ-0003 `Impl_Status` → DONE、`REQUIREMENTS.md` 勾验收并移入已完成、CHANGELOG 追加、PROB-024 → DONE、PROB-023 保持 OPEN 且注明另立 change）；`aiws validate .` + `--check-scope` + `aiws verify-bc` 后提交、推送前 L3、`finish`/归档。

## Verify（全部在仓库根执行，零手填参数）

前置：`pnpm db:up` && `apps/astro/.env` 含 `PUBLIC_CMS_ORIGIN`（消费方地址；`apps/cms/.env` 侧是 `PUBLIC_CORS_ORIGINS`）&& CMS dev 在 `:3000`（Astro 是 `output: 'static'`，构建期要拉 CMS，CMS 不在就 `ECONNREFUSED`）&& `pnpm astro:dev` 在 `:4321`。

| 编号 | 命令 | 期望结果 |
|---|---|---|
| P-V1 | `node scripts/astro-copy-parity.mjs > .aiws/tmp/astro-page-copy-cms/parity.log 2>&1; echo "parity_exit=$?" >> .aiws/tmp/astro-page-copy-cms/parity.log` | `parity_exit=0`；日志含 `12/12 (site,page) 逐字一致`；退出码由命令自身落盘、不过管道 |
| P-V2 | `pnpm --filter cms build > .aiws/tmp/astro-page-copy-cms/cms-build.log 2>&1`（红线，别交给 aiws 截断） | `exit=0`，含全量 TypeScript 检查 |
| P-V3 | `pnpm astro:build && pnpm astro:build:erp && pnpm astro:build:yunque`；再 `node scripts/build.mjs` | 三站均产出 `dist`/`dist-erp`/`dist-yunque`；无 `ECONNREFUSED`；`build.mjs` 退出码 0 **且必须是真 0**——日志里出现 `scripts/build.mjs:31` 那句「忽略退出阶段的 libuv 环境崩溃」即判不通过（P8 实测 `193`/`194`/`195` 各 `exit=0`、`ECONNREFUSED` 计数 0；`196` `build_mjs_exit=0` 且该告警零命中） |
| P-V4 | `node scripts/astro-copy-render-diff.mjs`（P1 基线 vs 切换后三站四页正文文本） | 差异清单为空；非空即非零退出 |
| P-V5 | `pnpm --filter e2e test`；自助改稿的产物层另跑 `.aiws/tmp/astro-page-copy-cms/235-rebuild-selfservice.mjs`（P9 追加） | `e2e_full_exit=0`，含新增页面文案用例；`lead.spec.ts:11-16` 的 hero 断言仍命中。**P9 实测**：全量 `243` `68 passed / 2 skipped`（第 6 组「后台自助改稿」= 管理员 PATCH 一条已发布文案 → 端点与 `/pricing` 都读到新串、旧串消失 → `finally` 复原并把整份 copy 与改前快照深比；单跑 `234` `1 passed (53.9s)`）。产物层（`output: 'static'` ⇒ 只有重建才变）：`235` 首跑红在复原 PATCH 被 Next dev 空闲断连（`ECONNRESET`）⇒ 测试串残留库内，用 `236-restore-pricing-hero.mjs` 从 git-tracked 快照复原（`236b`）+ parity `237` 证无连带损坏；脚本随即加连接类失败重试与「现值已是测试串即拒跑」的前置断言，`238` `RESULT 3.5-rebuild=OK` |
| P-V6 | `node scripts/astro-copy-cms-unreachable.mjs > .aiws/tmp/astro-page-copy-cms/cms-unreachable.log 2>&1; echo "neg_gate_exit=$?" >> ...`（P9 追加，零参数；**不改 `.env`**——Vite `loadEnv` 下进程环境变量优先，脚本只把 `PUBLIC_CMS_ORIGIN=http://127.0.0.1:59999` 注入子进程，配置文件全程不动，含令牌的文件不做「临时改一行再改回」） | `neg_gate_exit=0`；四条判定全成立：死端口不可连接 → 真实 `pnpm astro:build` 退出码**非零** → 输出含 `ECONNREFUSED`+该端口号（反证 env 覆盖生效）且含「不回退」（错误可读）→ `dist` 内 HTML 计数 0（不产出空白区块）。P9 实测：修 PROB-028 前 `228` 红（`可读错误命中=false`）⇒ 咬合力自证；修后 `230`/`232`/`233` 三次 `判定=OK`。**退出码只判非零**：`231` 实测失败构建会被退出阶段的 libuv 崩溃改写成 `3221226505`（bash 见 127），按精确码判会造出随机闪红的门禁 |
| P-V7 | `aiws validate .` 与 `aiws change validate astro-page-copy-cms --check-scope` | 前者 exit 0；后者按 PROB-011 预期仍可能 exit 2，须逐条核对未被识别的路径 |
| P-V8 | `node scripts/astro-copy-client-bundle.mjs > .aiws/tmp/astro-page-copy-cms/client-bundle.log 2>&1; echo "client_bundle_gate_exit=$?" >> .aiws/tmp/astro-page-copy-cms/client-bundle.log`（P6 追加：先跑完 P-V3 三站构建） | `client_bundle_gate_exit=0`；三站各输出「禁止串命中=0 / CMS地址已内联=true / 判定=OK」。这道门盯的是**客户端** chunk：P-V1..P-V5 全在服务端产物层，抓不到浏览器运行时断裂（PROB-026 的教训） |
| P-V9 | `node scripts/astro-copy-hero-diff.mjs > .aiws/tmp/astro-page-copy-cms/hero-diff.log 2>&1; echo "hero_diff_exit=$?" >> .aiws/tmp/astro-page-copy-cms/hero-diff.log`（P8 追加：先跑完 P-V3；注意抽取器 `scripts/astro-copy-hero-dom.mjs` 的入参是 `<distDir> <site> <outFile>`，裸跑只打印用法并 `exit=1`，**不能当验收入口**） | `hero_diff_exit=0`；输出 `12/12 三站四页 hero <h1> 内部 DOM 与切换前基线逐字节一致`。P8 实测 `201` 绿；咬合力自测 `202`（往 `dist/index.html` 的 hero `<h1>` 注入多余 `<span>` → `exit=1` 且点名 `juece/home`，逐字节还原后复跑 → `exit=0`）。这道门钉 REQ-0003 非目标第 3 条的 DOM 那一半，P-V4 的文本 diff 看不见。**边界（P9）**：它比的是**导入前**基线 ⇒ 任何一次合法改稿都会让它红，属**迁移期守卫**，不得串进 `scripts/build.mjs` 的常驻链（P8 证据 §8 第 2 条的原计划已撤回） |

**Seam 决策（唯一接缝）**：全 change 只有一个读接缝 —— `apps/cms/src/app/api/v2/content/pages`（公开只读、脱敏、已发布过滤）。Astro 四页与 e2e 断言都打这一条缝，不为每个页面各开端点、不在 Astro 侧直连 Payload 原生 REST（沿用 `lib/payload.ts:1` 既有口径）。负向断言（P-V6）也在该缝的调用方做，不加测试专用端点。

## Risks & Rollback

- **R1 逐字漂移**：12 份快照共 **1374 个叶子字符串**（P1 的 dump 与 P-V1 的端点侧两次独立实测同为 1374，非估算）手工映射，导入脚本若把 `"` 当分隔符会吃掉 `features.ts:158` 的内嵌 ASCII 引号；`solutions.heading` / `cases.heading` 里的字面 `\n` 在 `index.astro:210` / `:243` 拆 `<br>`。→ 由 P-V1（数据层）+ P-V4（渲染层）双闸门拦；差异清单为空的证据入 `evidence/`。
- **R2 位置耦合被"排序能力"打开**：`chips` 第 4 项会被静默丢弃、`diagram.nodes` 超 3 个溢出 `viewBox`、`cases.minis` 第 3 项渲染 `undefined`。→ P2 的 min/max 校验把上限钉在 schema 上，不靠文档提醒。
- **R3 去 SITE_ID 兜底打断既有入口**：`pnpm astro:build`（根 `build.mjs:48`、`AI_WORKSPACE.md` 的 `astro_build_cmd`）与 `astro dev`（e2e 前置）当前都靠兜底跑主站。→ P6 必须与 `apps/astro/package.json` 脚本改动同批落地，P-V3/P-V5 验证；否则退回：保留脚本显式赋值、只去掉代码侧兜底。
- **R4 本地迁移账本不可信**（memory `payload-migrations-not-automatic`）：新集合的表在本地经 psql 建，线上不会自动跑。→ 交付说明明写「迁移文件已入库、线上未执行」，不把本地绿灯当线上结论。
- **R5 渲染器与 CMS schema 脱钩**：切换后 `content/*.ts` 删除，类型只剩 `src/types/pages/`，后台字段漂移不会让 `tsc` 红。→ P1 把组件结构复制品收敛到同一类型源；parity 脚本按类型断言必填字段存在。
- **R6（P6 已发生，非假设）删兜底把客户端运行时断裂放出来**：`SITE_ID` 无 `PUBLIC_` 前缀 ⇒ 不会被内联进客户端 bundle，客户端脚本只要**传递**引到 `src/site.ts` 就在页面运行时抛「缺少 SITE_ID」、整块 `<script>` 死掉；此前该断裂一直由 `|| 'juece'` 静默掩盖，删兜底（tasks 2.15）后立刻显形，而 typecheck / 三站构建 / parity / 可见文本 / hero DOM **五道全绿**——它们只看服务端产物（PROB-026）。→ 落处收进客户端安全模块 `apps/astro/src/lib/cmsOrigin.ts`（唯一实现，不用 `define:vars`/data-* 注入以免改 DOM 违反非目标第 3 条）；新增 P-V8 产物级门禁 `scripts/astro-copy-client-bundle.mjs` 把它钉成机器对面；浏览器层（P-V5 e2e）是这类断裂的最后一道网，不得为了省时间跳过。
- **R7（P8 已发生，非假设）把「抽取器」当成「验收入口」**：REQ-0003 `Tests` 与 tasks 3.4 把 `scripts/astro-copy-hero-dom.mjs` 记成零参数门禁，但它的设计是 `<distDir> <site> <outFile>` 三参数的**写入型抽取器**（供基线采集与复测共用），裸跑只打印用法并 `exit=1`（实测 `200`）⇒ P5/P6 每轮复测都靠手拼三站参数 + `diff`，换个人按合同行复制命令必然复现不出绿灯。→ 补持久包装器 `scripts/astro-copy-hero-diff.mjs`（P-V9，零参数、内部三站串联并与基线逐键比），配套教训入本 change 口径：**凡写进 `Tests`/Verify 表的门禁命令，必须 (a) 零参数可跑、(b) 有咬合力自测（红的一侧也证过）**。同类风险：抽取器对已存在的 outFile 是合并语义 ⇒ 包装器不先 `rmSync` 就会用上一轮残留凑满 12 条变假绿，已在脚本头注明并实测。
- **R8（P9 已发生，非假设）fail-closed 只做了「抛出去」，没做「看得懂」**：`tasks 3.6` 首跑（日志 `227`）退出码与「零 HTML 产物」两条成立，但报错只有 `TypeError: fetch failed`——undici 把真实原因挂在 `err.cause`，Astro 打印只取 `err.message` ⇒ 说不出是哪份数据、哪个 URL、哪个站点，也不表述「有没有回退」。控制流正确不代表失败路径可用：运维拿到这行只能靠猜（PROB-028）。→ 在 `lib/payload.ts` 加 `connectFailure()` 只改写错误文本（带数据名 + 完整 URL + 底层原因 + 「不回退」口径 + `{cause}` 保留原异常），并新增 P-V6 的零参数门禁把「可读」钉成判定项（要求输出含「不回退」），红的一侧先在 `228` 自证。教训：**写失败路径时，「不兜底」和「说清为什么不兜底」是两半，缺后半等于把静默从产物层挪到报错层。**
- **R9（P9 已发生，非假设）跨长构建的写测试必须有独立恢复路径**：`235-rebuild-selfservice.mjs` 的结构是「PATCH 写测试串 → 跑 ~90s 构建 → `finally` PATCH 复原」。首跑恰在 `finally` 那一步炸（`ECONNRESET`：空闲太久的连接被 Next dev 单方面断），测试串留在真实数据行里——不是断言失败，是**恢复动作本身没有容错**（日志 `235` 红、库内长度 27）。→ 恢复改为两步：新增独立可重放的 `236-restore-pricing-hero.mjs`（从 git-tracked 快照写回 + 经公开端点验证，NOOP 分支保证可复跑），并在 235 内对连接类失败重试 + 开工先断言现值不是测试串（是则拒跑并指向 236）。同类风险在 e2e 常驻用例里由「`fullyParallel:false` + `workers:1` + 无条件 `finally`」承担。教训：**凡是「改共享数据 → 长操作 → 复原」的脚本，复原路径必须能脱离本次运行独立执行**，否则一次网络抖动就把测试数据留在库里。
- **回滚**：代码侧 `git revert` 本 change 提交即可（`content/*.ts` 数据文件在 P1 有快照副本）；数据侧本地库执行本次迁移文件的 `down`（仅新增表、无既有表改动，DROP 安全），线上零操作故无需线上回滚。

## Evidence

- 本文件；`.aiws/changes/astro-page-copy-cms/{proposal,design,tasks}.md`
- `.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import/`（12 份 JSON dump + 三站四页文本基线）
- `.aiws/changes/astro-page-copy-cms/evidence/verify-before-complete.md`（P-V1..P-V7 实测输出与退出码）
- `.aiws/changes/astro-page-copy-cms/evidence/client-bundle-regression-fix.md`（P-V8 与 PROB-026 结案）
- `.aiws/changes/astro-page-copy-cms/evidence/delivery-build-gates-p8.md`（P-V2/P-V3/P-V9 的交付门禁实测与 PROB-027 结案）
- `.aiws/changes/astro-page-copy-cms/evidence/selfservice-and-negative-build-p9.md`（P-V5/P-V6 的实测与 PROB-028 结案）
- `.aiws/tmp/astro-page-copy-cms/*.log`（构建/校验原始日志，可弃）
- `.aiws/issues/problem-issues.jsonl`：PROB-023（品牌硬编码，另立 change，保持 OPEN）；PROB-024（`cap-tag` 类名拼接缺分隔符，2.16 结案）、PROB-025（apps/astro 无类型检查入口，P2 结案）、PROB-026（删兜底放出的客户端运行时断裂，P6/P7 结案）、PROB-027（抽取器被记成零参数门禁，P8 结案）、PROB-028（CMS 不可达的报错不可读 + 该性质无零参数入口，P9 结案）均在本 change 内转 DONE
