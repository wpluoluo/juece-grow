# Change Proposal: astro-page-copy-cms

> Title: Astro 公开站页面文案入 CMS（每页一个结构化集合 + 首页 hero/CTA 可排序）
>
> Created: 2026-09-20T09:57:36Z

## 目标与非目标

**目标：**
- 运营在 Payload 后台即可修改三站（juece / erp / yunque）四页（首页 / 功能 / 方案 / 价格）的文案，改完重新构建公开站即生效，不需要改代码、不需要评审发版。
- 首页 hero 与 CTA 区块的子条目支持后台增删与拖拽排序，公开站按后台顺序渲染。
- 建模形态（owner 2026-09-20 裁决）：**方案 B 打底** —— 每页一个结构化 Payload 集合，字段与 `apps/astro/src/content/{home,features,solutions,pricing}.ts` 的 TS 类型一比一，保留编译期字段校验。
- 迁移前后公开站渲染文本逐字一致（≈1171 个文本单元，差异清单为空）。
- 构建期 CMS 不可达 / 该站该页无已发布记录时，`astro:build` 以非零码硬失败，不回退到代码内旧文案、不产出空白区块。

**非目标：**
- 不建通用 `PageBlocks` 区块表、不做整页拖拽可视化搭建与模板市场。
- 不引入 `versions` / `drafts` / `livePreview`（全仓零命中），沿用既有 `status: select` 约定。
- 不做 i18n 多语言文案版本，不做发布审批流与定时发布。
- 不改公开站视觉与 DOM 结构。
- 法务页 / 404 / 站点地图页 / `feed.xml` / 文章 JSON-LD publisher 的品牌与域名硬编码**不在本 change**（登记 PROB-023，另立轻量 change）；但 `site.ts:168` 与 `astro.config.mjs:4` 的 `SITE_ID` 兜底留在此处一起治（同一「构建期不许静默」边界）。
- 不做任何生产服务器操作；迁移文件入库但线上不执行（owner 已裁决不为线上迁移开维护窗口）。

## 主索引绑定（强制）

- `Change_ID` = astro-page-copy-cms
- 需求交付：`Req_ID` = REQ-0003
- 问题修复：`Problem_ID` = PROB-024
- `Contract_Row` = Req_ID=REQ-0003,Problem_ID=PROB-024
- `Plan_File` = .aiws/plan/2026-09-20_10-04-01-astro-page-copy-cms.md
- `Evidence_Path` = .aiws/changes/astro-page-copy-cms/evidence/verify-before-complete.md, .aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import.md, .aiws/changes/astro-page-copy-cms/design.md, .aiws/changes/astro-page-copy-cms/review/spec-review.md, .aiws/changes/astro-page-copy-cms/review/quality-review.md, .aiws/changes/astro-page-copy-cms/evidence/change-status-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/change-validate-strict-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/aiws-validate-stamp-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/change-sync-stamp-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/collaboration-summary-20260920-224221Z.json, .aiws/changes/astro-page-copy-cms/evidence/delivery-summary-20260920-224221Z.md

## 依赖关系（可选）

- `Depends_On` = cleanup-batch-20260919（已归档；其 CORS fail-fast 收敛与 e2e 前置口径是本 change 验证入口的前提）
- `Blocks` = （无）

## 现状与问题

- 三站四页营销文案硬编码在 `apps/astro/src/content/*.ts`（1933 行；HEAD 版 `wc -l` 口径：home 586 / features 523 / solutions 549 / pricing 275。另一处出现的 1937 是 `git diff --numstat` 的删除行数口径（587/524/550/276，每文件多算末行换行），两个数各自成立但不可混排，本 proposal 统一取 1933）与 `apps/astro/src/site.ts`（179 行）；页面 `.astro` 只是渲染器，仅剩零星字面文案在模板里（`pricing.astro:55-56`、`index.astro:353`、`index.astro:370`）。改一个字要走代码评审 + 重新构建发版。
- 文章类内容早已在 Payload 后台管理（`collections/Articles.ts` + `/api/v2/content/articles`），页面文案是最后一块仍在代码里的内容。
- 取数接缝只有一条：`apps/astro/src/lib/payload.ts`（59 行，`CMS_ORIGIN` + `?site=` 按站隔离）。但该文件 `:5` 注释承诺的「缺省即 fail-fast」并不成立——没有任何 `PUBLIC_CMS_ORIGIN` 校验；`articles/route.ts:84` 的 `?? 'juece'` 与 `:119` 的空数组 `ok({articles:[]})` 会让「拉不到」静默变绿。
- `site.ts:168` 的 `|| 'juece'` 让不带 `SITE_ID` 的构建（根 `astro:build`、`astro dev`）静默按主站跑；`astro.config.mjs:4` 同。
- 类型重复：`IconKey` 原声明在 `home.ts:8`、由 `solutions.ts:7` 与 `pages/index.astro`（经 `home.ts` 的 `export type { IconKey }` 前向转发）import，全仓仅此一份联合（规划轮曾误记「`features.ts` 内联重复一份」，实测该行是 `FeaturePanel` 的五路 `kind` 判别联合，`features.ts` 从不涉及 `IconKey`）。真实的重复是三处同形 `{ value, label }` 结构（`features`/`solutions` 的 `hero.stats` + `home` 的 `cases.feature.metrics`）；`components/sections/PageHero.astro:6-13` 与 `PricingTable.astro:2-12` 又各自复制了 `hero.stats` / `PricingPlan` 的结构，`FeatureGrid.astro` 另抄了一份已与真值漂移的 `FeatureItem { title; desc? }`。
- 渲染器有位置耦合：`index.astro:146-148` 把 `chips[0..2]` 硬映射到 `chip-a/b/c`（第 4 个静默丢弃）、`diagram.nodes` 按 `92 + i*112` 摆在固定 `viewBox 0 0 480 500`（>3 溢出）、`cases.minis` 标签取 `['A','B'][i]`（第 3 个渲染 `undefined`）。
- 实测缺陷：`features.astro:127` 拼出类名 `cap-tagyb`，而 CSS 是 `.cap-tag.yb`（`:212`）⇒ `tagTone` 的暖金配色从未生效，且三站各中一处（`features.ts:155` / `:316` / `:476` 各有一条 `tagTone: 'yb'`）（PROB-024）。

## 方案概述（What changes）

1. **CMS 侧**：新增 4 个页面内容集合（`apps/cms/src/collections/pages/`），字段一比一镜像 TS 类型，全部中英双语 label；`project` relationship 必填 + `beforeChange` 唯一性钩子（同集合内每项目一条记录，TS 类型里没有 `id`/`slug`，页面身份即集合身份）；`status` select（`draft` 默认 / `published`）；页面标题/描述的唯一载体是一比一镜像出来的 `meta.{title,description}`，**不设** `seoTitle`/`seoDescription` 覆写字段（那会是零消费者的第二套载体），canonical 保持构建期派生（design D8）。
2. **有序性**：首页 `hero.titleLines[]` / `hero.stats[]` / `cta.rows[]` 用 Payload 原生 array（后台拖拽即排序，数组索引序即展示序，**不存 `sortOrder` 列**——那是双写）；位置耦合列表在 schema 上锁死长度（`chips` = 3、`nodes` ≤ 3、`cases.minis` ≤ 2）。
3. **读端点（唯一接缝）**：新增 `GET /api/v2/content/pages?site=&page=`，`site` 必填（与 articles 的 `?? 'juece'` 分道）、`page` ∈ {home,features,solutions,pricing}、只回已发布、未命中 404 `PAGE_COPY_NOT_FOUND`、异常先 `logger.error` 再 500。
4. **导入与验收**：`apps/cms/scripts/import-astro-copy.ts`（`pnpm --filter cms exec payload run scripts/import-astro-copy.ts`；三站 × 四页 = 12 条已发布记录。首建时按 `project + 集合` 幂等；存量已在的**覆盖式**重建必须显式 `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1`，否则硬失败——见 PROB-030）+ `scripts/astro-copy-parity.mjs`（端点数据 vs 代码内 dump 深比，任一差异非零退出）。导入前先把原样快照（12 份 JSON dump + 三站四页文本基线）落到 `evidence/snapshot-pre-import/` 供逐字比对与回滚。
5. **Astro 侧**：类型抽到 `apps/astro/src/types/pages/`（单一真值，组件的结构复制品改 import）；四页 frontmatter 改 `await getPageCopy(...)`；`lib/payload.ts` 新增 `getPageCopy`，`CMS_ORIGIN` 缺失即模块级抛（P6 起该校验落在客户端安全模块 `lib/cmsOrigin.ts`，服务端模块从它 import，见 design D6）；**删除** `apps/astro/src/content/*.ts` 四个数据文件（不留代码内兜底副本）。
6. **去兜底**：`site.ts:168` 与 `astro.config.mjs:4` 的 `|| 'juece'` 移除；`apps/astro/package.json` 的 `dev` / `build` 显式 `cross-env SITE_ID=juece`（否则根 `astro:build` 与 e2e 前置 `astro dev` 会因去兜底而红），删冗余 `build:juece`。
7. **e2e**：新增页面文案读路径用例。**P6 落地追加**：新增 `apps/e2e/tests/page-copy.spec.ts`（5 个 `test(` / 参数化后 8 条）；该轮同时抓到第 6 条删兜底暴露的客户端运行时断裂（PROB-026）——修法是把 `CMS_ORIGIN` 挪进客户端安全模块 `apps/astro/src/lib/cmsOrigin.ts`（唯一实现、无 re-export 垫片、不改 DOM），并新增产物级门禁 `scripts/astro-copy-client-bundle.mjs`（design D6 P6 追加条、tasks 3.11）。**P9 落地追加**：「后台改文案 → 断言新串出现旧串消失」由一次性验证升级为常驻用例（`page-copy.spec.ts` 第 6 组，`finally` 复原 + 整份 copy 深比），产物层另跑重建回环；同轮发现 CMS 不可达时只抛 `fetch failed`（不满足上文「目标」里那条硬失败口径中「看得懂」的那一半），在 `lib/payload.ts` 补连接层错误的可读文本并新增零参数门禁 `scripts/astro-copy-cms-unreachable.mjs`（PROB-028、tasks 3.13）。**P11 落地追加（两处反转本条原计划）**：(a) 原计划「保留 `lead.spec.ts:11-16` 的 hero 文本断言」作废——那句话术自 REQ-0003 起归运营，锚它会让留资用例因无关改稿而红，改为结构断言（`h1.hero-title` 可见且 `span.line` 非空），验收第 2 条的常驻对面由 `page-copy.spec.ts` 第 6/7 组承担（PROB-034）；(b) 新增第 7 组「首页 hero 删一行+追加一行+倒序、cta 倒序+追加一行 → h1 逐行与 .cta-row 逐行都是后台数组序」（spec-review B-1 的机器对面，`hero-diff` 门禁因判「与导入前基线一致」而看不见换序，替代不了它）。
8. BREAKING：无对外接口破坏（纯新增端点）；但 `astro build` 从「无 CMS 也能构建」变为「必须有 CMS」（这是需求要求的行为），且 `pnpm --filter astro build:juece` 脚本被合并。

## 协同与委托（可选）

- `analysis/`：
  - 字段清单取证（1933 行内容文件的 leaf 文本单元统计、非文本字段分类、跨站差异、位置耦合）在规划轮由 Explore 只读代理产出，结论已并入本 proposal 与 `design.md`，不另存原始稿。
- `patches/`：不使用。
- `review/`：
  - `spec-review.md`（流程/归因/越界）+ `quality-review.md`（实现与测试覆盖），双审查 triage 后收敛 HIGH blocker。

## 影响范围（Scope）

### In Scope（本次改动范围）

- `.aiws/`
- `REQUIREMENTS.md`
- `docs/`
- `AI_WORKSPACE.md`
- `apps/cms/`
- `apps/astro/`
- `apps/e2e/`
- `scripts/`
- `package.json`

### Out of Scope（明确不改动）

- `apps/cms/src/collections/{Leads,Sites,Forms,Projects,Users,Memberships}.ts` —— 既有集合不动（新集合放 `collections/pages/` 子目录）；PROB-022 的信封双写不顺手重构。
- `apps/cms/src/lib/envelope.ts`、`apps/cms/src/access.ts` —— 复用不修改。
- `apps/astro/src/pages/{privacy,terms,sitemap,404}.astro`、`feed.xml.ts`、`articles/[slug].astro` —— 品牌硬编码另立 change（PROB-023）。
- `docs/08-deployment.md`、`scripts/cms-run.sh`、`scripts/backup.mjs` —— 本 change 零线上操作，部署契约不变。
- 文章/媒体/线索数据模型 —— 不动。

### 外部影响

- 可能影响的外部接口/使用方：
  - 新增公开端点 `GET /api/v2/content/pages`（只增不改）。
  - `pnpm astro:build` / `pnpm --filter astro dev` 的行为收紧：CMS 不可达即失败（CI/本地/部署脚本三条路径都会看到）。
  - `apps/astro/src/content/*.ts` 被删除 —— 任何外部引用（当前全仓仅 4 个页面 + 组件类型复制品）必须同批改齐。

## 风险与回滚

- 风险：
  - **R1 逐字漂移**：≈1171 个文本单元手工映射，内嵌 ASCII 双引号（`features.ts:158`）与字面 `\n`（`solutions.heading` / `cases.heading`）易被脚本吃掉。→ parity（数据层）+ 渲染文本 diff（P-V4）双闸门。
  - **R2 排序能力打开位置耦合**：`chips` 第 4 项静默丢弃、`nodes` >3 溢出画布、`minis` 第 3 项渲染 `undefined`。→ schema 的 min/max 校验钉死，不靠文档提醒。
  - **R3 去 SITE_ID 兜底打断既有入口**：根 `build.mjs:48` 与 e2e 前置都靠兜底跑主站。→ 与脚本改动同批落地并跑 P-V3/P-V5。
  - **R4 迁移不自动跑**：本地账本 batch=-1，新表经 psql 建；线上永不自动 migrate。→ 交付说明写「线上未执行、未核实」，不把本地绿当线上绿。
  - **R5 渲染器与 CMS schema 脱钩**：删掉 `content/*.ts` 后类型只剩一处，后台漏字段不会让 `tsc` 红。→ 类型源收敛 + parity 按类型断言必填。
- 回滚方案（必须可执行）：
  - 代码：`git revert` 本 change 的提交（`content/*.ts` 原文在 `evidence/snapshot-pre-import/` 有完整副本，可逐文件还原）。
  - 数据：本地 5434 库执行本次迁移文件的 `down`（仅新增 4 张表，不动既有表，DROP 安全）。
  - 线上：本 change 无线上动作，故无线上回滚项。

## 验证计划（必须可复现）

> 前置：`pnpm db:up` && `apps/astro/.env` 含 `PUBLIC_CMS_ORIGIN`（消费方地址；`apps/cms/.env` 侧对应的是 `PUBLIC_CORS_ORIGINS`）&& CMS dev 在 `:3000` && `pnpm astro:dev` 在 `:4321`。退出码一律由命令自身落盘，不过管道。

- 命令：
  - `node scripts/astro-copy-parity.mjs`
  - `pnpm --filter cms build`
  - `pnpm astro:build && pnpm astro:build:erp && pnpm astro:build:yunque`
  - `node scripts/astro-copy-render-diff.mjs`
  - `node scripts/astro-copy-hero-diff.mjs`（P-V9：三站 12 条 hero `<h1>` 内部 DOM 与导入前基线逐字节一致；`astro-copy-hero-dom.mjs` 只是它调用的抽取器，要三个入参）
  - `node scripts/astro-copy-client-bundle.mjs`（P-V8：三站产物的客户端 chunk 不得含服务端站点解析代码）
  - `pnpm --filter e2e test`
  - `node scripts/astro-copy-cms-unreachable.mjs`（P-V6，P9 落地为常驻门禁：脚本自己把 `PUBLIC_CMS_ORIGIN` 注入子进程指向死端口后跑真实 `pnpm astro:build`，**不改 `apps/astro/.env`**——Vite `loadEnv` 下进程 env 优先，含令牌的配置文件不做「临时改一行再改回」）
  - `aiws validate .` && `aiws change validate astro-page-copy-cms --check-scope`
- 期望结果：
  - parity 输出 `12/12 (site,page) 逐字一致`、exit 0；
  - cms build exit 0（含全量 TS 检查）；三站构建均产出各自 `dist*` 且无 `ECONNREFUSED`（P8 实测：`191` `cms_build_exit=0` 且生产路由清单含 `/api/v2/content/pages`；`193`/`194`/`195` 三站各 `exit=0`、逐日志 `ECONNREFUSED=0`；`196` `node scripts/build.mjs` `exit=0` 且**未触发** libuv 白名单分支——告警文案零命中，真 0 退出）；
  - 渲染文本差异清单为空；
  - hero DOM 零参数门禁输出 `12/12 三站四页 hero <h1> 内部 DOM 与切换前基线逐字节一致`（P8 实测 `201` `exit=0`，咬合力自测 `202`：注入多余 `<span>` → `exit=1` 且点名 `juece/home`，还原 → `exit=0`；P9 在三站全部重建后复跑 `251` `exit=0`。**边界**：它锁的是「本次迁移没顺手改结构」，上线后任何合法改稿都会让它红 ⇒ 不串进 `scripts/build.mjs`）；
  - 客户端 bundle 门禁三站均「禁止串命中=0 / CMS地址已内联=true / 判定=OK」（P6 实测 `173` `exit=0`，咬合力自测 `174`；P9 在三站全部重建后复跑 `250` render-diff / `252` client-bundle / `253` parity 各 `exit=0`——首轮 `239`–`242` 时 `dist-erp`/`dist-yunque` 仍是 P8 的产物，而 PROB-028 改的 `lib/payload.ts` 三站共用，故不以那轮为准）；
  - e2e 全绿且含新增页面文案用例（P6 实测 `170`：67 passed / 2 skipped / `exit=0`；**P9 全量 `243`：68 passed / 2 skipped / `e2e_full_exit=0`**，多的那条是第 6 组「后台自助改稿」：管理员 PATCH 一条已发布文案 → 端点与 `/pricing` 读到新串、旧串消失 → `finally` 复原并把整份 copy 与改前快照深比，单跑 `234`；产物层另由 `235-rebuild-selfservice.mjs` 证「改稿 → 重建 → `dist` 新串命中且旧串零残留 → 复原重建」，`238` `RESULT 3.5-rebuild=OK`）；
  - 负向构建 `exit=0` 且四条判定成立（死端口不可连接 / 构建退出码非零 / 输出含 `ECONNREFUSED`+该端口号且含「不回退」 / `dist` 内 HTML=0）。P9 实测：修 PROB-028 前 `228` 红（`可读错误命中=false`）⇒ 咬合力自证；修后 `230`/`232`/`233` 三次 `判定=OK`。注：**这条会清空 `dist`**，跑完须重建才能再跑上面三道读 `dist` 的门禁；
  - `aiws validate .` exit 0；`--check-scope` 按 PROB-011 已知失效点核对，不静默放行。

## 真值文件/合同更新清单

- `REQUIREMENTS.md`：需要 —— REQ-0003 已于 2026-09-20 写入 Backlog（8 条验收）；**已完成**：文末治理项说明不再写死 PROB 区间（原 `PROB-001..011` 与实际 022+ 漂移）；验收第 7 条已补「只搬页面文案、品牌/导航配置不在范围」的边界。交付时：勾验收框并移入「已完成」。
- `.aiws/requirements/CHANGELOG.md`：需要 —— 追加 REQ-0003 行（2026-09-20 已追加登记行；交付时再追加状态推进行）。
- `.aiws/requirements/requirements-issues.csv`：不适用 —— 本仓实际合同文件是 `.aiws/requirements/requirements-issues.jsonl`（PROB-009 已登记该漂移）；REQ-0003 行已追加，交付时把 `Impl_Status` TODO → DONE。
- `.aiws/issues/problem-issues.csv`：不适用 —— 实际为 `problem-issues.jsonl`；2026-09-20 规划轮追加 PROB-023（品牌硬编码，另立 change，`OPEN`）与 PROB-024（`cap-tag` 类名拼接缺分隔符，登记时 `OPEN`），台账 22 行 → 24 行。实现轮另新增并当场结案五条：PROB-025（apps/astro 无类型检查入口）、PROB-026（2.15 删兜底放出的客户端运行时断裂）、PROB-027（三参数抽取器被记成零参数门禁）、PROB-028（CMS 不可达时只抛 `fetch failed`，「可读错误」不成立且该性质无零参数入口）⇒ 台账现 **28 行**，其中 024/025/026/027/028 均 `DONE`，仅 023 保持 `OPEN`（归另一个 change）。
- `docs/03-data-model.md`：**已完成** —— §2 `Page`/`Block` 两行按方案 B 改写、§3 草稿行改为「`project` + 页面身份＝集合身份 + 展示序＝数组索引序」、§4 设计原则去掉「带 sortOrder」口径（排序列与数组索引是同一事实，属双写）。
- 证据落盘（推荐双层）：
  - 持久：`.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import/`（导入前原样快照，回滚依据）、`.aiws/changes/astro-page-copy-cms/evidence/verify-before-complete.md`（P-V1..P-V7 实测）、`.aiws/changes/astro-page-copy-cms/evidence/client-bundle-regression-fix.md`（P-V8 + PROB-026 结案）、`.aiws/changes/astro-page-copy-cms/evidence/delivery-build-gates-p8.md`（P-V2/P-V3/P-V9 + PROB-027 结案）、`.aiws/changes/astro-page-copy-cms/evidence/selfservice-and-negative-build-p9.md`（P-V5/P-V6 + PROB-028 结案）、`review/spec-review.md`、`review/quality-review.md`
  - 临时：`.aiws/tmp/astro-page-copy-cms/*.log`（构建/e2e/负向原始日志与退出码）
  - 协同：`.aiws/changes/astro-page-copy-cms/review/`
