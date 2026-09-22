# P11 证据：REQ-0003 验收第 2 条（首页 hero / CTA 增删换序 → 公开站按后台顺序渲染）的常驻机器对面

> Change: `astro-page-copy-cms` ｜ 来源：独立规范审查唯一 BLOCKER（B-1，验收对面缺失）
> 时间：2026-09-21（本地 CMS dev `127.0.0.1:3000` + 公开站 dev `127.0.0.1:4321`，库为本地容器 Postgres）
> 临时脚本与日志：`.aiws/tmp/astro-page-copy-cms/283…296`
> **范围声明：本轮只改 `apps/e2e/tests/page-copy.spec.ts` 一个文件（390 行，≤1000）。数据库动作只有一条：经 CMS REST `PATCH /api/page-home/1` 写 `juece`（项目 id 6）的那一条 page-home 记录，并在同一条用例的 `finally` 里整份复原；未直连数据库、未 TRUNCATE/DROP、未删记录、未碰其它集合与其它站的记录、未碰 13306/13307/13308/13309/5432/5433/5435 与任何线上地址。两个 dev 服务未被杀。凭据只由既有 global-setup 从 `.aiws/secrets/test-accounts.json` 读取，未打印值、未改写该文件。**

## 0. 补的是哪一条真值、为什么此前没有对面

| 项 | 事实 |
|---|---|
| 真值 | `REQUIREMENTS.md:50`（REQ-0003 验收第 2 条，逐字）：「首页 hero 与 CTA 可在后台增删条目并调整顺序，公开站按后台顺序渲染」 |
| 结构条件（早已成立） | `apps/cms/src/collections/pages/PageHome.ts:49-71` `hero.titleLines`（`required` 在 `:52`、`minRows: 1` 在 `:53`、**无 `maxRows`**）；`:396-430` `cta.rows`（`minRows: 1` 在 `:400`、**无 `maxRows`**）⇒ 后台放开增删与拖拽 |
| 渲染条件（早已成立） | `apps/astro/src/pages/index.astro:83` `c.hero.titleLines.map(...)` → `h1.hero-title > span.line`（`emphasis` 为真时内部包 `<em>`）；`:312` `c.cta.rows.map(...)` → `.cta-rows > .cta-row`（标题在内部 `<h3>{row.head}</h3>`）。`sortOrder` / `sort_order` 在 `apps/**` 与迁移里 **0 命中**（仅规划文档提及）⇒ 顺序 = 数组序 |
| 缺口（本轮修掉） | 机器对面缺失：`page-copy.spec.ts` 原 6 组 9 条用例无一碰 `page-home` 的 `hero.*` / `cta.rows`；第 6 组那条（现 `:189`，本轮前为 `:185`）改的是 **pricing** 的 `hero.description` 单字符串，改不出「增删 / 换序」语义 |
| 为什么 `astro-copy-hero-diff` 不算对面 | `scripts/astro-copy-hero-diff.mjs` 判的是「hero `<h1>` 内部 DOM 与**导入前**基线逐字节一致」，是迁移期守卫：合法改稿必然让它变红 ⇒ 它结构上看不见「改了顺序之后渲染跟不跟着变」，不能承担这条验收 |

## 1. 新增用例（逐字标题，供登记为验收对面）

- describe（`apps/e2e/tests/page-copy.spec.ts:220`）：`首页 hero 与 CTA 增删换序`
- **用例标题（`:316`，逐字）**：
  `juece 首页 hero 删一行+追加一行+倒序、cta 倒序+追加一行 → h1 逐行与 .cta-row 逐行都是后台数组序、删掉的行消失；finally 整份复原`
- Playwright 用例 ID（日志原样）：
  `tests/page-copy.spec.ts:316:3 › 首页 hero 与 CTA 增删换序 › <上面的标题>`
- 文件头注释同步补记：`:23-26` 新增第 5 类断言的说明并写明「这条不能由 `astro-copy-hero-diff` 代劳」的理由；`:27` 由「两处写（第 5、6 组）」改为「三处写（第 5、6、7 组）」。
- helper 复用：`adminSession` / `listDocs` / `updateDoc` / `readCopy` / `group` / `str` / 常量 `WEB_SITE`、`WEB_ORIGIN` 全部沿用既有实现，未新造第二套 HTTP 封装；`<em>` 的断言口径照抄第 2 组的 `:108-112`（数量 + 逐个 `nth(i)` 文本）。新增的 5 个局部函数（`titleLinesOf` `:224`、`ctaRowsOf` `:239`、`dropRowIds` `:257`、`patchHeroAndCta` `:272`、`expectRenderedOrder` `:295`）都在 describe 内，不外溢。

## 2. 本轮实际使用的数据（只读探针 `283-probe-page-home-doc.mjs` + 匿名端点实测）

page-home 记录：`doc.id = 1`，`project.id = 6`（slug `juece-grow`，`where` 精确命中恰 1 条），`status = published`。
探针同时确认写入体形状：数组行在原生 REST 里带框架主键（`hero.titleLines[].id = "6ab03a44…"` 这类），`cta.rows[]` 的未填可选键是 `href: null` / `external: null` ⇒ 用例 `dropRowIds` 只剥数组行 `id`、其余字段（含 `null`）原样随行。

| 组 | 改前（基线，实测值） | 写入后（增 + 删 + 换序） |
|---|---|---|
| `hero.titleLines` | `[0] "开店有人帮，" (emphasis=false)`<br>`[1] "接单有人管，AI 有人配" (emphasis=true)` | `[0] "接单有人管，AI 有人配" (emphasis=true)`<br>`[1] "E2E 增删换序 <Date.now()>" (emphasis=false)`<br>⇒ 倒序 + 删掉基线首行「开店有人帮，」+ 追加标记行；剩 2 行 ≥ `minRows: 1`；强调行从第 2 位走到第 1 位 |
| `cta.rows`（只看 `head`） | `[0] 我是实体商家(saas, lead)`<br>`[1] 我是广告公司(erp, href)`<br>`[2] 我是技术团队(yunque, href)` | `[0] 我是技术团队` `[1] 我是广告公司` `[2] 我是实体商家` `[3] "E2E 增删换序 <Date.now()>"`<br>⇒ 整份倒序 + 追加 1 行 `{icon:'saas', head:标记, desc, act:'看新增入口', action:'lead'}`（4 个必填键按 `PageHome.ts:409-429` 声明填全，`icon` 取合法枚举 `saas`，`action` 取 `lead` ⇒ 渲染为 `<button>`，无需 `href`） |

## 3. 断言清单（19 条，按执行顺序；行号为本轮最终文件实测）

前置与定位
1. `adminCredentials()` 缺失 ⇒ describe 级 `test.skip`（`:221`，与第 5、6 组同口径）
2. `projects` `where slug equals 'juece-grow'` 恰 1 条，否则抛（`:321-322`）
3. `page-home` `where project equals <该 id>` 恰 1 条，否则抛（`:323-324`）——不按 `limit` 取第一条瞎改
4. 该记录 `status === 'published'`，否则抛（`:326-328`）
5. 基线 `hero.titleLines ≥ 2` 行，否则抛（`:336-338`）——不足 2 行时「换序 + 删一行」无可断言，宁可不跑也不放水
6. 改前留存整份 `data.copy` 快照字符串（`readCopy(WEB_SITE,'home')`，`:340`）

写入与落库
7. 一次 `PATCH /api/page-home/{id}`，body 同时携带整份 `hero` 与整份 `cta`（调用点 `:360-366`，发出点 `:280`）——整份替换、不做局部合并（与第 6 组 `patchHero` `:181` 同语义）
8. 响应 200，且响应 `doc.hero.titleLines` 的 `{text, emphasis}` **逐行序列** `toEqual` 写入数组（`:284`，长度含在内）
9. 响应 `doc.cta.rows[].head` 逐行序列 `toEqual` 写入数组（`:286-288`）

端点侧（Astro 构建读的同一接缝）
10. `GET /api/v2/content/pages?site=juece&page=home` 的 `copy.hero.titleLines` 逐行等于后台数组序（`:370`）
11. 同端点 `copy.cta.rows[].head` 序列等于后台数组序（`:371-374`）

渲染侧（新增顺序，`page.goto(WEB_ORIGIN + '/')` `:376`）
12. `h1.hero-title` 可见（`:297`）
13. `h1.hero-title > span.line` 数量 === 后台 `titleLines` 行数（`:299`）
14. 逐个 `nth(i)` 文本 === 后台数组第 i 项的 `text`（`:301`）——**逐位比对**：只比拼接串会把「两行互换」判成通过（拼接结果不变），故不用 `joinedTitle` 那类口径
15. `h1.hero-title em` 数量 === 新顺序里 `emphasis === true` 的行数，且逐个 `nth(i)` 文本 === 对应行文本（`:305-308`）——基线强调行换到新位置后 `<em>` 必须跟着走
16. `.cta-rows .cta-row h3` 数量 === `cta.rows` 行数（4），逐个 `nth(i)` 文本 === 各行 `head`，末位即新增标记串（`:310-313`）
17. 被删掉的基线首行文本既不在 `h1.hero-title` 内（`:378`）、也不在 `body` 内（`:379`）——「删」也通到渲染。非永真：改前的渲染产物里该串在 `<body>` 内恰 1 次（就是那个 `span.line`），另有 4 次落在 `<head>` 的 `<title>` / `og:title` / JSON-LD（`meta.title` 内嵌了整句 hero 标题），所以断言特意限定在 `body` 范围内。

收尾（`finally`，无条件；断言已失败也照跑）
18. 再一次 PATCH 把 `hero` / `cta` 整份写回改前形态，并按基线数组序复断响应逐行（`:382`）；端点整份 `data.copy` 的 JSON 与改前快照 **逐字相等**（`:383`）
19. `page.goto('/')`（`:384`）后按基线顺序逐位复断 `span.line` / `<em>` / `.cta-row h3`（`:385`），且新增标记串既不在 `h1.hero-title` 也不在 `.cta-rows`（`:386-387`）

## 4. 实跑验证（命令 → 退出码 → 关键输出；日志逐条落 `.aiws/tmp/astro-page-copy-cms/`）

| # | 命令 | 日志 | 退出码 | 关键输出（原样） |
|---|---|---|---|---|
| 1 | `pnpm --filter e2e exec playwright test tests/page-copy.spec.ts` | `292-e2e-page-copy-final-run1.log` | `e2e_exit=0` | `Running 10 tests using 1 worker` / `ok 10 [chromium] › tests\page-copy.spec.ts:316:3 › 首页 hero 与 CTA 增删换序 › …(2.9s)` / **`10 passed (13.4s)`**（passed=10，failed=0，**skipped=0**：凭据在位，第 5/6/7 组的 skip 未触发） |
| 2 | 同一条命令**再跑一次**（自我复原、可重复执行的证明，非冗余） | `293-e2e-page-copy-final-run2-repeat.log` | `e2e_exit=0` | `Running 10 tests using 1 worker` / `10 passed (11.1s)`，新用例 2.4s |
| 3 | `node scripts/astro-copy-parity.mjs`（独立于 e2e 的残留检查） | `294-parity-final.log` | `parity_exit=0` | `合计比对 12 个 (site,page)，端点侧叶子字符串 1374` / **`12/12 (site,page) 逐字一致`**（含 `juece/home`：差异 0） |
| 4a | `node scripts/astro-copy-render-diff.mjs` | `295-render-diff-final.log` | `render_diff_exit=0` | `基线 12 份齐全；…差异 0 条` / `12/12 三站四页可见文本逐字一致（差异清单为空）` |
| 4b | `node scripts/astro-copy-hero-diff.mjs` | `296-hero-diff-final.log` | `hero_diff_exit=0` | `12/12 三站四页 hero <h1> 内部 DOM 与切换前基线逐字节一致（基线 12 条）` |

补充记录（同一份最终代码之外的额外证据，非任务要求的 4 条）：
- **红侧证明断言有牙**（`289-e2e-page-copy-redside.log`，`e2e_exit=1`）：把 `expectRenderedOrder(page, linesAfter, …)` 的期望临时改成倒序后单跑该用例（`-g "首页 hero 与 CTA 增删换序"`），得到 `Error: h1 第 0 个 span.line 不是后台 titleLines 的第 0 项` / `Expected: "E2E 增删换序 1789935219308"` / `Received: "接单有人管，AI 有人配"` → **1 failed**。即逐位断言确实会因顺序不符而变红，不是永真式。改回后 `290`（`10 passed`，exit 0）与 `291`（parity `12/12`，exit 0）确认复原，且失败的那一次也没留脏数据（`finally` 生效）。
- 同一命令在最终代码前另有 `284`（`10 passed (15.0s)`，新用例 4.9s）、`285`（`10 passed (8.7s)`）与门禁 `286`/`287`/`288`（各自 exit=0）；`283` 为只读探针（无写入）。最终代码 = `292`/`293`/`294`/`295`/`296` 这五条日志对应的状态。
- 用例耗时实测：新用例首跑 4.9s、复跑 2.3–2.9s；整套 8.7–15.0s，均在 `playwright.config.ts` 的 30s 用例级预算内（`/` 已由 global-setup 预热）。
- 4a/4b 读的是 `apps/astro/dist*` 构建产物、**不读数据库** ⇒ 它们的绿本身不证明数据已复原；复原由第 3 条 parity 与用例内 `finally` 的快照逐字复断承担。两者本轮均未变红，故既无残留也无产物过期问题（未重建任何产物，未为了让它们绿而改数据）。

## 5. 未验证项与原因

1. `node scripts/astro-copy-cms-unreachable.mjs` 未跑——主 session 明令禁止（它会清空 `apps/astro/dist`，连带打掉 4a/4b 的可比性）。
2. `pnpm --filter cms build` / 三站 `astro:build` / `node scripts/build.mjs` / `aiws validate .` 未跑——明令禁止（与运行中的 dev 抢 `.next`），构建与校验类门禁由主 session 收尾统一跑。本轮未新增源文件、未改 `apps/cms` / `apps/astro` 代码 ⇒ 构建面未变。
3. 后台 Admin UI 的「拖拽改序」交互本身未被自动化覆盖：用例经原生 REST `PATCH /api/page-home/{id}`（后台保存走同一处理器与同一 `hero` / `cta` 字段），证的是「后台数组序 = 公开站渲染序」这条契约；「能否增删」由 `PageHome.ts` 的 `minRows: 1` 且无 `maxRows` 保证（结构条件，见 §0），未为其再开 UI 级用例。
4. 两次写入会让 `hero.titleLines` / `cta.rows` / `hero.stats` / `hero.diagram.nodes` 的**数组行主键 id 被库重新分配**（用例故意不带旧 id 回去，避免把「换序」写成「按 id 定位更新」）。文案内容与顺序已逐字复原（parity + 快照复断），端点侧 `id` 由 `pageCopyProjection` 的 `FRAMEWORK_KEYS` 剥除 ⇒ 不影响 parity / hero-diff。行主键不是验收对象，故未额外断言其值。
5. 分站（`erp` / `yunque`）首页未做同样的增删换序操作：这条验收只需一处机器对面；分站文案由 parity 12/12 与第 1、2 组覆盖。
6. 未新增/未修改任何门禁脚本，也未把新用例固化进 `scripts/`（属 P11-c 的范畴）。

## 6. AGENTS.md §9 自检

- 命名：全 camelCase（`titleLinesOf` / `ctaRowsOf` / `dropRowIds` / `patchHeroAndCta` / `expectRenderedOrder`；字段 `titleLines` / `emphasis` / `head`），无 snake_case 泄漏到业务层。
- 依赖：未引入新依赖（只用既有 `@playwright/test` 与仓内 helper）；未引入外部 CMS / SaaS。
- API：读侧仍走 `/api/v2/content/pages` 统一信封（`readCopy`），写侧沿用原生 REST `PATCH`（与第 6 组同口径，未新增对外契约、未改响应形态）。
- SEO 字段：未触碰（`meta.title` / `meta.description` 未改写；parity 覆盖）。
- 线索数据：未触碰。
- 文件行数：390 行 ≤1000；无兜底 / 双写 / 兼容写法——`dropRowIds` 是唯一一条写入体构造路径，未保留「带旧 id 回写」的第二路径；`expectRenderedOrder` 在改前 / 改后两处共用，未复制断言。
- 影响范围：仅 1 个 e2e 测试文件 + 本证据文件；数据库影响 = 1 条 page-home 记录的 `hero` / `cta` 两组，且已复原并复断。
- 用例内无真实凭据、无内网端点字面量（origin 全部来自 `helpers/origins.ts`）、无绝对盘路径（grep 复核：仅 `test.skip` 理由里的 `.aiws/secrets/test-accounts.json` 路径名，与第 5、6 组同串）。
