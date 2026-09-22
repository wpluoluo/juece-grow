# Verify Before Complete · astro-page-copy-cms

> Change: `astro-page-copy-cms` ｜ 分支 `change/astro-page-copy-cms`（**本地已提交三个**：`0872bd0` 代码与证据 / `1c530a4` 文档 / `3242886` memory-bank 单独一次；**未推送、未 finish**，见 §7）
> 时间：2026-09-21 起，末次复算 2026-09-22（P15 台账补账轮，见 §7 行 37）（本地容器库 `127.0.0.1:5434` / Docker `juece-grow-postgres`；CMS dev `127.0.0.1:3000`；公开站 dev `127.0.0.1:4321`。**线上地址未连接、未执行任何命令**）
> 本文是 tasks 4.1 的产物，也是 `AI_PROJECT.md` / `ws-review` 的 verify-before-complete 门禁面：它不重复各轮证据，只把 **P-V1..P-V9 的最终实测**、**REQ-0003 八条验收的对面**、**双审查 triage 的净结论**三件事收在一处，并如实写明**哪些只有源码级对面、哪些根本没跑**。
> 分轮证据（本文只引用，不改写其结论）：`snapshot-pre-import.md`、`schema-and-projection.md`、`migration-import-endpoint.md`、`astro-read-path-switch.md`、`client-bundle-regression-fix.md`、`delivery-build-gates-p8.md`、`selfservice-and-negative-build-p9.md`、`home-hero-cta-order-e2e-p11.md`、`project-uniqueness-p11.md`、`gates-promoted-and-log-archive-p11.md`。

---

## 0. 指针与台账口径限制（顶部写死 —— 规范审查 H-1 / W-9 要求的声明）

| 限制 | 事实 | 复核命令 |
|---|---|---|
| 指针的持久性 | `evidence/verification.jsonl` 每一行的 `artifact` 指向 `.aiws/tmp/astro-page-copy-cms/`（gitignored）。H-1 报的「190/190 指针在换 clone 后全断链」已按**归档镜像**修掉：台账全部行的日志正文都逐字节复制进 git-tracked 的 `evidence/logs/`，并由 `scripts/astro-copy-evidence-archive.mjs` 用 sha256 核对（最新一轮：`台账行数=460 无 artifact 行=0 不同 artifact=451 … sha256 与原件一致=460 问题=0`，日志 `512`；P14 收口时为 406 行 / 397 不同 artifact，日志 `458`；P13 收口时为 349 行 / 343 不同 artifact，日志 `421`；p13 入账前为 318，日志 `393`）。**口径**：跨 clone 复核的依据是归档件，不再依赖 tmp 原件 | `node scripts/astro-copy-evidence-archive.mjs` |
| 台账起点 = 20 | 台账最早的 `artifact` 是日志 `20`（P1 轮首份）。规划轮的日志 `01`–`19`（preflight、真值阅读、change start 一类）**不入账**——它们是决策过程而非验收判定。P14 把这条口头政策升级成可核对的机制：`448` 脚本里那份**逐份带理由的声明式排除表**（36 份：规划轮、常驻 dev 服务日志、落盘时未记退出码 17 份（P15 新增 `457`）、命令字面量不可复现四类）是唯一真值，本行只作索引不复述清单（§4 禁双写）；表自带反向自检——任一份若已被入账即报「排除表过期」并红。任何「台账覆盖了全部执行过的命令」的读法都不成立 | 见 `tasks.md` 3.10、`node .aiws/tmp/astro-page-copy-cms/448-audit-logs-missing-from-ledger.mjs` |
| appender 不能登记自己的日志 | 写行时该轮的收尾日志还不存在 ⇒ 每轮尾部若干份日志必然留到下一轮补账。P12 补登 `359`–`391`（33 条）、P13 补登 `392`–`416`（31 条）、**P14 补登 `417`–`452`（57 行，台账 349→406 行）**、**P15 补登 54 行覆盖 54 份日志（`447b` + `453`–`506` 里除 `457` 与 `472`，台账 406→460 行）** ⇒ 写作时未入账的只剩 `507` 起的本轮尾（预检、入账首跑与复跑、三向复算、口径同步与两次红首跑、doc-claims、aiws 链、末次镜像）。**「行要等下一轮」与「证据会丢」是两件事**：前者结构上消不掉，后者在 P14 已被 `449-mirror-all-logs.mjs` 的全量镜像彻底收口（`tmp 侧=426 归档侧=426 复制前缺=55 新复制=55 复制后缺口=0`，`449`），不再依赖手工补抄。**因此任何「覆盖率 100%」的说法都不成立** | `node .aiws/tmp/astro-page-copy-cms/448-audit-logs-missing-from-ledger.mjs`（从磁盘上的日志反向点名，字节面与入账面分开卡）、`114-audit-ledger-coverage.mjs`（正向）、`221-uncovered-rows.mjs`（反向） |
| appender 的 `ROWS` 必须自包含 | 两只审计器把每只 appender 里字面量 `const ROWS = [...]` 抠出来单独求值，只注入 `tmp` 一个形参 ⇒ 引用其它模块级常量即 `ReferenceError`，审计器**崩溃而非静默少账**。P12 踩中：曾把 note 公共前缀提成 `NOEXIT` 常量，`394`/`395` 同时 exit=1；修法是让 note 自包含（`397`，并断言改源码不改台账文字），复跑 `AUDIT ledger_rows=349 missing_total=0` / `ledger=349 covered=339 uncovered=10`（`419`/`420`；p12 修复当时为 318 行，`398`/`399`）。**p13 起新增前置**：入账前先跑 `416-selfcheck-p13-rows.mjs`，用审计器同一个正则逐字 eval 本支 `ROWS`（它自己第一版也栽过——切片少一位，`416` 里 `exit=1` 如实留档） | `node .aiws/tmp/astro-page-copy-cms/416-selfcheck-p13-rows.mjs`（只读预检，不写盘） |
| 反向覆盖的固有缺口 | 反向审计只扫 `append-verification-*.mjs` 里的字面 `const ROWS`，故 P1 轮由 `gen-verification-p1.mjs` 直写的 **10 条**（日志 20–32）结构性地算 uncovered —— 不是丢账，也不为此再造一只 appender | 同上，`uncovered=10` |
| 双向覆盖 ≠ 「tasks 每条都被核过」 | appender↔ledger 两向覆盖只保证「声明过的行都在册、在册的行都有出处」。它**不包含**「tasks.md 每一条 → 台账」那个方向，别把这两向读成后者 | — |

---

## 1. P-V1..P-V9 最终实测（plan 的 Verify 表逐条对账）

下表是**交付前最后一次全量复跑**的结果。日志编号均指 `evidence/logs/<NNN>-*`（tmp 同名原件已镜像）。本表覆盖的 `370` 起，退出码一律由命令自身 `>>` 落盘、未过管道（记忆 `exit-code-no-pipe`；更早的 `359`–`368` 未落退出码，§0 已如实声明）。
其中三条**产物级**门禁（P-V4 / P-V8 / P-V9）在 `384` 之后又于最终产物复跑一次：`385` `render_diff_exit=0`、`386` `hero_diff_exit=0`、`387` `client_bundle_exit=0` ⇒ 表里的 `379`–`381` 是链中读数，最终态读数是 `385`–`387`，两者都绿。边界如实说：`384` 的 `node scripts/build.mjs` 只重建 cms 与**主站** dist，ERP/云雀的产物仍是 `377`/`378` 那一版（同样晚于 `374` 的清空，且 `380`/`386` 的 `[dist-fresh]` 逐站判「新鲜」）。

| P-V | 验的是哪一层 | 零参数命令 | 本轮日志 | 落盘的退出码行与关键判定 |
|---|---|---|---|---|
| P-V1 | 数据层：端点 `data.copy` 与「快照 → `toSchemaShape` → `toReaderShape`」逐字一致 | `node scripts/astro-copy-parity.mjs` | `372` | `parity_exit=0`；`12/12 (site,page) 逐字一致`；端点侧叶子字符串 **1374**（与 P1 dump 独立实测同值） |
| P-V2 | CMS 全量 TypeScript 检查 + 构建（红线：不交给 aiws 截断） | `pnpm --filter cms build` | `375` | `cms_build_exit=0` |
| P-V3 | 三站产物 + 根交付构建 | `pnpm astro:build` / `:erp` / `:yunque`，再 `node scripts/build.mjs` | `376` / `377` / `378` / `384` | `build_juece_exit=0`、`build_erp_exit=0`、`build_yunque_exit=0`、`build_mjs_exit=0`；`384` 中 `libuv` 命中 **0**（即根构建未走「忽略退出阶段崩溃」的白名单分支——那是 P8 前曾把假绿放过去的口子） |
| P-V4 | 渲染层：切换前后三站四页**可见文本**逐字 | `node scripts/astro-copy-render-diff.mjs` | `379` | `render_diff_exit=0`；基线 12 份齐全、`差异 0 条`；附带三站 `cap-tag` 配色类断言（PROB-024 那处修复的常驻对面） |
| P-V5 | 浏览器层：后台改稿 → 公开页读到新串、旧串消失；及首页 hero/CTA 增删换序 | `pnpm --filter e2e test` | `383` | `e2e_full_exit=0`（`69 passed / 2 skipped`）。含 `page-copy.spec.ts:188` 自助改稿组与 `:315` **首页 hero/CTA 增删换序**组（B-1 补的常驻对面）。产物层一次性回环（PATCH → 重建 → 断 `dist` → 复原重建）为 P9 的 `238`，非常驻 |
| P-V6 | 负向：构建期拉不到 CMS 必须硬失败且报错可读、零产物、不回退 | `node scripts/astro-copy-cms-unreachable.mjs` | `374` | `unreachable_exit=0`；内部四条判定全成立：`dead_origin=…:59999 可连接=false` → `build_exit=1` → `ECONNREFUSED`+端口命中 → `dist_html=0`。**该门禁会清空 `apps/astro/dist`** ⇒ 位置只能在三站重建之前（§5） |
| P-V7 | AIWS 治理校验 | `aiws validate .`；`aiws change validate astro-page-copy-cms --strict`；再 `--check-evidence --check-scope` | `367` / `368` / `369` → 最终态 `389` / `390` / `391` | `367` `✓ aiws validate`；`368` `ok: change validated`；`369` **exit=2、4 条 error**（`verify-before-complete.md` missing ×2 + finish gate ×1 + `.gitignore` out-of-scope ×1）——这是真缺口，按 `expected=0 / failure` 入账不粉饰。本文落盘 + plan 的 In Scope 补 `.gitignore` 后，收口链 `388`（`aiws change sync`，`No changes detected vs baseline.`）→ `389` → `390` → `391` 全部 exit=0，`391` 即 `ok: change validated (astro-page-copy-cms)` |
| P-V8 | 产物层·客户端 bundle（PROB-026：五道服务端门禁全绿时的运行时断裂） | `node scripts/astro-copy-client-bundle.mjs` | `381` | `client_bundle_exit=0`；三站各 `client_js=1 禁止串命中=0 CMS地址已内联=true Layout脚本chunk=有`。谓词偏弱一事已登记 **PROB-037**（只要求出现任意 http 字面量） |
| P-V9 | 产物层·hero `<h1>` 内部 DOM 逐字节 vs 导入前基线 | `node scripts/astro-copy-hero-diff.mjs` | `380` | `hero_diff_exit=0`；`12/12 逐字节一致`；三站 `dist 最大 mtime > src 最大 mtime` 均判「新鲜」（HIGH-3 的 dist 新鲜度判据）。**边界：迁移期守卫**，第一次合法改稿就会让它红（PROB-041），不得串进常驻构建链 |

追加的常驻门禁（不在 plan 的 P-V 表内，由 spec 审查 H-2/H-3 与 W-6 要求固化）：

| 门禁 | 日志 | 判定 |
|---|---|---|
| `node scripts/astro-copy-coverage.mjs`（12 份快照路径 ⊆ 四集合 schema，`A\B` 必须为 0） | `370` | `coverage_exit=0`；`A\B total=0`；`B\A` 仅 `hero.primary.href` / `products.spotlight.link.external` / `plans[].currency` 三条「类型可选、快照未填」 |
| `node scripts/astro-copy-agents9.mjs`（AGENTS.md §9 自检的**可机检版**） | `371` | `agents9_exit=0`；含 `§4 自研文件 ≤1000 行`（最大 `features.astro` 595）、`\|\| 'juece'` 命中 0、`content/` 目录已删、`payload.ts` 的 3 处 catch 全为抛错或诊断字符串、§5 无 snake_case、§6 统一信封与 `/api/v2/*`、§9 SEO 三件套在 Layout 落地 + 四页 `meta` 取自 CMS、`§7 线索主数据未被本 change 触碰` |
| `node scripts/astro-copy-evidence-archive.mjs` | `382` | `archive_exit=0`（见 §0 第一行） |
| `node .aiws/tmp/astro-page-copy-cms/340-doc-claims-audit.mjs`（工件口径 ↔ 盘上实物） | `373` | `docclaims_exit=0`；`废弃串=11 表体行=12 门禁=8（存在 8） PROB-029+ 16 行（DONE 7/OPEN 9） 问题=0`、`tasks 3.10 台账真实=285 行 / appender=18 只`。**红侧已自证**（`365`：篡改台账行数与 appender 只数 → 逐条点名 → 还原后 sha256 相等） |

---

## 2. REQ-0003 八条验收逐条对账（4.2 勾选的依据）

`REQUIREMENTS.md` 的验收清单共 8 格。下表给出每格的对面与**成色**——凡「只到源码级、产物级未固化」的都在成色列写清楚，不许按「全绿」勾选。

| # | 验收条目（摘要） | 对面 | 成色 |
|---|---|---|---|
| 1 | 四类页面集合存在、字段与 TS 类型一比一、label 双语 | `astro-copy-coverage.mjs`（`370`）+ 三处受控形变的唯一实现 `pageCopyProjection.ts` + `tasks 2.4` 记录的行数/leaf 规模 | **一比一=机器对**（路径集合 `A\B=0`）；**双语 label 无门禁**——只有 grep 计数（`PageHome.ts` 115 / `PageFeatures.ts` 94 / `PageSolutions.ts` 33 / `PagePricing.ts` 41 处 `en:`），未固化成逐字段断言（该缺口已登记为 **PROB-045**，见 §4 第 3 条） |
| 2 | 首页 hero / CTA 后台增删排序 → 公开站按后台顺序渲染 | 常驻 e2e `page-copy.spec.ts:315`（`383` 内 `ok 33`） | **机器对**（B-1 的唯一 BLOCKER 已补：删一行+追加一行+倒序、`h1` 逐行与 `.cta-row` 逐行等于后台数组序、`finally` 整份复原并深比） |
| 3 | 一次性导入并发布；导入前后渲染文本逐字无差异 | 导入 `scripts/import-astro-copy.ts` + P-V1（`372`）+ P-V4（`379`）+ P-V9（`380`） | **机器对**，且三层（数据/文本/DOM）互不替代 |
| 4 | 后台改一条已发布文案 → 重建 → e2e 断新串出现、旧串消失 | 常驻 dev 层 `page-copy.spec.ts:188`（`383` 内 `ok 32`）；产物层一次性回环 `238` | **机器对**（dev 层常驻；产物层因 `output: 'static'` 只能一次性，已在 `235`–`238` 结案） |
| 5 | CMS 不可达 ⇒ 非零失败、报错可读、无空白产物、不回退 | P-V6（`374`） | **机器对**，且红侧自证（PROB-028 前 `227`/`228` 只满足两条 ⇒ 该门禁的判定项被补到四条） |
| 6 | 三站四页 SEO 三件套构建后逐页齐全（不另设覆写字段、canonical 构建期派生） | `astro-copy-agents9.mjs`（`371`：Layout 落 `title`+`meta description`+`link canonical`，四页 `meta` 取自 CMS 4/4）+ `schema-and-projection.md` §② 记录 canonical 不入库的取舍 | **源码级机器对；产物级未固化**——`astro-copy-render-text.mjs:57` 提取前删 `<head>`，构建产物里 12 页的 title/description 落地值无门禁（**PROB-039 OPEN**，与 PROB-041 配成 P2 对）。4.2 勾这格时必须按此成色勾，不得读成「产物级已证」 |
| 7 | `content/*.ts` 与 `site.ts` 被接管字段删净、不留代码内兜底 | `astro-copy-agents9.mjs`（`371`：`|| 'juece'` 命中 0、`apps/astro/src/content` 不存在、无残留 import、`site.ts`/`astro.config.mjs` 缺键即抛）+ 实际删除量 −1937 行 | **机器对**。边界照原文：`site.ts` 只去 `SITE_ID` 兜底，站点级品牌/导航/备案号不入库 |
| 8 | `pnpm --filter cms build`、三站 `astro:build`、`pnpm --filter e2e test` 全 exit=0 | `375` / `376` / `377` / `378` / `383` / `384` | **机器对**（本文 §1） |

---

## 3. 双审查 triage 净结论（2A.3）

两份审查均为**独立 reviewer、不采信工件叙述**，各自实跑只读门禁。

| 审查 | BLOCKER | HIGH | WARNING | INFO | 处置轮次 |
|---|---|---|---|---|---|
| `review/spec-review.md` | 1（B-1 验收第 2 条零对面） | 4（H-1 指针持久性 / H-2 验收 1、6 对面只在 tmp / H-3 自检口径 / H-4 `Evidence_Path` 指向不存在文件） | 9 | 3 | P11（2026-09-21）+ 交付轮本文 |
| `review/quality-review.md` | 0 | 3（HIGH-1 project 唯一性只活在钩子 / HIGH-2 导入无条件覆盖抹掉手工改稿 / HIGH-3 dist 新鲜度无判据） | 12 | 9 | P11（2026-09-21） |

- **净结论：无遗留 HIGH blocker。** 两份的 BLOCKER/HIGH 全部修毕且**每条都配红侧（咬合力自测，非零退出码）**：B-1 → `383` 内 `ok 33`；H-1 → `382`；H-2 → `370`/`371` 两只零参数持久门禁；H-3 → `379`/`380`/`381` 的 dist 新鲜度行；HIGH-1 → `project-uniqueness-p11.md`（DB 唯一索引 + 端点 `limit:2` 守卫）；HIGH-2 → 导入分支缺 `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1` 即非零抛；HIGH-3 → 三站 `dist/src` mtime 比对。**H-4 即本文**——按 triage 约定留到交付轮 4.1，不在审查轮造空文件。
- **不接受的条目均给反证**（不静默忽略）：spec W-3、quality I-2/I-3（`{zh,en}` label 与诊断文案不是同一件事；给 `Error` 造双语等于新增第二套文案载体）。逐条依据见两份报告的 triage 表。
- **如实登记为后续问题的**：`PROB-035`…`PROB-040`、`PROB-043`、`PROB-044`（OPEN），交付轮汇总在 `evidence/follow-ups.md`；其中 **PROB-044**（e2e 期望值全部来自被测端点/DOM，端点自身无 git 内锚点）与 **PROB-023**（品牌硬编码 7 处）需 owner 拍板，不替它们默认。另有 **PROB-045**（验收 1 的双语 label 无逐字段门禁，见 §4 第 3 条）不是双审查产物，而是本文 4.1 成文时把「只写在叙述里的缺口」转成可检索 ID（4.2 前补登，日志 `406`）。
- **本轮自己引入并当场修掉的缺陷**（不粉饰）：台账第 263 行 note 里被我自己的 canary 污染 ⇒ `357` 字节级修复（改动行数=1、非 note 字段逐一相等、键顺序不变）；`351`（§7 判据假阳性）与 `356`（该 canary 的红侧）在台账里记为 `status: failure`，即**故意留红**而非改写措辞。

---

## 4. 明确「未验证 / 未执行」清单（本文的诚实面）

1. **线上发布动作未执行、未在真实环境演练**：`evidence/release-prerequisites.md` 的两条迁移与导入命令只在本地容器库跑过其形态；线上无 `prodMigrations` ⇒ 永不自动迁移，且**本次不开维护窗口（owner 已裁决）**。该文件是操作手册，不是已验证事实。
2. **验收第 6 条的产物级**（§2）与 **PROB-037** 同类：门禁谓词偏弱。**四条迁移期守卫**（parity / render-diff / hero-diff / coverage，即 P-V1、P-V4、P-V9 与覆盖度门禁）判的都是「与导入前基线一致」⇒ 交付后第一次合法改稿就会让它们全部变红，已登记 **PROB-041**（P2 配对）。
3. **双语 label** 只有 grep 计数（`en:` 出现 115/94/33/41 次），无逐字段断言（§2 第 1 行）⇒ 4.2 勾选前已登记为 **PROB-045**（`OPEN`/`P3`，最小做法与「别退化成计数相等」的告警写在 `.aiws/issues/problem-issues.jsonl` 该行与 `evidence/follow-ups.md` §3；登记脚本复跑 `no-op` 证幂等，日志 `406`）。
4. **`pageCopyProjection.ts` 零单元测试**（PROB-038）：其正确性目前由 P-V1 的端到端比对间接保证，纯函数层无独立对面。
5. **`aiws verify-bc` 在本文成文时还未跑**（它是 4.3 的前置，结论以该命令自己的退出码为准）。P-V7 的完整面已在最终态复跑转绿（`391` exit=0），§7 有逐条结果。
6. **本 change 的全部改动仍未提交**（工作树状态）⇒ 未推、未 finish、未归档。`gitRev` 类判据在此不可用，dist 新鲜度改用 mtime 判据即因此（HIGH-3）。
7. 一次性/迁移期脚本仍住在 gitignored 的 `.aiws/tmp/`（appender 与 doc-claims 审计等）：它们的**判定日志**已入库可核对，但**脚本本体**换 clone 后不可复跑。

---

## 5. 门禁链的可复现顺序（顺序本身是结论的一部分）

`astro-copy-cms-unreachable.mjs` 会清空 `apps/astro/dist`，因此它**必须早于**三条产物级门禁，否则 P-V4/P-V8/P-V9 比的是空目录；本轮实际顺序：

```
coverage → agents9 → parity            （离线/只读，370 371 372）
→ doc-claims                            （工件口径，373）
→ cms-unreachable                       （374，清空 dist）
→ cms build → astro:build ×3            （375 376 377 378，重建产物）
→ render-diff → hero-diff → client-bundle（379 380 381，只读产物）
→ evidence-archive                       （382）
→ e2e 全量                               （383）
→ node scripts/build.mjs                 （384，根交付构建；此后 dist 由它再次刷新 ⇒ 385–387 重跑三条产物级门禁以覆盖最终产物）
```

一条命令复现（零参数、逐条落盘）：`AI_WORKSPACE.md` 的 `page_copy_gates` 段列出的 8 条即常驻门禁；构建/e2e 另需 `pnpm --filter cms build` / `pnpm astro:build[:erp|:yunque]` / `pnpm --filter e2e test`。

---

## 6. 数据与红线自检（交付轮复核）

- **数据库**：全程只连 `127.0.0.1:5434`（Docker `juece-grow-postgres`）。13306/13307/13308/13309/5432/5433/5435/6379 及任何线上地址未连接；未 TRUNCATE / DROP / 删用户 / 删真实线索。
- **线索主数据**（AGENTS.md §7）：本 change 生产代码 0 处触碰；唯一改动是 `apps/e2e/tests/lead.spec.ts` 的断言随 hero 取数口径调整（`371` 的 §7 断言以此披露）。
- **schema 变更**：两条迁移均为**加表/加索引**（`20260920_121115_page_copy_collections`、`20260920_195201_page_copy_project_unique_index`），无改名/改类型/删列 ⇒ 不触发 AGENTS.md §7 的扩展迁移三段式。
- **凭据**：`.env` 与 `secrets/**` 只追加不改写；未把令牌/口令写入 git 或日志；`apps/e2e/setup/global-setup.ts` 仍从 `.aiws/secrets/test-accounts.json` 读取，未打印值。
- **文件行数 / 双写 / 兜底**（AGENTS.md §4、§5）：`371` 全绿，最大自研文件 595 行；生成物（迁移与 `payload-types.ts`）单列不计限额。
- **API**（AGENTS.md §6）：新端点 `apps/cms/src/app/api/v2/content/pages/route.ts` 走 `ok()/err()` 信封，未手写响应体；唯一接缝（plan 的 Seam 决策）= 该端点，Astro 四页与 e2e 都打这一条缝。

---

## 7. 4.1 的收尾动作与实测结果（按发生顺序）

| # | 动作 | 日志 | 结果 |
|---|---|---|---|
| 1 | 本文落盘 ⇒ 消除 `369` 的 3 条 `verify-before-complete.md` 相关 error | — | 文件在盘且进 `Evidence_Path`（proposal:31、plan:13 的指针由断链变实链） |
| 2 | plan 的 In Scope 补 `.gitignore`（该负向豁免 `!/.aiws/changes/**/evidence/logs/*.log` 是台账跨 clone 可读的前提）消除越界 error | — | 与第 1 项一起在 `391` 复跑中生效 |
| 3 | tasks 3.8 收口链：`aiws change sync` → `aiws validate . --stamp` → `--strict` → `--strict --check-evidence --check-scope` | `388` `389` `390` `391` | 四条退出码行 `change_sync_exit=0` / `aiws_validate_exit=0` / `change_validate_strict_exit=0` / `change_validate_evidence_scope_exit=0`。**PROB-011 的越界清单本轮为 0 条**（`369` 的 4 条 error 全部消除，无需「解释越界」） |
| 4 | 三条产物级门禁在 `384` 之后于最终 dist 复跑 | `385` `386` `387` | 全 `exit=0`（见 §1 引言） |
| 5 | `append-verification-p12.mjs` 补登 `359`–`391` | `392` | `appended=33 declared=33 total=318 mirrored=33 sha256=cdc15bf3ec4b30a9`；复跑 `396` 打印 `no-op：33 条已全部在册，台账仍 318 行` |
| 6 | 归档面复算 | `393` | `台账行数=318 … sha256 与原件一致=318 问题=0`，`archive_exit=0` |
| 7 | **两只账本审计器崩溃（我自己造成的红）**：p12 把 note 公共前缀提成模块级常量 `NOEXIT`，而审计器只对 `ROWS` 字面量注入 `tmp` 一个形参 | `394` `395` | 均 `exit=1` + `ReferenceError: NOEXIT is not defined`。审计器行为正确（宁崩不静默少账）⇒ 修 appender 而非放宽审计器；约束已写进 §0 表格最后一行 |
| 8 | `397-p12-rows-selfcontained-fix.mjs` 就地把 10 处 note 反引号转义、删掉常量，并断言「改源码表达不改台账文字」 | `397` | 首跑按「11 处」写死预期即中止（`fix_exit=1`，如实留在同一份日志里）；改判 10 后 `裸反引号命中=0 / 已转义=10 / 常量残留=0 / ROWS 33 条 / 与台账 note 逐字节不等=0 / artifact 注入正确`，再跑打印「已修」证幂等 |
| 9 | 双向覆盖复算 | `398` `399` | `AUDIT ledger_rows=318 missing_total=0`（19 只 appender）；`ledger=318 covered=308 uncovered=10`（10 仍是 P1 直写的那批） |
| 10 | **B4 抓到工件口径过期（设计如此的红）**：入账后 `tasks.md` 3.10 仍写 285 行 / 18 只 / covered=275 | `400` | `exit=1`，逐条点名 4 处 ⇒ 说明「写死口径 ↔ 盘上实物」这台机器真的在盯 |
| 11 | `401-tasks-310-sync-p12.mjs` 同步 7 处口径（含把 `394`/`395`/`400` 三支红一并登记进 3.10 的失败示例与「本轮自己的尾部日志由下一轮补登」） | `401` | `替换对数=7 残留旧口径=0 缺失新口径=0 3.10 之外改动的行数=0` → `判定=PASS`；复跑 `no-op` 不写盘。附注：该日志的 PASS 行文字当时写死为「6 处」（实际 7 处），已把脚本改为输出 `${PAIRS.length}`，历史行不追改 |
| 12 | 文档口径门禁回绿复跑 | `402` | `tasks 3.10 台账真实=318 行 / appender=19 只`、`问题=0`、`判定=OK`、`docclaims_exit=0` |
| 13 | `aiws change evidence astro-page-copy-cms --no-validate --allow-fail` 收拢证据面（tasks 4.1） | `403` | `updated: proposal.md (Evidence_Path)` + 同名回写 plan；`change_evidence_exit=0`。它不带门禁判定，判定面在第 14/18/22 行 |
| 14 | tasks 2A.1 / 2A.2 / 2A.3 / 3.8 / 4.1 勾选（只翻复选框并指向已实测日志，不动任何数字口径）后复跑文档口径与完整面 | `404` `405` | `判定=OK 问题=0` / `ok: change validated (astro-page-copy-cms)`，两支 `exit=0` ⇒ 勾选本身没引入漂移 |
| 15 | 登记 PROB-045（把「中英双语 label 没有机器对面」从叙述转成可检索 ID）+ 复跑证幂等 | `406` | `appended=PROB-045 行数 前=44 后=45 键序全一致=true 既有字节未被改写=true` → `no-op：PROB-045 已在台账，仍 45 行` |
| 16 | 删掉 change 目录下两个新产生的空目录（`analysis/`、`patches/`） | `407` | 删前后各 `ls` 一次，`rmdir_exit=0`；after 清单六项（`design.md evidence metrics.json proposal.md review tasks.md`） |
| 17 | **4.2 推进首跑（我自己造成的红）**：`408-advance-req-0003-done.mjs` 的 `MARKER` 常量写成「REQ-0003 交付推进（4.2）」而实际追加的是「…（4.2 台账推进）」 | `408` | `req0003_advance_exit=1` 抛在写盘之后的自检。数据面其实是对的（`合同行：改动行=1 其余两行逐字节不变=true 键顺序不变=true Impl_Status TODO→DONE`、`CHANGELOG：纯追加=true 表体行 前=12 后=13 竖线数!=7 的行=0 表内空行=-1`）；同一 bug 还会让幂等守卫失效（再跑追加第二行）⇒ 只能修不能绕。修后 `409` 两支路各打印 `no-op` |
| 18 | 4.2 收尾链：`aiws change sync` → `aiws validate . --stamp` → `--strict` → `--strict --check-evidence --check-scope` → 文档口径 → `aiws verify-bc` | `410`–`415` | 六支 `exit=0`；`Changed files: - REQUIREMENTS.md`（越界 0 条）；`表体行=13 PROB-029+ 17 行（DONE 7 / OPEN 10） 问题=0`；`ok: all gates passed (tier=strict)` |
| 19 | **入账前置**：`416-selfcheck-p13-rows.mjs` 用审计器同一个正则逐字 eval p13 的 `ROWS` | `416` | 首跑切片少一位 ⇒ `SyntaxError`（`selfcheck_p13_exit=1`，同一份日志留档）；改判后 `rows=30 dup_keys=0 工件缺失=0 note_无残留插值=true failure=6`、再跑 `rows=31 failure=7`（第 7 条就是这份日志自己的红） |
| 20 | `append-verification-p13.mjs` 补登 `392`–`416`（31 条，含 6 条如实 failure） | `417` | `appended=31 declared=31 total=349 mirrored=31 sha256=bd41555489bb1e0b`；复跑 `418` `no-op：31 条已全部在册，台账仍 349 行` |
| 21 | 入账后三向复算：正向覆盖 / 反向覆盖 / 归档 | `419` `420` `421` | `AUDIT ledger_rows=349 missing_total=0`（20 只 appender）；`ledger=349 covered=339 uncovered=10`（10 仍是 P1 直写那批）；`台账行数=349 … sha256 与原件一致=349 问题=0` |
| 22 | **B4 又一次抓到 3.10 过期（设计如此的红）**，随后 `423-tasks-sync-p13.mjs` 同步 3.10 + 5.2 共 9 处口径 | `422` `423` `424` | `422` `exit=1` 点名 4 处（`318→349` 三处 + `19→20 只 appender`）；`423` 首跑正则里未转义的 `。**` 令模块解析即炸（`sync_exit=1`，同一日志留档），改后 `替换对数=9 命中=[1×9] 改到的行=76,92 引用日志编号=33（幽灵 0）`、复跑 `no-op`；`424` 回绿 `问题=0` |
| 23 | 手工改完 3.10 后复跑文档口径门禁；第二批尾部镜像（`437`–`446`） | `446` `447` `447b` | `446` `问题=0 判定=OK`（此刻口径仍是 349/20）；`447` `镜像窗口 437–446：tmp 侧=10 归档侧=10 新复制=6 已存在且等值=4 空洞编号=[] 归档侧缺口=0`，复跑 `新复制=0 已存在且等值=10`；镜像工具自己的日志由同一支里 `cp` 封口，两支 sha256 逐字节相同 |
| 24 | **抓到上一轮写进 3.10 的「本轮起不再有 tmp-only 证据丢失风险」是假的**：diff tmp 与归档目录，55 份日志既无台账行也无归档字节。建第三只审计器——从盘上日志出发，把「字节是否已归档」（门禁项）与「台账是否有行」（信息项）拆成两条轴 | `448` | v1 `台账有行且字节已归档=341 台账有行但归档缺字节=0 归档有字节但台账无行=30 台账无行且归档无字节（提交即丢，且不在任何账上）=55 判定=NEEDS-BACKFILL 问题类合计=55 台账行数=349`，`audit_missing_exit=1` |
| 25 | 先收「字节」这一层（可逆性优先于记账）：全量镜像编号低于自身的所有 tmp 日志 | `449` | `镜像窗口 <449：tmp 侧=426 归档侧=426 复制前缺=55 新复制=55 已存在且等值=371 逐文件 sha 与原件一致=true 复制后缺口=0` ⇒ 「提交即永久丢」从 55 降到 0 |
| 26 | 逐号回收命令字面量（**不许臆造 `command`**）：只读脚本把台账既有命令按 18 组正则列出对号；再逐份打印候选日志的退出码行与末行正文 | `450` `452` | `450` `listcmds_exit=0`；`452` 每份一行 `NNN⇥文件名⇥*_exit= 行⇥末行正文`，并点名 `!!同名多份或缺失`（425 改名成 426 那次）与 `!!归档缺字节`（449/450/451——三只新工具的日志，`449` 窗口天然不含自己） |
| 27 | `448` 改判：门禁 = `归档缺字节 + 排除表已入账数`；「有字节无行」降为信息项；35 份**声明式排除**逐份写理由，理由全部指向盘上已有声明（不在此复述政策） | `451` | `编号日志总数=429 台账有行=341 归档有字节=426`、`声明式排除=33 其中已入账（应 0，排除表过期信号）=0`、`归档缺字节（提交即永久丢，门禁项）=3`、`有字节但台账无行（下一轮补登的尾日志）=55`，`audit_v2_exit=1` |
| 28 | 入账前置：`453-selfcheck-p14-rows.mjs` 用审计器同一个正则 eval p14 的 `ROWS`，并新增一条硬检查——**每行的 `exit_code` 必须字面出现在工件的 `_exit=` 行里**（否则台账就成了第二真值） | `453` | 首跑被组内 `>` 截断（`>>` 里再开 `>` 会清掉本支日志），按序重跑后：`rows=57 dup_keys=0 工件缺失=0 note_无残留插值=true failure=4(422 423 448 451) 退出码与日志行不符=0` |
| 29 | `append-verification-p14.mjs` 补登 57 条（19 条历史 `153`–`267` + 38 条覆盖 `417`–`452`；`423` 拆 3 行、`426` 拆 2 行），写盘时对归档做「等值即跳过 / 不等即中止」的镜像感知 | `454` `455` | `appended=57 declared=57 total=406 新镜像=4 已在册等值=53 failure=4 sha256=716624c00dab0079`；复跑 `no-op：57 条已全部在册，台账仍 406 行` |
| 30 | 入账后三向复算：正向覆盖 / 反向覆盖 / 归档 | `456` `457` `458` | `AUDIT ledger_rows=406 missing_total=0`（21 只 appender）；`ledger=406 covered=396 uncovered=10`（10 仍是 P1 直写那批）；`台账行数=406 不同 artifact=397 台账行 sha256 与原件一致=406 问题=0` |
| 31 | **B4 第三次抓到 3.10 过期（设计如此的红）** → `460-tasks-sync-p14.mjs` 同步 8 处口径。复跑先抛 `模式命中 0 次`（缺 no-op 判定）；补 `alreadySynced` 后幽灵检查仍是装饰性空数组 ⇒ 换成真的 `ghostOf()` 过 tmp+归档，两处都当场修，首跑的红留在 `461` | `459` `460` `461` `462` | `459` `问题=4`（`349→406` 三处 + `20→21 只 appender`）`docclaims_exit=1`；`460` `替换对数=8 残留旧口径=0 缺失新口径=0 3.10 之外改动的行数=0 幽灵引用=0 判定=PASS`；`461` 首跑堆栈 `Error: 模式命中 0 次（要求恰好 1 次）：\*\*实测状态（P13 收口…`，修后 `no-op：8 处口径已全部同步（八段新文本逐字在行内、3.10 之外改动 0 行、幽灵引用 0），本次不写盘`；`462` `问题=0 判定=OK 台账真实=406 行 / appender=21 只` |
| 32 | 第三批尾部镜像（`449`–`462`）+ **修审计器自己的漏**：`448`/`449` 的选择正则 `^\d+-` 静默漏掉带字母后缀的编号日志（`236b`/`447b`/`463b`）——正是这类工具本该拦住的那种「不在任何账上」 | `463` `463b` `464` `465` | `463` `镜像窗口 449–462：tmp 侧=14 归档侧=14 新复制=10 已存在且等值=4 空洞编号=[] 归档侧缺口=0`，复跑 `新复制=0 已存在且等值=14`；`464`（正则修前）`归档缺字节=1 → 464-audit-logs-missing-v3.log`；`465`（修后 + `cp` 封口）`编号日志总数=446 台账有行=396 归档有字节=445 声明式排除=35 其中已入账=0 归档缺字节=1 有字节但台账无行=15 audit_v3_exit=1` |
| 33 | 本文 §7 与 `tasks.md` 3.10、`follow-ups.md` §4 改准后的复跑链：文档口径门禁 → aiws 四步链 → 第四批尾部镜像（`466`–`471`）→ 终局可复现性审计。**最后一支刻意不落 tmp 日志**（不落自己的日志，缺口这一维才可能真的归零，退出码由 `${PIPESTATUS[0]}` 取命令本身而非 `grep`） | `466` `467`–`471` `473` `474` | `466` `问题=0 判定=OK`；`467`–`471` 五支 `exit=0`（`sync` / `validate . --stamp` / `--strict` / `--strict --check-evidence --check-scope` 均 `ok: change validated`、`aiws verify-bc` `ok: all gates passed (tier=strict)`）；`472-mirror-tail-4.mjs` 的两次运行正文落在 `473` 这一份日志里（该脚本没有自己的 `.log`：同一分组里对它的 `cp` 如实失败 `cp_self_exit=1`，文件从未被创建）：`镜像窗口 466–471：新复制=6 已存在且等值=0` → 复跑 `新复制=0 已存在且等值=6`；`474` 里对 `465` 与 `473` 各 `cp` 封口并逐件 sha256 等值（`a521847567b76a0f` / `97ad12cad9374290`）；`474` 实测 `归档缺字节=1（就是 474 自己）`，末次无日志运行 `编号日志总数=454 台账有行=396 归档有字节=454 声明式排除=35 其中已入账=0 归档缺字节=0 有字节但台账无行=23 判定=OK audit_stdout_exit=0` |
| 34 | 再一轮文档改准（把行 32/33 的实测写回 3.10 与 §4）→ 门禁复跑；同时把「每轮抄一份写死窗口的镜像脚本」这件事收掉：`481-mirror-tail-window.mjs <LO> <HI>` 是参数化版，取代 `436`/`447`/`463`/`472` 的四份副本，并把它的缺口判据从「两侧计数相减」改成「复制后再量一次 tmp 有而归档无」（减法会被归档里的历史件干扰）。正则修宽后 `449` 必须复跑，否则「426」这个口径就和脚本对不上了 | `475` `476`–`480` `481` `482` | `475` `问题=0 判定=OK`；`476`–`480` 五支 `exit=0`（同上，`verify_bc_exit=0` = `ok: all gates passed (tier=strict)`）；`482`（`449` 修正则后复跑）`镜像窗口 <449：tmp 侧=428 归档侧=428 复制前缺=0 新复制=0 已存在且等值=428 复制后缺口=0` ⇒ 426→428 的差就是 `236b`/`447b` 两份，它们本就在归档；`481` 首跑 `镜像窗口 475–480：新复制=6 已存在且等值=0 复制后仍缺=0`、复跑 `新复制=0 已存在且等值=6`；`481`/`482` 两份自身日志 `cp` 封口（sha256 前缀 `f7ff5e6397013dc8` / `308fc12f6d3c68d1`）；终局无日志审计 `编号日志总数=462 台账有行=396 归档有字节=462 归档缺字节=0 有字节但台账无行=31 判定=OK final_audit_exit=0` |
| 35 | **4.3 本地段收口**：提交前门禁复跑 ⇒ 暂存口径（memory-bank 整目录 pathspec 排除）⇒ `aiws commit` ⇒ 提交后反向核对「HEAD 里没有 memory-bank」。镜像 `490` 那一次刻意不带日志运行（带日志的运行永远看不到自己的字节） | `490` `490` 镜像 | `490` `✓ aiws validate` `validate_exit=0` → `ok: all gates passed (tier=strict)` `verify_bc_exit=0`；暂存 `589` 条路径中 `git diff --cached --name-only \| grep -c memory-bank` = **0**，`git status --porcelain` 仍 **3** 条 memory-bank 路径未暂存；`aiws commit` ⇒ `0872bd0` `589 files changed, 39811 insertions(+), 2001 deletions(-)`，`git show --name-only --format="%h %s" HEAD` 内 memory-bank 命中 **0**（591 行 = 1 标题 + 1 空行 + 589 文件）；`481-mirror-tail-window.mjs 490 490` `tmp 侧=1 新复制=1 复制后仍缺=0` |
| 36 | **4.4 记忆写入**：交付轮决策单独成条（不复述规划轮正文），建 `delivery → plan` 关联，并用 `aiws memory read` 逐字读回验证「写入即进索引」。**自己造成的口径错当场修**：首版正文把日志份数写成死数 `469`，而该数来自一次**没落日志**的临时统计 ⇒ 既无工件对面又必然随镜像过期，`499` 整篇重写为「份数随轮增长、终局判据是 `归档缺字节=0`」并补一条坑「带自己日志的运行看不到自己的字节」 | `491` `492` `499` | `491` `✓ Memory written: decision://astro-page-copy-cms/delivery` `memory_write_exit=0`；`492` `Link added: decision://astro-page-copy-cms/delivery -> decision://astro-page-copy-cms/plan` `link_exit=0` + `read_exit=0`（全文逐字在盘），`.index.yaml` 自动追加 2 条 decision、`.links.yaml` 1 条边；`499` `memory_write_exit=0`，重写后读盘 `delivery.md` 仍 15 行（**整篇替换、非追加**）、`grep -c 469` = 0 |
| 37 | **P15 台账补账（4.3 推送/finish 的硬前置）**：`aiws change archive` 会把 change 目录整体搬走，而 tmp 里的 appender 与镜像脚本把 `evidence/…` 路径写死 ⇒ 搬运后这些工具不可重跑，所以**行必须先补完再推**。链条：逐字预检 → 入账 → 幂等复跑 → 三向复算（正向 / 反向 / 归档字节）→ 从磁盘反查日志 → 3.10 九处口径脚本化同步 → doc-claims。同一轮把交付轮记忆**第三次**重写（去掉「406 行 / appender 21 只」死数、补全三个本地提交与 owner 2026-09-22 的推送点头） | `507` `508` `509` `510` `511` `512` `513` `514` `515` `516` `517` `518` `519` | `507` `rows=54 dup_keys=0 工件缺失=0 note_无残留插值=true failure=1(464-audit-logs-missing-v3.log) 退出码与日志行不符=0`（首版预检只认 `_exit=` 键，漏取 `482` 的 `mirror_all_reexit=0` ⇒ 放宽成「以 `exit=` 结尾的键名」，判据本身不变）；`508` `appended=54 declared=54 total=460 新镜像=1 已在册等值=53 failure=1 sha256=3f14b17be3b69bfc`；`509` 复跑 `no-op：54 条已全部在册，台账仍 460 行`；`510` `AUDIT ledger_rows=460 missing_total=0`（22 只 appender 各自 `declared=… missing=0`）；`511` `ledger=460 covered=450 uncovered=10`（10 仍是 P1 直写那批，§0 已登记）；`512` `台账行数=460 无 artifact 行=0 不同 artifact=451 sha256 与原件一致=460 问题=0`；`513` `编号日志总数=493 台账有行=450 归档有字节=486 声明式排除=36 其中已入账=0 归档缺字节=7 有字节但台账无行=7 判定=NEEDS-BACKFILL audit448_exit=1`——**那 7 份正是 `507`–`513` 自己**（结构，非缺陷）。两次同因红如实留档：`514` 与 `516` 都抛 `旧口径残留：21 只 appender`，前者命中 4.4 里抄旧记忆的死数、后者命中**我新加的那句自己又抄了一遍** ⇒ 改写字序并加写记忆（`515` `memory_write_exit=0`）后 `517` `替换对数=9 残留旧口径=0 缺失新口径=0 3.10 之外改动的行数=0 幽灵引用=0 判定=PASS`、`518` `no-op：9 处口径已全部同步`；`519` doc-claims `问题=0 判定=OK 台账真实=460 行 / appender=22 只` |
| 38 | **P15 收口链**：文档改准 → aiws 五步门禁 → 尾部镜像 → 终局磁盘反查。**镜像与终局审计两支都刻意不带 tmp 日志**（带日志的运行永远看不到自己的字节，见 `follow-ups.md` §4 坑⑤） | `519` `520` `521` `522` `523` `524` ＋ 无日志的 `481` / `448` | `519` doc-claims `问题=0 判定=OK 台账真实=460 行 / appender=22 只`；`520` `No changes detected vs baseline.` `sync_exit=0` → `521` `✓ aiws validate` `validate_stamp_exit=0` → `522` `ok: change validated (astro-page-copy-cms)` `strict_exit=0` → `523` 同 `ok` 且 `--check-evidence --check-scope` `evidence_scope_exit=0`（PROB-011 那条越界清单仍为 0 条）→ `524` `ok: all gates passed (tier=strict)` `verify_bc_exit=0`；`481-mirror-tail-window.mjs 507 524`（stdout-only）`镜像窗口 507–524：tmp 侧=18 归档侧=18 新复制=18 已存在且等值=0 空洞编号=[] 复制后仍缺=0` `mirror_stdout_exit=0`；`448`（stdout-only）`编号日志总数=504 台账有行=450 归档有字节=504 / 声明式排除=36 其中已入账=0 / 归档缺字节（门禁项）=0 / 有字节但台账无行（下一轮补登的尾日志）=18 / 判定=OK 问题类合计=0` `final_audit_exit=0`。**门禁链必须跑在文档改准之后**（否则那一行的口径没有对面证据），而本轮每一串链跑完都又被下一次文档改动追平 ⇒ **终局判据不是「某几个行号之后」，而是已提交树里最后一条 `verify-bc` 日志同时含 `ok: all gates passed (tier=strict)` 与 `verify_bc_exit=0`**。下面这支是该规则的一次实例：`525` `No changes detected vs baseline.` `change_sync_exit=0` → `526` `✓ aiws validate` `validate_exit=0` → `527` `ok: change validated (astro-page-copy-cms)` `strict_exit=0` → `528` 同 `ok`（`--check-evidence --check-scope`）`evidence_scope_exit=0` → `529` `ok: all gates passed (tier=strict)` `verify_bc_exit=0` → `530` doc-claims `[doc-claims] 判定=OK：工件口径与盘上实物一致` `doc_claims_exit=0`；`481 507 530` 与 `448` 再次不带日志复跑，两条判据字面复现（`复制后仍缺=0`、`归档缺字节（门禁项）=0` ＋ `判定=OK 问题类合计=0`），其逐位读数按本行末立的规则**不在此复述**。⇒ **本轮没有任何一份日志会随 tmp 消失**；「有字节但台账无行」那一维点名的全是本轮自己的尾部（`507` 起，末位即最后一次带日志运行的编号），份数由 `448` 从磁盘反查而非此处抄写；本 change 随后即归档关闭，这批行的终局处置（不再补登、字节已在库）写在文末「收尾状态」第 3 条。行 37/38 里凡写成数值的读数都是**那一次运行的当时读数**，后续每多一支带日志的运行都会让它偏小，判据本身（`归档缺字节=0 判定=OK`）不变 |

**收尾状态（2026-09-22 本 change 关闭，逐条点名做了什么、按什么判据可复核）**：

- **4.3 已执行完毕**：① 提交前门禁链跑在最后一次文档改动之后，五步全绿（`531`–`536`，判据是 `535` 同含 `ok: all gates passed (tier=strict)` 与 `verify_bc_exit=0`）；② 本地新增两个提交——`752d626`（P15 台账与收口链，37 条路径、暂存面 memory-bank 命中 **0**）、`f1ed394`（memory-bank 单独一次，2 文件），都走 `aiws commit`、未 `--amend`；③ 推送前置的 **L3 深度安全审查对已提交改动跑完 0 条发现**；④ `aiws change finish --into main --push --remote gitee` 实测 `finish_exit=2`，但它的顺序是「合并 main + bookkeeping 提交 `e7446f2` + push gitee」在前、「归档要求 tasks 全勾」在后，而唯一未勾的行恰是 4.3 本身 ⇒ **带 `--push` 的 finish 结构性无法自行收尾**（自锁）。不 `--force` 跳门，改走记忆 `aiws-binding-and-tooling-gaps` 第 13 条登记的本地路径；⑤ `aiws change archive astro-page-copy-cms` → `✓ aiws change archive` `archived_to: .aiws\changes\archive\2026-09-22-astro-page-copy-cms` `handoff: …/handoff.md` `archive_exit=0`，搬运面经核对为**纯移动**（旧路径删除 571 条、新路径整目录未跟踪，无第三类改动）。
- **4.4 已完成**：规划轮 `decision://astro-page-copy-cms/plan` + 交付轮 `decision://astro-page-copy-cms/delivery`（含 `delivery → plan` 关联与逐字读回），见 §7 行 36；交付轮记忆在 P15 因「死数口径第二次过期」被第三次重写，见 §7 行 37 与 `tasks.md` 4.4。memory-bank 按 owner 裁决单独一次 `chore(memory)` 提交（`3242886`，本轮再补 `f1ed394`），不混进代码提交。
- **尾部日志的「行」随本 change 关闭而不再补登**（如实声明，不粉饰为已覆盖）：`507` 起这批的**字节**已随 `752d626` 进入 `evidence/logs/`（磁盘反查报 `归档缺字节（门禁项）=0 判定=OK`），未入账的只是台账**行**；台账覆盖的向来是「可复现的验收判定」这一向，不是「执行过的每条命令」。原计划的 p16 补登不再存在，因为 change 目录已搬运，而 `append-verification-pN.mjs` / `481` / `448` 把 `.aiws/changes/astro-page-copy-cms/…` 路径写死 ⇒ **搬运后这些工具不可重跑**（这正是 P15 把补账排在推送与归档之前的原因）。日后若要续登，需先把三只审计器与 appender 的路径改指归档目录。
- **推送的终局判据**：`git ls-remote --heads gitee main` 与 `… origin main` 都等于本地 `main`。`gitee/main` 已由 finish 推到 `e7446f2`；归档提交及其后的 origin 同步（`origin`=GitHub，历史上偶发 443 超时 ⇒ 超时先重试再判失败）由本轮末尾的推送完成，其 hash 不写进本文（提交正文里写不了自己的 hash），以 `git log --oneline -3` 与两条 `ls-remote` 为准。

尾部台账记账的真实状态（P15 之后，与 §0 第 2、3 行一致）：

- **字节层已经没有风险**，且不依赖手工习惯：`449`（全量镜像，正则修宽后复跑 `tmp 侧=428 归档侧=428 新复制=0`）+ 参数化尾部镜像 `481-mirror-tail-window.mjs <LO> <HI>`（每轮续窗口，上界小于自身编号）+ 同一批里 `cp` 封口它自己的日志。终局证据是每轮末次那支**刻意不落 tmp 日志**的审计运行，判据固定为 `归档缺字节=0 判定=OK`（数值不写死：P14 收口时读到的 `编号日志总数=462 台账有行=396 归档有字节=462` 已随本轮入账过期，本轮终局读数记在 §7 行 38）⇒ 4.3 提交后没有任何一份日志会随 tmp 消失。此前每一支带自己日志的运行都必然报 `归档缺字节=N`（缺的就是它自己那批还没写完的日志），那是结构而非缺陷。
- **还欠台账行的只有本轮尾部**：待补清单的**唯一真值是那只从磁盘反查的审计器逐份点名的输出**（`node .aiws/tmp/astro-page-copy-cms/448-audit-logs-missing-from-ledger.mjs`，它把「有字节但台账无行」的每一份列在 stdout 里），本文不复述清单——任何写死在文档里的份数都会随下一轮运行过期。P15 已把 `447b` + `453`–`506`（除 `457` 进排除表、`472` 无自己的日志）54 份全部入账；本轮新增的是 `507` 起这批：`507` 入账前置自检（首版漏取 `mirror_all_reexit=` 键名后放宽）、`508`/`509` 入账与幂等复跑、`510`–`512` 三向复算、`513` 磁盘反查、`514`/`516`/`517`/`518` 口径同步（含两次同因红）、`515` 交付轮记忆第三次重写、`519` doc-claims，其后还有 aiws 链与末次镜像。
- **红的分类（写进台账时不许含糊）**：自己造成的红本轮两条——`514` 与 `516`，同因：口径同步脚本的全文件旧口径扫描先后被 4.4 抄旧记忆的死数、和我新加的那句自己又抄了一遍命中（两条都按 `expected=0` 记 `failure`）。`507` 首版预检漏键名属于**改前红**，但它当场没落退出码行，按下面的坑只能登记放宽后的成功那次。结构红/设计红按 `expected_exit_code=1` 记：`464`/`465`/`473`/`474`（唯一缺字节的那份就是审计器自己还没写完的日志）、`459`（B4 点名 3.10 过期）、`513`（本轮报的 7 份缺字节全是 `507`–`513` 自己）。`472` 那支脚本至今没有自己的 `.log`，正文在 `473` 里。
- **一个已知坑，别到补登时才发现**（P15 已实际踩到两次，`453`/`461`）：抛错的那次运行常常只有堆栈、没有 `_exit=1` 行，而 p14 起的自检要求「`exit_code` 必须字面出现在工件的 `*_exit=` 行里」。⇒ 这类红**不凭记忆补一个 1**：台账按成功复跑那一次入账，修前的红在 `note` 里点名留档（见 `461`/`453` 两行的 note），或写进 `448` 的排除表并给理由。教训：把红留在盘上时，要连同它的退出码一起留。
