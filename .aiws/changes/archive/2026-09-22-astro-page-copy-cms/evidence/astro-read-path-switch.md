# P5 证据：Astro 切读路径 + 去 `SITE_ID` 兜底 + PROB-024（tasks 2.14 / 2.15 / 2.16）

归因：`Req_ID=REQ-0003`、`Problem_ID=PROB-024`（2.16 修后转 DONE）/ `PROB-025`（开工门槛，P2 已登）。
本轮把公开站的页面文案读路径从「读代码里的数据文件」切成「构建期打 CMS 端点」，并把那四个数据文件删除。
**这一轮是整条链路上唯一一次真正改变运行时行为的一轮**：之前 P1–P4 只加不改（快照、类型、schema、迁移、端点、导入），Astro 仍在读 `content/*.ts`；从这里开始，文案的真值在库里。

## 1. 交付清单（`wc -l` / `git diff --numstat` 实测）

| 文件 | 行数 | 本轮净变化 | 内容 |
|---|---|---|---|
| `apps/astro/src/lib/payload.ts` | 110 | +54/−3 | `CMS_ORIGIN` 缺键即模块级抛；新增 `PageCopyId` + `getPageCopy<T>()` + `upstreamDetail()` |
| `apps/astro/src/site.ts` | 190 | +13/−2 | 删 `\|\| 'juece'`，加「缺 `SITE_ID`」显式抛分支；头注释里「默认按 juece」的作废表述同步改齐 |
| `apps/astro/astro.config.mjs` | 30 | +10/−1 | 同上口径（未知值仍由既有 `SITE_DOMAINS` 检查处理，不重复） |
| `apps/astro/package.json` | 23 | +4/−4 | `dev`/`build`/`preview` 显式 `cross-env SITE_ID=juece`；删冗余 `build:juece` |
| `apps/astro/src/pages/{index,features,solutions,pricing}.astro` | 383/594/485/311 | 各 +4~5/−3~4 | frontmatter 改 `await getPageCopy<XxxContent>('xxx')`；hero 统一 `titleLines.map()` |
| `apps/astro/src/pages/articles/[slug].astro` | 319 | +2/−2 | 封面绝对地址改用唯一真值 `CMS_ORIGIN`（见 §5.2） |
| `apps/astro/src/types/pages/{home,features,solutions,pricing}.ts` | 79/38/29/38 | 共 −2 | `em`→`emphasis`；`titleA`+`titleEm`→`titleLines[]{text,emphasis?}` |
| **删除** `apps/astro/src/content/{home,features,solutions,pricing}.ts` | — | **−1937 行**（524/587/276/550） | `git rm`，`src/content/` 目录整体消失（状态 `D `，未提交） |
| 新增门禁 `scripts/astro-copy-hero-dom.mjs` | 67 | 新 | DOM 级核对面（见 §3） |
| 新增门禁 `scripts/astro-copy-render-diff.mjs` | 93 | 新 | tasks 3.4 的零参数入口 |

全部自研文件 ≤594 行，AGENTS.md §4 的 1000 行上限余量充足。零新增依赖（`cross-env` 本就是 `apps/astro` 的 devDependency，`build:erp`/`build:yunque` 已在用）。

## 2. 读路径（tasks 2.14）

- `getPageCopy<T>(page)` 打 `GET {CMS_ORIGIN}/api/v2/content/pages?${new URLSearchParams({site: siteId, page})}`；三条失败路径各自独立抛：`!res.ok`（带 HTTP 状态 + URL + 上游 `error.code`/`error.message`）、`success !== true`、缺 `data.copy`。**没有任何回退分支**——拉不到就是构建失败，不回退代码内旧文案（REQ-0003 验收第 5 条）。
- `CMS_ORIGIN` 从「注释里承诺 fail-fast」变成代码：`import.meta.env.PUBLIC_CMS_ORIGIN` 不是非空字符串即在模块求值时抛。文章面（`fetchContent`）与页面面共用这同一个已校验值。
- 四页 frontmatter：`const c = await getPageCopy<XxxContent>('xxx')`（顶层 await 与既有 `await getArticles()` 同形）。类型真值仍只在 `types/pages/*`，页内不再有字面文案副本（零星模板字面量不在本需求范围，见 design「页面文案 vs 品牌配置」）。
- 唯一投影不动：`apps/cms/src/lib/pageCopyProjection.ts` 仍是端点/parity/导入三处共用的唯一实现，本轮只在 Astro 侧把消费端形状对齐到它输出的 reader 形态（`titleLines`/`emphasis`），因此 parity 与覆盖度门禁在改动后复跑仍绿（§4）。

## 3. 切换前后「逐字一致」是两条门禁，不是一条

`REQUIREMENTS.md` REQ-0003 非目标第 3 条钉的是 **DOM 结构**，而既有文本抽取器（`scripts/astro-copy-render-text.mjs`）看不见 `<span class="line">` 与 `{text}<br />` 的差别（两者抽出的可见文本一模一样）。⇒ 本轮补一条 DOM 级门禁，两条并行：

| 门禁 | 命令 | 结果 |
|---|---|---|
| 渲染可见文本（tasks 3.4） | `node scripts/astro-copy-render-diff.mjs`（内部用**同一抽取器**重抽三站四页再与 `evidence/snapshot-pre-import/render/` 逐字节比） | `12/12 三站四页可见文本逐字一致`，差异 0 条，`exit=0`（`135`；worker 独立跑同结果 `126`） |
| hero `<h1>` DOM 结构 | `node scripts/astro-copy-hero-dom.mjs <dist> <site> <out>` ×3 → `diff` 基线 | 12 条逐字相同，切换前后产物 sha256 都是 `e582aa63e253effd`，`hero_dom_diff_exit=0`（基线 `119` + `evidence/snapshot-pre-import/hero-dom.json`；复测 `134`） |

「不改 DOM」这条决定了循环的落地形态：**收敛的是两套标题机制，不是四处调用点**——四页各留一行 `titleLines.map()`，行内包裹元素按页原样不动。把 `<em>`/`<br/>` 抽进 `PageHero` 或共享组件会改 Astro 作用域样式哈希的归属（实测三页 slot 元素分别带 `fsswmxcn`/`6dt247gv`/`lmkygsfs`），样式命中随之改变。口径已写进 design D8③ 的「2.14 落地口径」。

## 4. 三站构建与既有门禁复跑（主 session 独立重测，不采信自述）

| 命令 | 期望 | 实测 |
|---|---|---|
| `pnpm astro:typecheck` | 0 | `exit=0`（`128`；worker 同 `120`） |
| `pnpm astro:build` / `:erp` / `:yunque` | 各 0 | `build_juece_exit=0` / `build_erp_exit=0` / `build_yunque_exit=0`，三份日志 `ECONNREFUSED` 计数均为 **0**（`131`/`132`/`133`；worker 同 `121`–`123`） |
| `node scripts/astro-copy-parity.mjs`（3.1，改动后回归） | 0 | `exit=0`，`12/12 逐字一致`，端点侧叶子字符串 **1374**（`129`）⇒ 切读路径没碰服务端投影，parity 仍成立 |
| `node .aiws/tmp/astro-page-copy-cms/63-coverage-check.mjs`（schema↔类型覆盖度） | 0 | `exit=0`，`SUMMARY A\B total=0`（`130`）⇒ `titleA`/`titleEm`→`titleLines`、`em`→`emphasis` 两次改名后 TS 与 schema 仍一比一 |
| 负向：`env -u SITE_ID … astro build` | 非 0 | `no_site_exit=1`，错误可读：`[astro] Unable to load your Astro config` + 指向 `cross-env SITE_ID=…` 的中文说明（`125`） |
| 负向：`env -u SITE_ID … astro preview` | 非 0 | 同样 `exit=1`（`127`）⇒ 去兜底对 preview 生效，见 §5.1 |

## 5. 过程中的偏差与自纠（如实登记）

**5.1 派工**：本轮实现全部由 `astro-p5-worker` 产出（回到 AGENTS.md「主 session 编排收敛、不直接写业务代码」），P4 那次 inline 偏离未再发生。主 session 只写门禁脚本与做 §5.2 那处双写收敛。

**5.2 主 session 就地收的一处双写**：worker 在 Deviations 里报告 `index.astro:359` 仍直读 `import.meta.env.PUBLIC_CMS_ORIGIN` 拼封面绝对地址；全仓再查发现第二处同类 `articles/[slug].astro:59`。`CMS_ORIGIN` 本轮刚被升级为「唯一已校验真值」，这两处若不动就是同一事实的第二处读取（且绕过校验），故改为导入 `CMS_ORIGIN`（2 文件 4 行，属 §4「发现双写立即精简至唯一路径」）。改后三站构建 + 两条逐字门禁在 §4 里全部重跑过。

**5.3 `preview` 脚本的去兜底回归**：worker 实测去兜底后 `astro preview` 不带 `SITE_ID` 会红（它自己引入的回归），并顺手补 `cross-env SITE_ID=juece`，同时在允许范围（`apps/astro/**`）内 ⇒ 认可。原 brief 未列 `preview`，属计划漏项而非超范围。

**5.4 `site.ts` 的缺键分支实测不可达**：`astro.config.mjs` 先加载并抛，`site.ts` 那条 `typeof rawSiteId !== 'string'` 在生产路径上永不触发（`125` 的 stack 显示抛点是 `astro.config.mjs:10`）。保留理由：两处读的是**不同机制**的同一个键（`process.env` vs `import.meta.env`），`tsc` 直跑与任何绕过 config 的入口只会撞到 `site.ts` 这道；且未知值检查本轮之前就已经是两文件各一份的既有形态。记为「第二道闸」，不当成冗余删除，也不夸称成必要路径。

**5.5 差点误报的一条**：按源码字面量 `grep '.cap-tag.yb'` 在构建产物里查不到，一度判成「样式没发布、修复无效」；实际 Astro 把作用域属性插在两个类名之间（`.cap-tag[data-astro-cid-fsswmxcn].yb`），按编译形态再 grep 三站 CSS 全命中（`137`）。⇒ 结论必须按编译产物的真实形态核，不能按源码字面量。

## 6. PROB-024（tasks 2.16）修毕并转 DONE

`features.astro:128` 由 `cap-tag${cap.tagTone ?? ''}`（拼出单类名 `cap-tagyb`）改为 `cap-tag${cap.tagTone ? ' ' + cap.tagTone : ''}`。两条实测 + 一条机检化改写：
- 产物 class：三站 features 页各 **1 条** `class="cap-tag yb"` + 4 条 `class="cap-tag"`，缺陷串 `cap-tagyb` 计数 **0**（`136`）——与快照里三处 `tagTone: 'yb'`（`features.ts` 原 `:155`/`:316`/`:476`）逐站对上。
- 样式命中：`.cap-tag[data-astro-cid-fsswmxcn].yb` 在三站 CSS 资产（同一份 `features.DcrV5jsl.css`）里都在（`137`）⇒ 修前该规则永不命中（云雀暖金标签配色是死样式），修后才生效。这是**有意的视觉修复**，不在「逐字一致」门禁范围内：两条门禁核的是可见文本与 hero DOM，标签配色改的正是本就该生效的样式。
- 上面两条首轮是人肉 `grep`，日志里没有命令自身的退出码（不合本仓「退出码由命令自身落盘」的规矩）⇒ 改写成可机检脚本 `.aiws/tmp/astro-page-copy-cms/142-check-cap-tone.mjs`（四项断言任一不成立即 `exitCode=1`：带 tone 的 `cap-tag yb` 恰 1 条、无 tone 的 `cap-tag` 恰 4 条、`cap-tagyb` 计数 0、编译后选择器在 CSS 资产里存在），实跑三站全过 `cap_tone_exit=0`（`142`）。台账只登记 `142` 这一条，`136`/`137` 在 note 里标为「首轮取证，不作门禁依据」。

台账 `.aiws/issues/problem-issues.jsonl` 的 PROB-024 **本轮已转 DONE**（不再等 4.2，否则 tasks 1.5 的「由 2.16 修后转 DONE」承诺会悬空）：脚本 `.aiws/tmp/astro-page-copy-cms/flip-prob-024-done.mjs` 只改那一行，`OPEN → DONE` + Notes 追加实测结论，问题台账仍 25 行（`149`）；复跑输出 `no-op：PROB-024 已 DONE，台账仍 25 行`（`150`）。脚本自带一条自锁：Notes 已结案而 Status 非 `DONE` 即抛，不允许半结案状态。

## 7. 收尾入账与真值同步

**7.1 台账**：`evidence/verification.jsonl` 由 69 行 → **99 行**，分两个 appender 落（沿 P4 的「入账脚本自身的运行留给下一个 appender 登记」约定）：
- `append-verification-p5.mjs`：21 条（`117`–`143` 中带退出码的轮次），台账 69 → 90（`144`），复跑 `no-op：21 条已全部在册` （`145`）。
- `append-verification-p5b.mjs`：9 条（入账/审计/REQ 同步/PROB-024/门禁复校），台账 90 → 99（`153`），复跑 `no-op`（`154`）。
- 只读审计器 `114-audit-ledger-coverage.mjs` 复跑两次（`146`、`155`）：8 个 appender 的声明条数 15/5/5/20/8/6/21/9 全部在册，`AUDIT ledger_rows=99 missing_total=0` ⇒ 上一轮修的去重键缺陷没有让这一轮再静默丢行。

**7.2 不入账的六轮与它们的取代件**：`126`（worker 的 render-diff）、`128`/`129`/`130`（主 session 的 typecheck / parity / 覆盖度）、`136`/`137`（PROB-024 人肉 grep）六轮**只留了 stdout、退出码没落进日志**（其中前三条是我自己这轮犯的，与 P4 记录的那次同类）⇒ 按「未测量不登记」不入库，改登记带退出码的复跑：`138` typecheck、`139` parity、`140` 覆盖度、`141` render-diff、`142` cap-tone（复跑期间工作树未再改动，结果与首轮逐字相同）。四条正向门禁 + 两条负向（`125`/`127` 期望 `exit=1`）构成 P5 的验证面。

**7.3 Requirement Sync Gate**：`REQ_SYNC: SYNCED`。合同行 `.aiws/requirements/requirements-issues.jsonl` 的 REQ-0003 有四处已被 P5 实现推翻（Preconditions/Inputs 仍暗示 SITE_ID 可缺省、Business_Logic 未写静态模块已删、Tests 缺三条零参数逐字门禁、DOM 那道门禁无处登记），由幂等脚本 `append-req0003-p5-sync.mjs` 逐字段改齐 + CHANGELOG 追加 1 行（`147`），复跑两路均 `no-op`（`148`）。**`REQUIREMENTS.md` 本轮未改**：非目标第 3 条与验收 7 的原表述本就覆盖 P5 交付的口径（「渲染结果逐字一致」「删掉 content/*.ts 并去 SITE_ID 兜底」），验收框留到 4.2 统一勾 ⇒ 因此 `aiws validate .` 不需 sync 即绿（`151`），`aiws change validate --strict` 亦绿（`152`）。

**7.4 顺手修的一处表述漂移**：四个早期 appender（`p2p3`/`p3c`/`p3d`/`p4`）的**代码**在上一轮已改成 `command+artifact` 去重，但第 2 行注释仍写「按 command 去重」⇒ 注释与实现不符。只改注释（四文件各 1 行），随后把六个 appender 全跑一遍证明逻辑未动、台账仍 69 行且各 `_exit=0`（`143`）。

## 8. 尚未落地（不在本证据范围）

- **2.17 e2e 读路径用例**、3.2 `pnpm --filter cms build`、3.5 端到端自助改稿、3.6 死端口负向构建、3.8 收口门禁链（`--check-evidence --check-scope`）、3.9 §9 自检、3.10 台账收尾核对、2A.3 双审查、4.x 交付归档、5.1 线上发布前置、5.2 PROB-023 移交。
- **线上未执行、未核实**：本轮只连本地 CMS（`127.0.0.1:3000`）与本地容器库（`127.0.0.1:5434`），未触碰任何线上环境。线上因无 `prodMigrations` 不会自动跑迁移 ⇒ 新集合为空，一旦 Astro 切了读路径又没先迁移+导入，构建会 404 硬失败（正确行为，但发布顺序必须是「先迁移 + 先导入 → 再切 Astro 构建」）。
