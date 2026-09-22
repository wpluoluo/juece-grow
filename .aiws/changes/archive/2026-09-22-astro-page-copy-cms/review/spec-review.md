# Spec Review · astro-page-copy-cms

审查人：独立 spec/gate reviewer（与实现者互不知情）· 日期：2026-09-21
方法论：`.agents/skills/ws-spec-review/SKILL.md`（流程/归因/证据/门禁完整性，不做代码质量审查）
真值：`AI_PROJECT.md`、`REQUIREMENTS.md`、`AI_WORKSPACE.md`、`AGENTS.md`
分支：`git branch --show-current` = `change/astro-page-copy-cms` ✓（归因绑定成立）

> 本报告的每一条实测都由我自己跑只读命令得出，不采信工件里的「已验证」措辞。凡我没独立复跑的（构建/e2e/会清空 dist 的负向门禁），在下面明确标「未独立复跑 + 依据日志编号」。

---

## 结论

实现本体与四道逐字门禁经我独立复跑与实弹请求全部为真、零范围越界、迁移零破坏性；**但 REQ-0003 验收第 2 条（首页 hero/CTA 后台增删排序 → 公开站按后台顺序渲染）没有任何机器对面，且验收第 1、6 条的唯一机器对面只活在 gitignored 的一次性 tmp 脚本里**——按 `tasks.md:85`（4.2）去勾八格验收，会产出三格「勾了但复现不出」的虚假勾选。

- **BLOCKER：1**
- **HIGH：4**
- **WARNING：9**
- **INFO：3**

---

## Blockers

### B-1（BLOCKER）REQ-0003 验收第 2 条「首页 hero/CTA 后台增删 + 排序 → 公开站按后台顺序渲染」零证据链

**断言是什么**
- `REQUIREMENTS.md:50`：「[ ] 首页 hero 与 CTA 可在后台增删条目并调整顺序，公开站按后台顺序渲染」
- 同口径重复出现在 `proposal.md:11`、`design.md:21`、plan 的 Goal（`.aiws/plan/2026-09-20_10-04-01-astro-page-copy-cms.md:4`）。

**实测是什么（四个方向都查了，全部无对面）**
1. 合同行的验收入口里就没有它。`.aiws/requirements/requirements-issues.jsonl:3` 的 `Tests` 字段点名 9 个入口：`pnpm --filter cms build`、三站 `pnpm astro:build{,:erp,:yunque}`、`node scripts/build.mjs`、`astro-copy-parity`、`astro-copy-render-diff`、`astro-copy-hero-diff`、`astro-copy-client-bundle`、`pnpm --filter e2e test`、`astro-copy-cms-unreachable`——无一条与「增删条目 / 调整顺序」有关。
2. e2e 用例不覆盖。`apps/e2e/tests/page-copy.spec.ts` 的 9 条实跑用例（声明在 `:82 :93 :122`(×4) `:128 :145 :185`）里：`:185` 改的是 **pricing** 的 `hero.description` 单字符串（不是 home，也不是增删/换序）；`:93` 断言 `/pricing` 页头按索引等于端点 `copy.hero.titleLines`（pricing 的 titleLines 是导入原序，且不是本条验收的主体）。没有任何一条碰 `page-home` 的 `hero.*` 或 `cta.rows` 的增删或换序。
3. 产物门禁方向相反。唯一看首页 hero 的门禁 `scripts/astro-copy-hero-diff.mjs` 判的是「与**导入前**基线逐字节一致」——我刚复跑 `exit=0`（12/12 一致）。也就是说，后台真加一行 hero 之后它必然变红：工件自己也承认这点（`tasks.md:68`「任何合法改稿都会让它红 ⇒ 迁移期守卫」；`evidence/delivery-build-gates-p8.md` §8 第 2 条就地撤回「把它串进构建链」）。⇒ 现有门禁面**主动排斥**这条验收所要的行为。
4. 唯一沾边的实测是错的主体。`grep -rln "排序|reorder|_order" .aiws/changes/astro-page-copy-cms/` 只命中 `evidence/migration-import-endpoint.md:32`（日志 `88`：写 `features.juece` → 读回 → `caps` 五块**顺序保持**）——那是 features 的 blocks 存储往返，既不是首页 hero/CTA，也不经过渲染层。

**已经成立的部分（避免把结论说过头）**：结构条件是**真的**——`PageHome.ts:52` `hero.titleLines minRows:1`（无 maxRows ⇒ 可增删）、`:399` `cta.rows minRows:1`、位置耦合按 design D2 锁死（`:136` nodes `maxRows:3`、`:163-164` chips `minRows/maxRows=3/3`、`:334` minis `maxRows:2`），全仓 `git grep sortOrder -- apps` 命中 **0**（不存排序列）。⇒ 「后台有能力」已证，「公开站按后台顺序渲染」未证。

**最小修复动作**（二选一，不许静默勾上）
- 首选：补一条常驻用例，形状照 `page-copy.spec.ts:185` 那组——`where slug=juece-grow` → project id → 锁定 `page-home` 那一行 → 整份 `hero`/`cta` PATCH 一个**换序 + 增删**的形态 → `page.goto ${WEB_ORIGIN}/` 断言渲染序列等于后台数组序 → `finally` 复原并把整份 copy 与改前快照深比（同时必须避开 hero-diff，因为它是导入前基线守卫）。
- 或者：把该条验收在 `REQUIREMENTS.md` 与 4.2 的口径降级为「schema 侧可增删排序已证（含 min/max 约束）；渲染顺序耦合未证」并登记一条 PROB 跟踪，不许按「已通过」勾选。

---

## High

### H-1（HIGH）`verification.jsonl` 190 条指针 100% 指向 gitignored 目录，持久证据里没有整体声明

- **断言**：`tasks.md:76`（3.10）「机器可复核证据：`evidence/verification.jsonl`（逐条命令 + 期望退出码 + `.aiws/tmp/astro-page-copy-cms/` 工件指针），使 `aiws verify-bc` 不报 `legacy evidence assumed`」。
- **实测**：190 行的 `artifact` 去重后 **190 个值全部**以 `.aiws/tmp/astro-page-copy-cms/` 开头（枚举结果：非 tmp 指针 = **0** 条）；`git check-ignore -v` → `.gitignore:2: .aiws/tmp/`、`.gitignore:4: .aiws/secrets/`。当前盘上我逐条 `existsSync` 复核：**0 断链**（313 个文件都在）。但一旦提交并推到别的 clone，这 190 条指针全部失效，而台账是唯一被 design 成「机器可复核」的证据载体。
- **持久证据的承认程度**：只局部承认两处，且都不是这条风险本身——`evidence/selfservice-and-negative-build-p9.md:101`（只说 `235`/`236` 两只脚本 gitignored）、plan:117「`.aiws/tmp/astro-page-copy-cms/*.log`（构建/校验原始日志，**可弃**）」。措辞「可弃」反而与「190 条判定全靠它」互相矛盾。
- **最小修复**：4.1 之前把 ledger 引用日志的**判定行摘录 + sha256**内联进 `note` 字段，或把日志正文批量落到 `evidence/logs/`（入库）；同时在 `verify-before-complete.md` 顶部写死这条限制。

### H-2（HIGH）验收 1（一比一）与验收 6（SEO 三件套）的唯一机器对面是一次性 tmp 脚本，且未进 `Tests`

- **断言**：`tasks.md:44`（2.14）「覆盖度 `A\B total=0`（`140`）」；`tasks.md:75`（3.9）「SEO 三件套逐页齐全 … 实测 `268` `selfcheck_exit=0`」。
- **实测**：两只实现 `.aiws/tmp/astro-page-copy-cms/63-coverage-check.mjs`、`268-agents9-selfcheck.mjs` 只存在于 gitignored tmp；`scripts/` 下 7 只持久 `astro-copy-*.mjs` 里**没有**覆盖度与 SEO 两道；合同行 `Tests` 也没登记它们。
- **结论本身是真的**（我今天独立复验）：`node .aiws/tmp/astro-page-copy-cms/63-coverage-check.mjs` → `SUMMARY A\B total=0`、`pricing` 的 `B\A` 恰 1 条 `plans[].currency`（与 `tasks.md:35` 精确一致）、`exit=0`；SEO 侧 `apps/astro/src/layouts/Layout.astro:67-69` 同批输出 `<title>`/`meta name=description`/`link rel=canonical`，四页 `index.astro:73-74`、`features.astro:21-22`、`solutions.astro:12-13`、`pricing.astro` 同形全部取自 `c.meta.*`；产物侧 `apps/astro/dist/features/index.html` 实测含 `rel="canonical" href="https://juece.cloud/features/"`。
- **问题在可复现性**：换机器/清 tmp 之后，验收 1 与 6 再无任何机器对面，而 `Tests` 字段读起来像「八条都有入口」。
- **最小修复**：覆盖度固化为 `scripts/astro-copy-coverage.mjs`（零参数：读 `evidence/snapshot-pre-import/` + `apps/astro/src/types/pages/` + `apps/cms/src/collections/pages/`），SEO 断言并入持久门禁（新增 `astro-copy-seo.mjs` 或串进 `astro-copy-render-diff.mjs` 的产物侧），两者追加进合同行 `Tests`。

### H-3（HIGH）§9 自检把 AGENTS.md §4 的 1000 行硬限额实现成 1500，同一 change 内三个口径

- **断言**：`tasks.md:75`「单文件 ≤1500 行」；`design.md:12`「单文件 ≤1000–1500 行」；合同行 `NonFunctional`「自研文件≤1000行」；`evidence/astro-read-path-switch.md:22`「AGENTS.md §4 的 1000 行上限余量充足」。
- **实测**：真值 `AGENTS.md` §4 原文 = 「自研文件单个不超过 **1000** 行」；`.aiws/tmp/astro-page-copy-cms/268-agents9-selfcheck.mjs:47` `const LIMIT = 1500`，其日志 `268` 的断言标题就是「§4 自研文件 ≤1500 行」。⇒ 这条门禁对 1001–1500 行的自研文件会放绿（正是 PROB-027 登记的「门禁不咬人」同类）。
- **当前无实际违规**：自研最大文件 `apps/astro/src/pages/features.astro` 595 行（`wc -l`=594，末行无换行）；四集合 443/350/142/198、投影 162、`payload.ts` 127。
- **最小修复**：`LIMIT` 改 1000、`design.md:12` 的「≤1000–1500」改「≤1000」，脚本按 H-2 一并固化进 `scripts/`。

### H-4（HIGH）`Evidence_Path` 与合同行 `Evidence` 指向不存在的 `evidence/verify-before-complete.md`，且 proposal 把它当已存在的载体引用

- **断言**：`proposal.md:31` 与 plan:13 的 `Evidence_Path`、`.aiws/requirements/requirements-issues.jsonl:3` 的 `Evidence` 字段；`proposal.md:141` 更把它写成「P-V1..P-V7 实测」的载体。
- **实测**：文件不存在（`test -f` → NO；`find .aiws -name verify-before-complete.md` 只命中 4 个**归档 change**）。我实跑校验：
  - `aiws validate .` → `✓ aiws validate: F:\juece-grow`，**exit=0**（与 `258` 一致）
  - `aiws change validate astro-page-copy-cms --strict` → `ok: change validated`，**exit=0**（与 `259` 一致）
  - `aiws change validate astro-page-copy-cms --strict --check-evidence --check-scope` → **exit=2**，9 条 error：proposal/plan 各 3 条 `Evidence_Path missing file`（`verify-before-complete.md`、`review/spec-review.md`、`review/quality-review.md`）+ 3 条 finish gate（同三件）。
- **判定**：这三件本就是「交付前才该存在」的产物，且 `tasks.md:17`（0.7）在规划轮已如实登记「报的 11 条全部是交付前才该存在的证据与双审查文件，非空签」⇒ 不算隐瞒。但 `proposal.md:141` 用过去式把它当已存在的载体是失真的：P-V1..P-V9 的实测实际分散在 5 份 evidence 文件里。
- **最小修复**：4.1 落 `verify-before-complete.md`（P-V1..P-V9 汇总 + 每条对应的 ledger 编号 + H-1 的指针限制声明 + 本报告的 B-1 处置结论），或把三处指针改指实际存在的 5 份 evidence；`review/quality-review.md` 由 `$ws-quality-review` 补（2A.3 目前未勾，一致）。
- 本报告即为 `review/spec-review.md` 的落地；落盘后 `--check-evidence` 应只剩 2 条 missing（quality-review 与 verify-before-complete）。

---

## Warnings（每条一行）

- **W-1** 规划工件路径漂移未同步：`proposal.md:53` 与 plan:74 仍写 `scripts/import-astro-copy.mjs`（实物 `apps/cms/scripts/import-astro-copy.ts`，`tasks.md:42` 自己登记了该偏差），plan:73 仍写 `scripts/astro-copy-projection.mjs`（实物 `apps/cms/src/lib/pageCopyProjection.ts`，`design.md:136` 已改齐）。
- **W-2** 数字口径同句混用：`proposal.md:40`「（1933 行：home 587 / features 524 / solutions 550 / pricing 276）」——括号内相加 = 1937；`REQUIREMENTS.md:35` 用 1933（= `git show HEAD:… | wc -l`），合同行 `Notes` 用 1937（= `git diff --numstat`）。两个数在各自口径下都对，但混排会让下一轮误判成矛盾（我实测：`git diff --numstat` = 0/524、0/587、0/276、0/550 = 1937；HEAD 版 `wc -l` = 523/586/275/549 = 1933）。
- **W-3** `tasks.md` 的行数断言普遍按 `split('\n')` 计数、与 `wc -l` 差 1 且未注明口径：`payload-types.ts` 2022 vs `wc -l` 2021（该文件末行**无**换行 ⇒ 2022 才是真行数，✓）、`features.astro` 595 vs 594（同上 ✓）、迁移 `.ts` 689 vs 688、`.json` 8038 vs 8037（这两只末行**有**换行 ⇒ 多算 1）。
- **W-4** `tasks.md:32`（2.2）「新建 `apps/astro/src/types/pages/{home,features,solutions,pricing}.ts`（39/79/30/39 行）」与盘上 `{home:79, features:38, solutions:29, pricing:38}`（`wc -l`）顺序错位：79 是 home 的值，被排到了 features 位。
- **W-5** 同一份 `tasks.md` 内 `payload.ts` 行数两个值：`tasks.md:44`（2.14）写 110、`tasks.md:75`（3.9）写 127；实测 127（P9 为 PROB-028 加 `connectFailure()` 后未回改 2.14 的断言）。
- **W-6** `AI_WORKSPACE.md` 是测试入口真值、且被 `proposal.md:74` 列入 In Scope，但本轮零改动（`git status` 无它）：本 change 新增 6 只零参数门禁与「`astro:build` 必须有 CMS 在 `:3000`」这条新前置，都没进 `AI_WORKSPACE.md:35-40` 的验证入口段（`astro_build_cmd`/`e2e_prerequisites` 仍是不带此前置的旧口径）⇒ 入口真值漂移；合同行 `Tests` 里有，但那里不是「怎么跑」的真值落处。
- **W-7** 归因不对称（`AI_PROJECT.md` §3.1 要求 Notes 互引）：`problem-issues.jsonl` 的 PROB-024/025/026/027/028 五行都写了 `Req_ID=REQ-0003` ✓，反向却缺——REQ-0003 行的 `Notes` 只提到 PROB-026/027/028，**没有提被 `Contract_Row` 当作唯一 `Problem_ID` 的 PROB-024，也没提 PROB-025**。
- **W-8** `.aiws/requirements/CHANGELOG.md` 表体走形：第 15 行是空行（把一张表切成两段、后段无表头），第 19–23 行（本 change 的 P4/P5/P6/P8/P9 五条同步记录）只有 3 列而表头 6 列 ⇒ 缺「影响范围 / 关联 issues/PR / 记录人」，与本文件第 11 行自订规则「记录应可审计：说明…影响范围、关联 issues/PR」不符；第 18 行内 9 个竖线（`juece|erp|yunque` 之类字面值）会串列。
- **W-9** 台账审计方向不含「tasks 引用 ⊆ 台账」：`tasks.md:12,16,17`（0.2/0.6/0.7）以 `04`/`05`/`06`/`07` 为实测依据，但台账最小编号是 `20` ⇒ 这些编号在 ledger 里查无此行；盘上 243 只 `.log` 中 **54 只**不在台账（多数是 appender/审计自身的自注册不可能日志与 dev 启动日志，P5/P8/P9 已给出口径；规划轮 01–10 的 10 只从未被登记，也未登记为限制）。3.10 声称的「双向覆盖」实际是 appender↔ledger 两向（我复跑 262/263 日志确认 `missing_total=0` / `covered=180 uncovered=10` 为真），别把它读成「tasks 的每一条都被台账核过」。

---

## 通过项（压成一行，附我独立复跑的证据）

- ✓ **四道逐字/产物门禁 + parity 我全部当场独立复跑为绿**：`node scripts/astro-copy-parity.mjs` → `12/12 (site,page) 逐字一致`、端点侧叶子 **1374**、exit=0；`astro-copy-render-diff` → `12/12 … 可见文本逐字一致（差异清单为空）` exit=0；`astro-copy-hero-diff` → `12/12 … hero <h1> 内部 DOM 与切换前基线逐字节一致` exit=0；`astro-copy-client-bundle` → 三站各「禁止串命中=0 / CMS地址已内联=true / 判定=OK」exit=0。
- ✓ **端点契约我匿名实弹复测**：12 组 `(site,page)` 全 `http=200` + `"success":true`（⇒ 「三站四页 12 条已发布记录」为真）；缺 `site`/未知 `site` → `400 INVALID_SITE`；未知 `page` → `400 INVALID_PAGE`；原生 `/api/page-pricing` 匿名 → `403`。
- ✓ **`Tests` 字段点名的每个入口都对应盘上真实命令/脚本**（根 `package.json` 的 `astro:build{,:erp,:yunque}`、`astro:typecheck`、`cms:build`、`e2e:test` 齐全；7 只 `scripts/astro-copy-*.mjs` 齐全；已撤掉的三参数抽取器只作为被调方存在）。
- ✓ **门禁脚本能零参数跑出绿灯**（上条四道即时证；`astro-copy-cms-unreachable.mjs` 按硬约束**未跑**（它会清空 `apps/astro/dist`），依据日志 `230`/`232`/`233` 三次 `判定=OK` + 红侧自证 `228`）。
- ✓ **构建/e2e 类退出码未独立复跑（违反只读约束）**，但逐条核了落盘日志且与产物状态自洽：`191` `cms_build_exit=0` 且生产路由清单含 `ƒ /api/v2/content/pages`（`191:34`）；`193`/`194`/`195` 三站各 `astro_build_*_exit=0` 且逐日志 `grep -c ECONNREFUSED` = **0**（我自己数过）；`196` `build_mjs_exit=0` 且 `libuv` 白名单告警在 `196` 中 **0 命中**；`248`/`249` 补跑两站 `exit=0`、`ECONNREFUSED` 0；`243` `68 passed / 2 skipped` `e2e_full_exit=0`、`170` `67 passed / 2 skipped` `exit=0`。
- ✓ **抽测的可验证事实断言，对得上的（共 21 条，18 条精确吻合）**：快照 12 份叶子字符串 = **1374**（与 parity 端点侧独立两次同值）、快照 `null` 叶子 = **0**、空串叶子 = **0**（验收 1 的关键前提，我自己 walk 过 12 份 JSON）、dump 总字符 13922、渲染基线 12 份 = 1269 行 / 20275 字符（与 `render/_index.json` 逐项一致）、问题台账 **28 行**（PROB-023 `OPEN`、024–028 `DONE`）、四集合 + 共享文件 **1230 行**（443/350/142/198/97）、`PageHome` 字段构成 leaf 80 / group 15 / array 9 / hasMany 3（我按 `name:` 计数 102 反推 +2 共享字段吻合）、`payload-types.ts` 相对 HEAD 净增 **986 / 删除 0**、迁移 up() **39 `CREATE TABLE` + 15 `CREATE TYPE` + 4 `REFERENCES projects` + 4 `ADD COLUMN`、零 DROP/RENAME**、up() SQL **187 条语句 / 32542 字符**、二次执行硬拒（`87` `已存在 39 张 page_* 表` `exit=1`）、覆盖度 `A\B total=0` 且 pricing `B\A` 仅 `plans[].currency`、`verification.jsonl` **190 行**且 190 个指针当前 0 断链、导入幂等（`94` `created=12 updated=0` → `97` `created=0 updated=12`）。
- ✓ **AGENTS.md §7 迁移红线**：本次纯新增集合 + 建表，`up()` 零破坏性；`down()` 的 66 条 DROP 只打 `page_*` 39 张表、本次新建枚举、新建 FK/索引（唯一非 `page_*` 目标是 `payload_locked_documents_rels` 上新加的 4 个 FK/索引与 `schema public` 语句），不动任何既有表 ⇒ 「数据自持、不丢」成立。未独立复跑 `information_schema` 复核（需 `.env` 凭据，按硬约束不读），依据日志 `86`。
- ✓ **AGENTS.md §4 禁兜底/双写在 schema 与读路径上成立**：`git grep "|| 'juece'" -- apps/astro` 命中 0；`apps/astro/src/content/` 目录物理消失、全仓 `from '../content/` 残留 0；`site.ts:169-175` 与 `astro.config.mjs:4-13` 各是显式「缺键即抛」分支；四集合零 `seo*` 字段（`pageCopyShared.ts:32` 注明唯一载体是镜像出的 `meta`），Astro 侧 `types/pages/` 零 `seo` 字面（残留的 `seoTitle` 消费者全在 Articles/法务页那侧，属 PROB-023 与文章模型，未被本 change 触碰）；`kind` 未被另存（`PageFeatures.ts:13/179/311` 只作注释，判别键唯一由 `blockType` 承载，读侧 `pageCopyProjection.ts:153-158` 不成立即抛、不静默）；全仓零 `sortOrder`。
- ✓ **§5 命名三层映射**：四集合 + 共享文件的全部 `label` 都是 `{zh,en}` 成对（每文件 zh 计数 == en 计数，零裸字符串 label）、字段 `name` 零 snake_case；Astro 侧零 snake 取值；DB 侧 `enum_page_features_caps_tag_tone` 之类 snake 名由 Payload 映射，符合规范。
- ✓ **§6 API 规范**：`/api/v2/content/pages`，出口全走 `lib/envelope.ts` 的 `ok/err`，无手写 `Response.json`；未命中 404 `PAGE_COPY_NOT_FOUND`（不留空数组兜底）、异常走 `logger.error` + 500，源码 `apps/cms/src/app/api/v2/content/pages/route.ts:1-70` 逐行核过。
- ✓ **范围与越界**：`git status --porcelain` 50 条（29 已跟踪改动 + 21 未跟踪）逐条比对，**全部**落在 `proposal.md:69-79` 的 9 条 In Scope 内，0 条越界；`--check-scope` 亦无越界报告；Out of Scope 五条实物核查——`collections/{Leads,Sites,Forms,Projects,Users,Memberships}.ts`、`lib/envelope.ts`、`access.ts` 零 diff，`{privacy,terms,sitemap,404}.astro` 与 `feed.xml.ts` 零 diff 且品牌串仍在（`articles/[slug].astro:80` 的 publisher `觉策科技`/`juece.cloud` 未动）⇒ **PROB-023 未被错误并入**（台账 `Status=OPEN`）；`docs/08-deployment.md`、`scripts/cms-run.sh`、`scripts/backup.mjs` 零 diff ⇒ 无「悄悄做掉线上部署」；`apps/astro/src/pages/articles/[slug].astro` 的 2 行改动是把 `import.meta.env.PUBLIC_CMS_ORIGIN` 换成已校验的 `CMS_ORIGIN`（`evidence/astro-read-path-switch.md` §5.2 登记为收双写），不是品牌改动 ⇒ 不判越界。
- ✓ **active change 绑定与真值盖章**：`metrics.json` 的 `change_start` = `switch` → `change/astro-page-copy-cms`，当前分支即该分支；`aiws change sync` 最后一次 `2026-09-20T12:57:05Z`，我算的三个真值文件 sha256（`AI_PROJECT` `41ef47fd…`、`AI_WORKSPACE` `6cf3bd87…`、`REQUIREMENTS` `b53cc9d7…`）与 `.ws-change.json` 的 `synced_truth_files` 逐项相同 ⇒ 真值无未同步漂移（与 `258` 的 `validate_exit=0` 互相印证）。
- ✓ **状态措辞一致**：`REQUIREMENTS.md:31`「状态：待交付」+ 8 格全 `[ ]`；合同行 `Impl_Status=TODO`、`Spec_Status=READY`；`tasks.md:85`（4.2）未勾。三处一致，无「文档已交付/台账未推进」的假状态。
- ✓ **未声称的覆盖不写**：`tasks.md:76` 明确「任何『覆盖率 100%』的说法都不成立」；`evidence/selfservice-and-negative-build-p9.md` §8 主动撤回两处过度声称（`239`–`242` 不算最终态、PROB-028 Notes 的「唯一新持久脚本」错报），`evidence/delivery-build-gates-p8.md` §7 第 3 条自抓「144 行是算术推断不是测量」并补 `221` 实测 ⇒ 本仓库 PROB-027 那一类缺陷在本轮证据里**没有被再犯**（除下面转交项）。

---

## 逐条判定表（对应委托方「重点判定问题」）

| # | 判定问题 | 结论 | 关键证据 |
|---|---|---|---|
| 1 | 归因链是否闭合（8 条验收 ↔ 合同行 `Tests` ↔ 盘上脚本；`REQUIREMENTS.md` 与 `tasks.md` 措辞是否一致） | **部分闭合 → 1 BLOCKER + 2 HIGH**：绑定链（Change/Req/Problem/Plan/分支/盖章）闭合 ✓；`Tests` 9 个入口 1:1 对应盘上真实脚本 ✓（我实跑 4 道 + 匿名 16 次请求）；状态三处一致 ✓。**但** 验收 2 无任何入口（B-1）、验收 1/6 的入口不持久且未进 `Tests`（H-2）、`Evidence` 指向不存在的文件（H-4）、REQ↔PROB 反向互引缺 024/025（W-7） | `REQUIREMENTS.md:49-56`、`requirements-issues.jsonl:3`（`Tests`/`Evidence`/`Notes`）、`page-copy.spec.ts:82-185`、`tasks.md:17/44/75/85`、我实跑的 4 道门禁与 `aiws change validate --strict --check-evidence --check-scope` `exit=2` |
| 2 | 文档断言 vs 实测一致性（PROB-027 同类） | **大体真实（21 条抽测 18 条精确吻合，含所有承重数字），但对不上/需修口径的 6 处**：H-3（1500 vs 1000）、W-2（1933 vs 1937 同句混排）、W-3（±1 行未注明口径）、W-4（`types/pages` 行数顺序错位）、W-5（`payload.ts` 110 vs 127）、W-1（`import-astro-copy.mjs`/`astro-copy-projection.mjs` 已不存在） | `node -e` 枚举叶子数、`git diff --numstat`、`wc -l`、`63-coverage-check.mjs` 复跑、`268`/`86`/`87`/`94`/`97`/`102`/`243` 等日志正文摘录 |
| 3 | 越界与范围漂移；Out of Scope 是否被悄悄做；PROB-023 是否被错误并入 | **✓ 通过**：50 条改动全在 In Scope，0 越界；Out of Scope 六项零触碰；PROB-023 保持 `OPEN` 且品牌硬编码 7 处原样在盘；`articles/[slug].astro` 的 2 行是收双写、已在证据里登记。唯一「声明与实物不符」= In Scope 列了 `AI_WORKSPACE.md` 却没写入口更新（W-6） | `git status --porcelain` + allow-list 比对、`git diff HEAD --stat` 对 Out-of-Scope 路径为空、`problem-issues.jsonl` PROB-023 行、`articles/[slug].astro` diff |
| 4 | 证据完整性（`verification.jsonl` 190 行 ↔ `tasks.md` 声称的编号；双向；gitignored 指针风险是否如实写明） | **1 BLOCKER 级缺口 + 1 HIGH**：反向（tasks 声称但日志不存在）**干净**——112 个被引用编号在盘上全部存在（唯一「403」是散文里的 HTTP 状态码，非日志号）；正向（声称编号 ⊆ 台账）缺 16 个，其中 13 个在 tasks/证据里给了不登记的理由（`126`/`128`–`130`/`136`/`137`/`169`/`192` + 本轮 `260`–`263`/`268`），**规划轮 `04`–`07` 从未登记也未登记为限制**（W-9）；190/190 指针指向 gitignored 目录且**没有整体声明**（H-1） | ledger 解析（190 行、189 个成功 / 9 个失败、状态由 `exit==expected` 算出，与 `tasks.md:76` 描述一致）、`git check-ignore -v`、盘上 243 只 `.log` vs 台账 189 只、`262`/`263` 复跑口径 |
| 5 | 红线合规（§7 零破坏性；§4 禁兜底在 schema/读路径有无第二套载体） | **✓ 通过**：up() 零 DROP/RENAME、纯新增（39 表/15 枚举/4 FK/4 ADD COLUMN），down() 只回滚本次新增对象；`seoTitle`/`seoDescription` 在页面侧零残留消费者（撤销得干净）；`kind`/`blockType` 无双写；零 `sortOrder`；`|| 'juece'` 零命中、`content/` 物理消失、读路径三条失败分支只抛。**唯一松掉的门禁是自检阈值（H-3）**，不是实现本身 | `20260920_121115_page_copy_collections.ts` up/down 解析、`git grep` 结果、`route.ts:20-70`、`pageCopyProjection.ts:35/94-99/153-158`、`site.ts:169-183`、`astro.config.mjs:4-21` |

---

## 未验证项（如实声明，未去挖凭据）

1. `pnpm --filter cms build`、三站 `astro:build*`、`node scripts/build.mjs`、`pnpm --filter e2e test`：**未独立复跑**（硬约束禁止构建类/e2e 长命令），依据 = `191`/`193`–`196`/`243`/`248`/`249` 日志中由命令自身落盘的退出码 + 我复跑产物门禁时 `dist`/`dist-erp`/`dist-yunque`（13/10/10 份 HTML）与之自洽。
2. `node scripts/astro-copy-cms-unreachable.mjs`：**未跑**（它会清空 `apps/astro/dist`，会让随后读 `dist` 的门禁假失败），依据 = `230`/`232`/`233` 三次 `判定=OK` + 红侧 `228`。
3. 本地库内 39 表 / 15 枚举 / 4 FK 的 `information_schema` 现值：**未连库核**（需要 `.env` 的 `DATABASE_URI`，硬约束禁止读 `.env`），依据 = 日志 `86`；间接证据充分（12 组记录可读写、迁移幂等守卫 `87` 报「已存在 39 张 page_* 表」）。
4. 后台 admin 拖拽排序的实际交互（Payload admin UI 层）：无法只读验证；这正是 B-1 的修复动作要覆盖的面。
5. `review/quality-review.md`：不存在（另一路审查未产出，2A.3 未勾，状态一致）。

---

## Next（按优先级，全部最小动作）

1. **[BLOCKER] 补 B-1 的机器对面**，或在 `REQUIREMENTS.md:50` 与 4.2 明确降级该条为「部分已证」并登记 PROB。最小命令（补完后）：`pnpm --filter e2e exec playwright test tests/page-copy.spec.ts` + 台账登记该轮退出码。
2. **[HIGH] 4.1 前处理 H-1**：`verification.jsonl` 每行 `note` 内联判定行摘录与日志 sha256（或把日志落 `evidence/logs/` 入库），并在 `verify-before-complete.md` 顶部写明「190/190 指针在交付后失效」这条限制。
3. **[HIGH] 把 H-2 的两道机器对面固化进 `scripts/`**（覆盖度 + SEO 各一只零参数脚本），追加进合同行 `Tests` 与 `AI_WORKSPACE.md` 的验证入口段（一并收 W-6）。
4. **[HIGH] H-3**：自检 `LIMIT` 1500 → 1000、`design.md:12` 与 `tasks.md:75` 措辞改齐，脚本固化后重跑一次并入账。
5. **[HIGH] H-4**：落 `evidence/verify-before-complete.md`（或改指针到实际存在的 5 份 evidence），并推进 2A.3 的 `$ws-quality-review`；完成后 `aiws change validate astro-page-copy-cms --strict --check-evidence` 应从 exit=2 转 0。
6. **[WARNING] 同步上游工件的实物路径与数字口径**（W-1/W-2/W-3/W-4/W-5）：`proposal.md:53`、plan:73–74 的脚本路径；`proposal.md:40` 那句「1933 … 587/524/550/276」改为单一口径并注明；`tasks.md:32/44` 的行数。
7. **[WARNING] W-7**：在 REQ-0003 行 `Notes` 补 PROB-024（`Contract_Row` 点名的那道）与 PROB-025 的互引。
8. **[WARNING] W-8**：修 `CHANGELOG.md` 表体（删第 15 行空行、给 19–23 行补齐 6 列、转义字面竖线）。
9. **[WARNING] W-9**：台账补登记规划轮 `01`–`10`（或在 3.10 明确「台账起点=20，1–19 不入账」这条口径），并把 3.10 的「双向覆盖」措辞改为「appender↔ledger 两向」，避免被读成「tasks 每条都被台账核过」。
10. **[交付轮必做]** `tasks.md:84`（4.1）与 `tasks.md:104` 遗留项：`tasks/tasks.jsonl` 26 条全 `pending`（`status` 分布实测 `{"pending":26}`），与 `tasks.md` 构成第二份账 ⇒ 按 AGENTS.md §4 禁双写，交付时推进它或删除它（`tasks.md:1` 已声明它不作完成判定，但账还在）。

---

## 转交实现质量审查

以上均为流程/归因/证据/门禁完整性结论；本轮在核查中顺带看到的实现质量与回归面（端点 `limit:1` 取第一条对唯一性钩子的依赖、`payload.ts` 三条失败分支与 `connectFailure` 的错误文本工程性、e2e `tsc` 在 `apps/e2e` 下的 `TS2580`（PROB-014）、抽取器/包装器无编译期契约（`evidence/delivery-build-gates-p8.md` §8 第 3 条）、`FeatureGrid`/`PageHero` 类型收敛后的可维护性）**不在本报告展开，转交 `$ws-quality-review`**。

---

## 主 agent 处置（triage）

处置轮次 = P11（2026-09-21）。日志编号指 `evidence/verification.jsonl` 的 `artifact`（同一轮日志的判定行摘录亦在该台账行的 `note` 里）。
逐条处置结论：**15 条全部落地或如实登记，无一条以「知道了」代替动作**；其中 1 条（H-4）按性质留给交付轮 4.1，不假装本轮完成。

| # | 发现（审查者提出 → 主 session 核实） | 处置 | 证据 |
| --- | --- | --- | --- |
| B-1 | 验收 2「首页 hero/CTA 可增删排序」无常驻机器对面：唯一常驻 DOM 门禁 `astro-copy-hero-diff.mjs` 判「与导入前基线逐字节一致」，合法改稿必然使它红 ⇒ 看不见「改序之后渲染跟不跟着变」 | **接受并已修**：`apps/e2e/tests/page-copy.spec.ts` 新增第 7 组常驻用例——后台一次写入「追加一行 + 删一行 + 全部倒序」→ 公开站首页 `h1.hero-title > span.line` 与 `.cta-rows .cta-row h3` **逐位**等于后台数组序，被删行在 `body` 中消失，`finally` 无条件复原并复断。不改动 `hero-diff` 的守卫语义（迁移期守卫与常驻行为对面各司其职，边界已写进 `Tests` 与 3.12） | `282`（修前只有 9 个用例的缺口实照）、`283`（锁定被测记录）、`284`/`285`（10 passed + 连跑不自污染）、`289`/`290`（红侧：临时让渲染端按非后台序输出必红，回滚后复绿）、`292`/`293`（结案两跑）、`294`–`296`（改稿周期后 parity / 文本 / hero DOM 三面仍逐字一致） |
| H-1 | 台账 190 行的 `artifact` 100% 指向 gitignored 的 `.aiws/tmp/…` ⇒ 换一台 clone 全部失效，而台账恰是本 change 唯一被设计成「机器可复核」的载体 | **接受并已修**：新增只读零参数门禁 `scripts/astro-copy-evidence-archive.mjs`——台账每条 artifact 按原文件名镜像进 `evidence/logs/`（入库），核对镜像与原件 sha256 逐字节相等、basename 不撞名、原件已清理时如实计数而不静默跳过；appender 的写行步骤同时抄送镜像。**顺带暴露一个更隐蔽的坑**：`.gitignore:18` 的 `*.log` 会让镜像件全部不被追踪 ⇒ 加例外 `!/.aiws/changes/**/evidence/logs/*.log` | `304`（190/190 且 sha 全等）、`305`（只读幂等：两次结果同、目录摘要不变）、`306`（红侧：缺镜像与 sha 不等逐条点名 + 原件已清理如实计 1）、`308`（gitignore 例外前后的 `git check-ignore` 对比）、`317`/`322`（242/242 与 247/247 两次收尾） |
| H-2 | 验收 1（一比一覆盖）与验收 6（SEO 三件套）的唯一机器对面是 tmp 里的一次性脚本，既不在 `Tests` 也不在 `AI_WORKSPACE.md` | **接受，覆盖度一半已修**：tmp 的 `63-coverage-check.mjs` 与 `268-agents9-selfcheck.mjs` 提升为持久脚本 `scripts/astro-copy-coverage.mjs` / `scripts/astro-copy-agents9.mjs`，两道入口写进 REQ-0003 `Tests` 与 `AI_WORKSPACE.md` 的 `page_copy_gates`。**SEO 的产物级一半本轮不补**：抽取器 `astro-copy-render-text.mjs:57` 在提取前删 `<head>`，要钉 SEO 必须改抽取器或新增 meta 门禁——两者都会动到刚固化且已留红侧证据的渲染链 ⇒ 如实登记为 **PROB-039（OPEN）** | `297`（固化后 `SUMMARY A\\B total=0`，`B\\A` 残差 3 条可选字段照旧列出）、`309`/`310-gate-agents9`/`310-gate-coverage`、`341`/`342`（本轮新增的文档口径门禁：`Tests` 缺任一道门禁即红，且红侧已用注入探针自证） |
| H-3 | 同一份 §4 的 1000 行硬限额在自检脚本里实现成 1500，`design.md:12` 写「≤1000–1500」、`tasks.md:75` 写「≤1500」⇒ 三个口径 | **接受并已修**：`LIMIT` 收到 1000，`design.md:12` 与 `tasks.md:75` 改齐为「≤1000（§4 原文）」，并注明行数口径为「`wc -l` +（末行无换行则 +1）」（同时收 W-3）。**过程里最有价值的一次红**：收紧后门禁立刻红，红的不是自研代码而是新生成的迁移产物 `.json`=8098 行；回跑旧版（LIMIT=1500）同样红 ⇒ 证明与限额无关，是白名单写死了某一次迁移的文件名。修法不是再加一条白名单，而是把豁免来源改成事实源（读 `migrations/index.ts` 登记的批次名逐批核 provenance）⇒ 下次 `migrate:create` 不会再跑红门禁 | `298`（收口即红）、`299`（对照实验：旧版同红 ⇒ 排除「口径变更导致回归」的误判）、`307`（第二跑仍红 ⇒ 排除「新脚本顶破限额」的猜测）、`309`（改为从登记文件推导后绿）、`310-gate-agents9`（收尾链绿） |
| H-4 | `proposal.md:31` 与 plan:13 的 `Evidence_Path` 指向不存在的 `evidence/verify-before-complete.md` | **接受但不于本轮修**：该文件按 ws-dev/ws-review 的流程属**交付轮 4.1** 的产物（本轮才刚补完它要汇总的门禁面），提前造一份只写标题的文件等于再造一次漂移。处置：tasks 4.1 已写明它必须汇总 P-V1..P-V9 + 每条对应的 ledger 行 + 本次 triage 全部处置（§E），并纳入 4.3 的 `aiws verify-bc` 前置；台账起点=20 的口径限制也在该文件与 3.10 如实声明 | `tasks.md:84`（4.1 的判定要求）、`325`（`aiws change validate --strict` 仍绿——strict 不查此文件，`--check-evidence` 明确留给 3.8，不谎称已跑） |
| W-1 | 规划工件路径漂移：`proposal.md:53` 与 plan:74 仍引用不存在的 `scripts/import-astro-copy.mjs`；plan:73 仍写 `scripts/astro-copy-projection.mjs` | **接受并已修**：三处改为实物 `apps/cms/scripts/import-astro-copy.ts` / `apps/cms/src/lib/pageCopyProjection.ts`；并新增 A3 规则把它钉成机器对面——规划工件里出现废弃路径时，**同一行必须给出实物去处**，否则门禁红 | `340`（首跑即抓到两处历史叙述串，判据由此收敛为「入口段查存在性、规划工件查同句去处」）、`341`（修正后 `判定=OK`）、`342`（注入废弃路径 → 门禁红并点名 `tasks.md`；按字节还原 → 复绿） |
| W-2 | 数字口径同句混用：`proposal.md:40` 一句里同时出现 1933 与 1937 | **接受并已修**：同句注明两口径来源（HEAD 版 `wc -l` 四文件合计 = 1933；`git diff --numstat` 删除行数 = 1937，差 4 来自四文件末行换行），并写明「以合同行标注的 HEAD 口径 1933 为准」 | `proposal.md:40`；W-3 的口径统一（同一行内自洽） |
| W-3 | `tasks.md` 的行数断言普遍按 `split('\\n')` 计数、与 `wc -l` 差 1 且未注明口径 | **接受并已修**：口径统一为「`wc -l` +（末行无换行则 +1）」，落点在 `tasks.md:75`（3.9 单文件限额段）与 `tasks.md:32`（2.2 四页类型行数）；`payload-types.ts=2022`、`features.astro=595`、迁移 `.ts=689`/`.json=8038` 按该口径复核为真（末行无换行 ⇒ `wc -l` 少算 1） | `tasks.md:75`、`340`/`341`（`（0 实测 home 79` 这类事故残迹列入禁止串） |
| W-4 | `tasks.md:32`（2.2）的四页类型行数顺序错位（记成 39/79/30/39） | **接受并已修**：按实测改正为 home 79 / features 38 / solutions 29 / pricing 38（`wc -l`），并保留「首版顺序错位」的痕迹与原因说明而不静默覆盖。**本轮另有一次自身事故要记账**：改这一段时用 `node -e` 传含反引号的中文串，bash 把反引号当命令替换 ⇒ `wc -l` 被真的执行（空 stdin 输出 `0` 留在原地）、`\n` 变成真实换行把 2.2 整条切成两行。改用文件脚本做最小回接（不重写整段），修后行号回到 32/44 | `327`（回接：`merge 2.2: 行 32+33 → 单行 len=1144`、`2.14 修复 OK`）、`336`（复跑必红：找不到损伤标记即抛，证明不是一次性静默 no-op）、`341`（`tasks.md:32 len=1144` 且两条实测串都在） |
| W-5 | 同一份 `tasks.md` 内 `payload.ts` 行数两个值（2.14 写 110、3.9 写 127） | **接受并已修**：统一为 127，并注明「P9 为 PROB-028 补 `connectFailure()` 后由 110 增至 127」——该句的反引号残迹正是 W-4 那次 shell 事故吃掉的标识符，已一并补回 | `327`、`313`/`314`（两侧 `tsc` 0 错误，行数断言所在文件未被本轮改动破坏） |
| W-6 | `AI_WORKSPACE.md` 是测试入口真值且被 `proposal.md` 列入 In Scope，但整轮零改动：6 只新门禁与「`astro:build` 必须有 CMS 在 `:3000`」这条新前置都没进验证入口段 | **接受并已修**：验证入口段新增 `page_copy_gates` 八条（每条注明前置与判据）、`astro_build_cmd` 写明 CMS 不可达即硬失败（非零退出、零 HTML、不回退旧文案）、`server_test_cmd` 的用例清单补 `page-copy` | `341`（门禁段存在 + 列出的 8 条命令全部指向盘上真实脚本，缺任一即红）、`342`（红侧自证） |
| W-7 | 归因不对称：PROB-024/025/026/027/028 都写了 `Req_ID=REQ-0003`，反向 REQ-0003 `Notes` 只提 026/027/028 | **接受并已修**：`Notes` 追加双向互引——**PROB-024**（`Contract_Row` 点名的 `cap-tag` 配色缺陷，tasks 2.16 结案，配色类与编译后选择器由 `astro-copy-render-diff.mjs` 常驻机检）与 **PROB-025**（`apps/astro` 此前没有可运行的类型检查入口，由 2.2 结案并新增 `pnpm astro:typecheck`），并给出本轮 PROB-029..034 的落点 | `329`（合同行改写，含 skip 式幂等）、`330`（复跑三处全 skip）、`341`（`Notes` 缺 PROB-024/025 即红） |
| W-8 | `CHANGELOG.md` 表体走形：第 15 行空行把表切成两段、19–23 行只有 3 列、第 18 行内字面竖线串列 | **接受并已修**：① 删表内空行——**该空行是上个 change 遗留**（`git diff` 证本轮新增行不含它），随本轮一并修而不是留给别人；② 19–23 五条各补齐「影响范围 / 关联 issues-PR / 记录人」三列；③ 字面 `\|\|` 转义（含本轮新写那一行自身的两处）；④ 追加本轮（2A.3/P11）一条同步记录 | `331`（四步动作 + 读回核验：12 条表体的未转义竖线全为 7、表内空行 0）、`333`（复跑全 skip）、`341`（结构判据常驻） |
| W-9 | 台账审计方向不含「tasks 引用 ⊆ 台账」，且规划轮日志 `01`–`10` 从未入账 ⇒ 「双向覆盖」的措辞会被读成「tasks 每条都被台账核过」 | **接受并已修（措辞与口径，不补造 appender）**：`tasks.md` 3.10 的措辞改为「appender↔ledger 两向覆盖（不含 tasks→ledger）」并写明为什么；如实登记台账起点=20、`01`–`10` 只存在于 `evidence/plan-round/`，反向审计那 10 条 uncovered 是 P1 轮 `gen-verification-p1.mjs` 直写行的结构后果，不是丢账，也不为此再造一只 appender 凑数 | `318`/`323`（正向 `missing_total=0`，14→15 只 appender）、`319`/`326`（反向 `uncovered=10` 且两轮计数同一集合）、`tasks.md:76`（3.10 现文） |
| 交付轮必做 | `tasks/tasks.jsonl` 26 条全 `pending`，与 `tasks.md` 构成第二份账（§4 禁双写） | **接受并已删**：该文件删除，`tasks.md:1` 的引用句改齐并声明「勾选态唯一真值 = 本文件（`aiws change status/validate` 读的也是它）」。登记为 **PROB-042（DONE）** 的一部分 | `tasks.md:1`、`git status` 无该目录、`341`（口径门禁常驻） |

**triage 净结论**：无遗留 HIGH blocker。B-1/H-1/H-2（覆盖度半）/H-3/W-1..W-9/交付轮项全部修毕并有机器对面；H-4 属交付轮 4.1 产物，已把它的判定要求写进 tasks 而不是本轮造空文件；H-2 的 SEO 产物级一半与其余 8 条同类缺口登记为 **PROB-035..044（OPEN，9 条 + PROB-044 待 owner 裁决）**，交付轮 5.2 `follow-ups.md` 汇总。
