# Quality Review — astro-page-copy-cms

独立实现质量与回归审查。审查者不采信工件里的「已验证/全绿」叙述，全部结论以自读代码 + 实跑只读门禁为据。
审查时间：2026-09-21。仓库：`F:\juece-grow`（Windows / Git Bash）。约束：严格只读，未执行任何构建、e2e、清 dist 门禁、写库操作，未读取任何密钥值。

---

## 结论

**整体判定：实现方向与投影正确性成立，但「唯一性」与「门禁可信度」两条链缺少机器约束，属可上线但必须补 enforcement 的状态。**

- **BLOCKER：0**
- **HIGH：3**
- **WARNING：12**
- **INFO：9**

核心依据摘要（独立复跑，非引用工件）：

| 只读门禁 | 退出码 | 关键输出 |
| --- | --- | --- |
| `node scripts/astro-copy-parity.mjs` | 0 | `12/12 一致`（其内部含类型松散容忍，见 W-1） |
| `node scripts/astro-copy-render-diff.mjs` | 0 | 三站 5 页 逐字一致 |
| `node scripts/astro-copy-client-bundle.mjs` | 0 | 三站 client chunk 断言通过（谓词偏弱，见 W-6） |
| `node scripts/astro-copy-hero-diff.mjs` | 0 | 三站 hero DOM 一致 |
| `pnpm astro:typecheck` | 0 | — |
| `npx tsc --noEmit -p apps/cms/tsconfig.json` | 0 | — |
| 端点负例（匿名 GET） | — | `site=xxx` / `page=xxx` 均返 `400 INVALID_SITE` / `INVALID_PAGE`，与契约一致 |

此外我用独立比较器（**键序无关、类型严格**）重跑了 `snapshot → toSchemaShape → toReaderShape` 全 12 组：
`type_strict_cases_with_diff = 0 / 12`。即投影在数值/字符串层面也是精确还原的，这既证明投影成立，也证明 W-1 里那条容忍分支当前并无必要。

---

## Findings

### HIGH-1 「一个项目一条文案」只有应用层钩子，无数据库唯一索引，且读路径看不见重复

- **怀疑点**：唯一性约束是否可被并发绕过？绕过后线上读路径会发生什么？有没有门禁能发现？
- **代码证据链**：
  1. 钩子是 find-then-write，非原子：
     `apps/cms/src/collections/pages/pageCopyShared.ts:75-97`
     ```ts
     const found = await req.payload.find({ collection: collection.slug, where: { project: { equals: projectId } }, limit: 2, depth: 0, overrideAccess: true, req })
     if (found.docs.some((doc) => doc.id !== selfId)) { throw new Error('该项目在本页面已有一条文案记录…') }
     ```
     两次并发 `create` 都在对方 commit 前查不到 → 两条都通过。
  2. 迁移里 `project_id` 只有**普通索引**，无唯一索引，全文无 `CREATE UNIQUE INDEX`：
     `apps/cms/src/migrations/20260920_121115_page_copy_collections.ts:503`（`page_home_project_idx`）、`:538`（`page_features_project_idx`）、`:551`（`page_solutions_project_idx`）、`:563`（`page_pricing_project_idx`）；列定义 `project_id integer NOT NULL` 见 `:112/:290/:358/:421`。
  3. 读路径**看不到重复**：`apps/cms/src/app/api/v2/content/pages/route.ts:46-56`
     ```ts
     const { docs } = await payload.find({ collection: PAGE_COLLECTION[page], overrideAccess: true, where, limit: 1, depth: 0 })
     const record = docs[0]
     ```
     无 `sort`、无 `docs.length > 1` 守卫 ⇒ 出现重复后返回**任意一行的内容**（Postgres 无 ORDER BY 时行序不保证），整站该页文案可能回退到旧稿。
  4. 反差证明这是「漏一层」而非「设计选择不守卫」：**同一个查询模式在导入脚本里是带守卫的**
     `apps/cms/scripts/import-astro-copy.ts:68-71` 用 `limit: 2` 并在 `docs.length > 1` 时抛「唯一性钩子失效」。
- **触发条件**：两位编辑同时新建同一 project；或脚本/API 并发写入；或历史脏数据。
- **影响**：静默的整站文案错值（不是 500，是错内容），排查成本极高；且当前**无任何门禁**覆盖（parity 读快照、render-diff 读 dist、e2e 第 1/2 组只断言单条记录存在与跨站不等，`apps/e2e/tests/page-copy.spec.ts:82-111` 都不检查 count）。
- **最小修复建议**：
  1. 新增**追加式**迁移：对 4 个集合各建 `CREATE UNIQUE INDEX ... ON page_x (project_id) WHERE deleted_at IS NULL`（若未启用软删则直接 `(project_id)`）。
  2. 把导入脚本的 `limit: 2 / >1 → throw` 语义搬到 `route.ts:46-56`，重复时返 `500` 明确错误码而不是任取一行。

### HIGH-2 导入脚本无条件覆盖已发布记录，且自述为「重建唯一入口」，一次误跑即抹掉自助编辑

- **怀疑点**：自助编辑（本次交付的核心能力）有没有被自己的重导入工具吃掉的风险？
- **代码证据**：
  - `apps/cms/scripts/import-astro-copy.ts:73-81` 对每条快照都做 `payload.update`，把 `toSchemaShape` 结果整体写回，**没有** create-only 分支、没有 dry-run、没有覆盖前备份、没有确认开关。
  - 同文件 `:4` 的自述把它定位为常规入口：「重建命令…唯一入口，零手填参数」。工件叙述 + 无守卫 ⇒ 运营/开发把它当幂等重建命令跑一次，就覆盖所有线上手改文案。
  - 相关红线：AGENTS.md §7 数据丢失红线。
- **触发条件**：任何人按脚本头注释执行一次 `import-astro-copy`。
- **影响**：不可逆的文案丢失（Postgres 无自动回滚，Payload 版本恢复需人工且当前无证据说明已启用/验证）。
- **最小修复建议**：三选一即可：
  1. 脚本改 create-only（已存在则跳过并打印）；
  2. 保留覆盖但要求显式 `--overwrite` 环境变量/参数，缺失即退出；
  3. 既然 12 条已导入完成，直接删除脚本并把头注释改成「历史一次性脚本，勿再执行」。

### HIGH-3 三个 dist 消费门禁只检查目录存在，不检查新鲜度 ⇒ 「只重建主站就能让门禁变绿」成立

- **怀疑点**：任务书里第 5 条怀疑方向（工件一致性缺口）实测是否成立？
- **代码证据**：
  - `scripts/astro-copy-render-diff.mjs:26-30` 三站各自映射到 `dist` / `dist-erp` / `dist-yunque`，`:55` 只 `existsSync(distDir)`；
  - `scripts/astro-copy-hero-diff.mjs:43-45`、`scripts/astro-copy-client-bundle.mjs:29-31` 同样只做存在性检查。
  - 提取器 `scripts/astro-copy-render-text.mjs` 会记录 `gitRev` 与 `extractorSha256`，但 `astro-copy-render-diff.mjs` **从不比较这两个字段**——比较逻辑被写出来又没用上。
- **实测数据（当日）**：最新 `apps/astro/src` 文件 mtime `18:13:36Z`，`dist` `18:27:03Z`、`dist-erp` `18:46:17Z`、`dist-yunque` `18:46:34Z` ⇒ **当前三者都是新鲜的，这不是现存缺陷，而是缺失的前提校验**。
- **本轮已发生的确凿实例**：本次变更含属性级修改 `apps/astro/src/pages/features.astro:128`
  ```ts
  cap-tag${cap.tagTone ? ' ' + cap.tagTone : ''}
  ```
  （旧写法 `cap-tag${cap.tagTone ?? ''}` 会产出死类名 `cap-tagyb`，而 CSS 是 `.cap-tag.yb`，见同文件 `:213`）。
  这项修复的**唯一机器校验**是 `.aiws/tmp/142-check-cap-tone.mjs`，而 `git check-ignore -v` 证明该路径被忽略：`.gitignore:2:.aiws/tmp/`。也就是说一个已交付的视觉 bug 修复，其证据不可复现、不进门禁、随 tmp 清理消失。
- **触发条件**：改 `apps/astro/src/**` 后只跑 `pnpm --filter astro build`（或只跑 juece 的构建），然后跑全部门禁。
- **影响**：门禁绿灯不代表三站产物一致；`dist-erp`/`dist-yunque` 可以是任意旧版本。这是「零参数可复现」叙述的实质破口（对应任务书第 7 条怀疑方向）。
- **最小修复建议**：在 `render-diff.mjs` 开头对每个 dist 断言 `dist/.build-manifest` 或直接比较提取器记录里的 `gitRev` 与当前 `git rev-parse HEAD`，不等即 fail 并提示重建哪些站。

### WARNING

- **W-1** `scripts/astro-copy-parity.mjs:69-70` 为 `numeric` 列回成字符串预留了「类型松散」容忍；我做了类型严格重跑，12/12 零差异 ⇒ 当前无必要。AGENTS.md「不写兼容性兜底」，容忍分支应在无实例时删除，或改成显式白名单并注释指明是哪一字段。
- **W-2** 站点/页面清单在 5 处硬编码，未引用唯一事实源：`scripts/astro-copy-parity.mjs:28-29`、`scripts/astro-copy-render-diff.mjs:26-30`、`scripts/astro-copy-hero-diff.mjs`、`scripts/astro-copy-client-bundle.mjs:23`、`scripts/astro-copy-render-text.mjs:31-38`。契约已有 `SITE_IDS`/`PAGE_IDS`（`apps/cms/src/lib/pageCopyContract.ts:11-15`），且 Node 24 已允许 `.mjs` 直接 import `.ts`（门禁自身就这么用投影）。新增一页时会静默漏检。
- **W-3** `apps/astro/src/lib/payload.ts:114-119` 三条失败分支（`!body.success`、`data === undefined`、`data.copy === undefined`）在当前 `ok()`/`err()` 契约下不可达：`apps/cms/src/lib/envelope.ts:40-47` 保证 `success:true` 必为 200、失败必为非 2xx，而 `:110-112` 已先 `if (!res.ok) throw`。属 over_defensive 死代码。
- **W-4** `PANEL_KINDS` 三重声明：`apps/cms/src/lib/pageCopyProjection.ts:22`、`apps/cms/src/collections/pages/PageFeatures.ts:16/52/87/111/123`（五个 block slug）、`apps/astro/src/types/pages/features.ts:10-14`（panel 联合成员）。加一种 panel 需三处同步，编译器不会发现漏改。
- **W-5** `SITE_PROJECT_SLUG` 跨应用重复实现：`apps/cms/src/lib/pageCopyContract.ts:18-22` 与 `apps/astro/src/lib/payload.ts:124-128`。投影 R 规则不覆盖它，两表漂移无门禁。
- **W-6** `scripts/astro-copy-client-bundle.mjs:45-48` 的「CMS 地址已内联」谓词偏弱：
  ```js
  const inlined = layoutChunk !== null && !layoutChunk.includes('import.meta.env.PUBLIC_CMS_ORIGIN') && /["']https?:\/\/[^"']+/.test(layoutChunk)
  ```
  只要 chunk 里出现**任意** http 字面量即算通过；我核对当前产物，该 chunk 中 3 个 http 字面量里有 2 个来自 `cmsOrigin` 抛错文案，不是真实 origin。谓词无法区分「正确内联」与「恰好有个别的 URL」。
- **W-7** `apps/e2e/tests/page-copy.spec.ts:93-111` 第 2 组自指：期望值直接从被测端点读出再断言自身一致。缓解因素：第 1 组（`:82-90`）是独立硬编码断言（`toContain('觉策智云')` / `toContain('觉策ERP')` 且 `not.toBe`），parity 门禁独立于端点。仍建议改成读 git 内的 `evidence/snapshot-pre-import/*.json` 作期望值。
- **W-8** `apps/e2e/tests/lead.spec.ts:13`（本次未改动）硬编码了现已住在 CMS 里的 hero 文案：`/接单有人管，AI 有人配/`，该串在 `evidence/snapshot-pre-import/home.juece.json` 的 `hero.titleLines[1].text`。运营在 CMS 改这一句，lead e2e 即红，且失败信息与被测功能（留资）无关。
- **W-9** `apps/cms/src/lib/pageCopyProjection.ts:67` 的 `if (hero.titleEm !== '')` 空串分支无任何单测覆盖；该 163 行纯函数模块**零单元测试**（`apps/cms/src/lib/` 下无对应 spec）。所有保护都来自端到端 parity，失败时报错定位粒度粗。
- **W-10** e2e 的 origin 与前端/门禁的 origin 事实源不同：`apps/e2e/helpers/origins.ts:7-8` 写死 `http://127.0.0.1:3000` / `4321`，而 parity 与 `getPageCopy` 走 `apps/astro/.env` 的 `PUBLIC_CMS_ORIGIN`（`scripts/astro-copy-parity.mjs:31-41`、`apps/astro/src/lib/cmsOrigin.ts`）。换端口时 e2e 与门禁会各测一站。
- **W-11** `scripts/astro-copy-render-text.mjs:57` 在提取前删除 `<head>` ⇒ SEO title/description 的落地值不受任何产物门禁校验（本项目把 SEO 文案也搬进了 CMS，`pnpm astro:build*` 才暴露，门禁不暴露）。
- **W-12** `apps/cms/src/collections/pages/PageFeatures.ts:3` 引入了未使用的 `ICON_OPTIONS`（文件内无引用）。

### INFO

- **I-1** `apps/cms/src/lib/pageCopyProjection.ts:5-8` 的头注释声称有「覆盖度脚本」使用 `fromRecord`；实际 `fromRecord` 无跨文件消费者（仅本模块内被 `toSchemaShape` 方向对照使用），注释描述的对象不存在 ⇒ fake_comments。
- **I-2** `pageCopyShared.ts:94` 抛的是中文单语 `new Error(...)`，而同文件字段 label 全为 `{zh,en}` 双语；后台报错语言与界面语言策略不一致。
- **I-3** `PageHome.ts:132-157`（`diagram.nodes` 有 `maxRows:3` 无 `minRows`）与 `:331-342`（`cases.minis` 有 `maxRows:2` 无 `minRows`）与本文件自身「位置耦合即锁长度」的做法不一致——`:159-172` 的 `chips` 就是 `minRows:3, maxRows:3` 锁死。少给一行会让 `Astro` 侧按索引取值时出现空洞。
- **I-4** 迁移里 FK 用 `ON DELETE set null`（`:455/:470/:477/:483`）而列是 `project_id integer NOT NULL`（`:112/:290/:358/:421`）⇒ 删除 project 会被约束拒绝而非级联清理。行为安全但会给出难以理解的报错。
- **I-5** `import-astro-copy.ts:95-102` 硬编码 `期望 12` / `期望 3` 并在不符时 throw；集合数一变即需改脚本（与 W-2 同源，但这里是脚本自检，影响小）。
- **I-6** `apps/astro/src/lib/cmsOrigin.ts` 的缺参报错文案（含中文）会被打进浏览器包（正是 W-6 里那 2 个 http 字面量的来源）。功能无害，属产物噪声。
- **I-7** `scripts/astro-copy-render-diff.mjs:68-69` 对产物文件用无 try/catch 的 `readText`；目录存在但单文件缺失时抛出裸 ENOENT，退出码非 0 但信息不指向「请重建哪个站」。
- **I-8** `scripts/astro-copy-cms-unreachable.mjs:19-20` 自己记录了「本门禁会清空 `apps/astro/dist`，四条产物门禁必须先跑」的顺序前提，但没有任何机制强制——前提破了会由产物门禁大声失败（实测缺 dist 即非 0），故仅列为 INFO。
- **I-9** `scripts/astro-copy-client-bundle.mjs:16` 的用法注释要求 `cd apps/astro`，而脚本内路径全部相对脚本自身解析 ⇒ 注释与实现相反（cargo_cult 残留，会误导复现者）。

### ✓ 通过（独立核实，非引用工件）

- **投影单一实现且精确可逆**：`pageCopyProjection.ts` 是唯一投影文件，无第二份实现；我用键序无关/类型严格比较器独立复跑 12/12 组零差异；R1/R2/R3 三条规则各自有对应快照字段支撑。
- **四条只读产物门禁全绿**（退出码见结论表），且这些门禁确实读的是快照与 dist，不读端点，独立性成立。
- **端点契约负例实跑通过**：`INVALID_SITE` / `INVALID_PAGE` 各返 400，与 `route.ts:23-29` 一致。
- **`pnpm astro:typecheck` 与 cms `tsc --noEmit` 均退出 0。**
- **AGENTS.md §4 文件体积**：本次涉及文件全部 ≤1000 行（最大 `PageHome.ts` 443、迁移 689、`import-astro-copy.ts` 102）。
- **§5 命名**：三站类型/字段全 camelCase，未发现 snake_case 泄漏到 reader shape。
- **§6 API 信封**：`/api/v2/content/pages` 走统一 `ok()/err()`，未自造第三形态。
- **旧静态内容链确实被切断**：`apps/astro/src/content/` 已整体删除且无残留引用；`astro.config.mjs:4-13` 与 `site.ts:169-181` 均改为缺 `SITE_ID` 即 throw，无 `|| 'juece'` 兜底（这与 W-3 的「不可达防御」是两回事，此处防御是必要的）。
- **迁移 `up()` 无破坏性语句**：39 个 `CREATE TABLE`、15 个 `CREATE TYPE`，无 RENAME / DROP，符合「不删旧表」的过渡策略。
- **无 unnecessary_abstraction / fake 数据**：未见为未来需求预留的空壳层，未见 mock 冒充真数据。

### 未验证（明确标注，原因）

1. `SITE_NOT_FOUND` / `CONTENT_FETCH_FAILED` 两条分支——构造条件需要写库或断库，越出只读约束。
2. HIGH-1 的并发竞态本身——需并发 `create`，属写库。
3. Payload 后台拖拽排序（`_order`）在真实 UI 的行为——需登录后台。
4. e2e 全量与负例构建门禁——任务书禁止 `pnpm --filter e2e ...` 与 `astro-copy-cms-unreachable.mjs`。
5. `information_schema` 层面对唯一索引的直接确认——需 `.env` 凭据；但已通过通读迁移全文确证索引均非唯一，结论不降级。

---

## 测试缺口（Gaps）

1. **无「重复记录」防御性测试**：既无 e2e 断言每 project 恰 1 条，也无门禁比较 count。HIGH-1 完全无覆盖。
2. **无投影单元测试**：163 行纯函数、含 `titleEm === ''` 边界与 R3⁻¹ 的「恰一行 panel」前置，全靠端到端 parity 兜，失败不可定位（W-9）。
3. **产物新鲜度无校验**：提取器已产出 `gitRev`/`extractorSha256` 却无人比较（HIGH-3），等于校验数据已有、断言缺失。
4. **`<head>` / SEO meta 无产物门禁**：`render-text.mjs:57` 主动剥离（W-11）。
5. **属性级视觉修复无入库校验**：`features.astro:128` 的 `cap-tag` 类名修复只有 gitignored tmp 脚本证据（HIGH-3 附带事实）。
6. **e2e 第 2 组不携带外部真值**：期望值来自被测端点（W-7），第 1 组虽硬编码但只覆盖 2 站 1 页。
7. **多端口/多 origin 假设无一致性测试**：e2e 写死端口，门禁读 `.env`（W-10）。
8. **清单一致性无单一事实源**：新增 site/page 时 5 处硬编码需人工同步（W-2）。
9. `apps/e2e` 无 typecheck 入口（实现方在 `evidence/selfservice-and-negative-build-p9.md` §10 亦自陈），故 e2e 侧类型回归不在任何门禁内。

---

## Next

按优先级，每条给最小修复 + 对应回归命令。

1. **HIGH-1**：追加唯一索引迁移 + 端点 `limit:2 / >1 → throw`。
   回归：
   `npx tsc --noEmit -p apps/cms/tsconfig.json`、
   `node scripts/astro-copy-parity.mjs`（端点仍须 12/12 一致）、
   以及新增一条 e2e：`where project equals` 后 `expect(docs).toHaveLength(1)`。
2. **HIGH-2**：导入脚本改 create-only 或直接删除，并改掉「重建唯一入口」的头注释。
   回归：`git grep -n "重建命令" apps/cms/scripts/` 为空；`node scripts/astro-copy-parity.mjs` 仍 0。
3. **HIGH-3**：`render-diff.mjs` 断言三站 dist 的 `gitRev` 与当前 HEAD 一致，不等则指名要重建哪个站。
   回归：`node scripts/astro-copy-render-diff.mjs`（故意只重建主站后应转红）。
4. **W-1 / W-2**：删掉 parity 的类型松散分支；5 处硬编码清单改 import `pageCopyContract`。
   回归：`node scripts/astro-copy-parity.mjs` 退出码 0 且输出不含「类型松散」。
5. **W-3 / I-1 / W-12**：清死代码与未用 import（`payload.ts:114-119`、`pageCopyProjection.ts:5-8` 注释、`PageFeatures.ts:3`）。
   回归：`npx tsc --noEmit -p apps/cms/tsconfig.json` + `pnpm astro:typecheck`。
6. **W-6 / I-9**：`client-bundle.mjs` 谓词改为断言 chunk 内含 `PUBLIC_CMS_ORIGIN` 解析出的**确切字符串**，并修正 `:16` 用法注释。
   回归：`node scripts/astro-copy-client-bundle.mjs`。
7. **W-7 / W-8**：e2e 第 2 组期望值改读 `evidence/snapshot-pre-import/*.json`；`lead.spec.ts:13` 的文案断言改为正则匹配非文案锚点（如 `h1.hero-title` 存在）。
   回归：`pnpm --filter e2e test`（由实现方执行，本次未跑）。
8. **W-11**：提取器保留 `<head>` 的 title/description 为受检字段，或新增一条 meta 门禁。
   回归：`node scripts/astro-copy-render-text.mjs` 后产物含 meta 键，再跑 render-diff。

---

$ws-spec-review 转交（一句话，不展开）：`proposal.md:53` / `plan.md:74` 仍引用不存在的 `scripts/import-astro-copy.mjs`、`tasks.jsonl` 26 行全 pending 构成第二事实源、`AI_WORKSPACE.md` 验证入口未收录 6 条新门禁，连同既有 H-1/H-2 的 tmp 证据归因缺口一并处理。

---

## 主 agent 处置（triage）

处置轮次 = P11（2026-09-21）。日志编号指 `evidence/verification.jsonl` 的 `artifact`（判定行摘录亦在该台账行的 `note` 里；P11 之后新跑的日志另由 appender 抄送进 `evidence/logs/`）。
逐条处置结论：**3 条 HIGH 全部修毕并配红侧**；12 条 WARNING 里 4 条已修、6 条如实登记为 PROB-035..040/044、2 条按反证不接受；9 条 INFO 里 2 条已修、1 条登记、3 条按反证不接受、1 条待 owner 裁决、2 条保留并写明理由。**无一条以「知道了」代替动作。**

| # | 发现（审查者提出 → 主 session 核实） | 处置 | 证据 |
| --- | --- | --- | --- |
| HIGH-1 | 唯一性只有 `pageCopyShared.ts` 的 find-then-write 钩子，四张表对 `project_id` 只有普通索引；读端点 `limit: 1` 无 `sort` 无守卫 ⇒ 一旦有绕过钩子的写，整站该页可能静默发旧稿，且**没有任何门禁能看见** | **接受并已修（两层）**：① 追加式迁移 `20260920_195201_page_copy_project_unique_index` 建四条 `CREATE UNIQUE INDEX`（声明式来源 = `pageCopyShared.ts:34` 的 `pageCopyIndexes = [{ unique: true, fields: ['project'] }]`，四集合共用一份定义；集合无软删列故不加分支条件；不动旧表不删列，合 §7）；② 端点改 `limit: 2`，`docs.length > 1` 即回 `500 PAGE_COPY_DUPLICATE` 并点名站点/页/条数（注释写明它是「线上 DDL 落后于代码」时的响铃，执行者是索引）。**红侧**：绕过 Payload 直连 SQL 插第二条被 `SQLSTATE 23505` 拒；`274` 之外另证 apply 脚本复跑即抛「已存在 4 条唯一索引」不重复建。**库侧巡检**：修前只有普通索引、修后四条唯一索引在册且「重复 (表, project_id) 组 = 0」。**未采纳的一条建议**：审查者建议新增 e2e `expect(docs).toHaveLength(1)`——唯一索引落地后这条断言只能重述「现存库没变」，与 `281` 的库侧巡检重复，且构造重复本身已被索引挡住、写不出红侧，故不做而不静默忽略 | `269`（迁移生成）、`270`（修前索引清单：四条普通、零唯一）、`272`（索引名与既有命名不撞）、`274`（23505 红侧 + ROLLBACK 后行数不变）、`275`（复跑必红）、`281`（修后四条唯一索引 + 重复组 0 + 各表 3 行）、`277`（建索引后 parity 仍 12/12）、`276`（cms `tsc` 0 错误） |
| HIGH-2 | 导入脚本对已发布记录无条件 `payload.update` 整份覆盖，头注释却自称「重建命令唯一入口」⇒ 任何人照注释复跑一次就抹掉运营在后台的手工改稿（§7 数据红线） | **接受并已修（取审查者的方案 2）**：脚本改为 **fail-closed**——库里已存在记录时默认拒写并点名将被覆盖的条目，必须显式 `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1` 才允许覆盖；头注释同步改成「一次性导入脚本，不是日常重建入口；改单条文案走后台」。选 ② 而非 ①/③ 的理由：本地/新环境的 bootstrap 必须留一条零配置通路（`279` 证明缺记录时仍 create-only 可用），而 ③ 删脚本会让「快照 → 库」这条已被 parity/覆盖度依赖的重建链消失。**红侧**：不带许可变量复跑必红（非零退出）。**修后面包屑**：带许可复跑 `created=0 updated=12`，随后 parity 仍 12/12 逐字一致（证明覆盖语义没被改坏） | `278`（无许可 → exit 1，抛点在 `import-astro-copy.ts:81`）、`279`（有许可 → `created=0 updated=12 合计 12 条（期望 12）`）、`280`（复跑后 parity 12/12） |
| HIGH-3 | 三只 dist 消费门禁只做 `existsSync(dist)`，比较逻辑算好的 `gitRev`/`extractorSha256` 从不被比较 ⇒ 「只重建主站就能让三站门禁全绿」成立；且已交付的 `cap-tag` 视觉修复只有 gitignored 的 tmp 脚本 `142` 作证据 | **接受并已修，但换判据**：抽出唯一清单 + 新鲜度模块 `scripts/astro-copy-dist-dirs.mjs`，三只门禁（render-diff / hero-diff / client-bundle）全部 import 它；新鲜度判据用「`apps/astro/src` 下文件最大 mtime 必须严格早于每个 dist 内文件最大 mtime」，不采纳 `gitRev` 比对——**本 change 全程未提交，基线与本轮 HEAD 是同一个 commit**，比 `gitRev` 分辨不出任何陈旧产物（审查者自己给的实测数据也说明这点：src `18:13` 早于三站 dist，靠的是时间而非 commit）。不新鲜即**点名要重建哪个站的构建入口**（`pnpm astro:build:erp` 这类命令直接打给用户）。另把 `142` 的 `cap-tag` 判定搬进常驻 `astro-copy-render-diff.mjs`（`yb=1`、无 tone `=4`、缺陷串 `cap-tagyb=0`、编译后 CSS 选择器命中），gitignored tmp 证据就此不再是唯一对面。**红侧**：故意让 erp 产物停在源码同一 mtime、删掉 yunque 产物 → 门禁 exit 1 且两条 problems 各自点名 | `300`（三站新鲜 + 三站 cap-tag 断言全过）、`301`/`302`（hero-diff / client-bundle 走同一份清单与断言）、`303`（负向探针：problems=2、点名两个构建入口、新鲜站不误报、gate_exit=1）、`281`（清单来源与命名核对） |
| W-1 | parity 为 `numeric` 列回成字符串预留「类型松散」容忍；审查者的类型严格复跑 12/12 零差异 ⇒ 分支无必要（§4 禁兼容写法） | **接受并已修**：删掉转字符串的容忍，比较器只留 `a === b`，不等即报 `值不等（含类型不同）`。**并补一条审查者没要求、但 PROB-027 要求的红侧**：光看绿灯证不了「更严的判据有咬合力」，故新增探针把 git 内快照的某个数值叶子改成同值字符串（期望侧 `'84'` vs 端点侧 `84`），要求 parity 必须红且失败行两侧显示值相同，再按字节还原（sha256 前后相等）并复跑回绿——旧实现这一处会放水成绿 | `343`（`caps[1].panel.rows[0].w` 注入 → exit 1、同值异类型失败行=有、受影响仅 `juece/features`、还原 sha `554b27e87f2ffa22` 相同、复跑 12/12 绿）、`277`/`280`/`291`/`294`/`312`（删分支后各轮仍 12/12） |
| W-2 | 站点/页面清单在 5 处硬编码，未引用 `pageCopyContract` 的 `SITE_IDS`/`PAGE_IDS` | **部分已修，残余如实登记**：三只 dist 门禁的三站清单已收进 `astro-copy-dist-dirs.mjs` 一份（HIGH-3 的同一次动作，即审查者指出的 5 处里的 3 处），且该模块对不存在的构建入口直接抛（`根 package.json 无 scripts.astro:build:erp` 即红）。残余 = parity 的 `SITES`/`PAGES` 与 render-text 的页清单，登记为 **PROB-035（OPEN）**，并写明为什么不在本轮改：改这批清单会让刚固化且已留红侧证据的门禁（274/275/289/298/299/303/306）全部需要重跑，属交付门禁链之前的范围外机械收口 | `300`–`303`（共用清单生效）、`343`（parity 未受清单改动波及）、PROB-035 的 `Notes`（含开工第一步与回归判据） |
| W-3 | `payload.ts:114-119` 三条失败分支在 `ok()/err()` 契约下不可达，属 over_defensive 死代码 | **不接受（这是边界校验，不是兜底）**：三条分支全部 **抛错、不返回旧数据**，与 §4 禁止的「fallback 到第二来源」不同类；其前提「响应体一定来自跑着 `envelope.ts` 的那个进程」在 HTTP 边界上不成立——`res.json()` 之前只有 `res.ok`，200 配非信封体（反代/缓存/未来的同源服务）在类型断言 `as { success; data? }` 下会被静默接受，删掉守卫后 `body.data.copy as T` 会返回 `undefined`，故障表现为模板深处 `TypeError: Cannot read properties of undefined`，**没有 URL、没有站点/页名**，正是 tasks 3.6 要求消灭的那类不可读错误。P9 的 `connectFailure()`（PROB-028）就是为这类不可读错误而存在的，同一条理由同样适用 | `327`/`tasks.md:44`（2.14 记录的 `payload.ts=127` 行、三条抛错分支逐个取体的自检）、`341`（agents9 的「无兜底」断言：全 `apps/astro` 里 `` `\|\| 'juece'` `` 命中 0，与本判据不冲突） |
| W-4 | `PANEL_KINDS` 三重声明（投影、`PageFeatures` 五个 block slug、Astro 类型联合），加一种 panel 需三处同步且编译器不发现漏改 | **接受，登记为 PROB-036（OPEN）**：判断成立但本轮不动——跨 app 去重要么引入共享包要么上 codegen（Astro 侧不能 import Payload 服务端代码，`payload.ts` 那份是刻意隔离），属架构决定，按门禁纪律应另立 change 评估。已把「最小中间态」写进台账：先加一只零参数断言脚本核三份声明的**键集相等**并并入 `astro-copy-agents9.mjs` 自检项，不改架构也能让漂移立刻变红 | PROB-036 `Notes`（含最小可接受中间态）；`341`（agents9 现为常驻入口，具备承接该断言的位置） |
| W-5 | `SITE_PROJECT_SLUG` 在 CMS 合同表与 Astro `payload.ts` 各写一份，投影 R 规则不覆盖它，两表漂移无门禁 | **接受，与 W-4 合并登记为 PROB-036（OPEN）**：同因（跨 app 无共享事实源）同修。补充反证以免夸大风险：两份表当前逐键相同（`juece→juece-grow`、`erp→juece-erp`、`yunque→yunque`），且 Astro 那份的取值只用于留资归属写入、不参与文案投影，故 parity/render-diff 的绿不依赖它 | `pageCopyContract.ts:18-22` 与 `payload.ts:124-128` 对读；PROB-036 |
| W-6 | `client-bundle.mjs:45-48` 的「CMS 地址已内联」谓词只要求 chunk 里出现任意 http 字面量；实测该 chunk 三个 http 字面量里两个来自抛错文案 ⇒ 无法区分「正确内联」与「恰好有个别的 URL」 | **接受，登记为 PROB-037（OPEN）**：审查者对现状的定性我复述为一句更狠的话——**当前三站判 TRUE 是巧合为真，不是判据正确**，所以留着它比改坏它风险更高，改法必须是「从 `apps/astro/.env` 读 `PUBLIC_CMS_ORIGIN` 的确切值并断言该字符串逐字出现」并配红侧（临时把内联值改成别的 URL，门禁须点名该站）。本轮只做了同一脚本的两处无损收口：清单去重（PROB-031）与要求 `cd apps/astro` 的反向用法注释（I-9） | `302`（清单共用后仍绿）、`343`（同轮 parity 未受影响）、PROB-037 `Notes`（含一行成本的修法与红侧口径） |
| W-7 | e2e 第 2 组期望值直接从被测端点读出再断言自身一致（自指）；缓解因素已自陈 | **接受问题、不接受修法，登记为 PROB-044（OPEN，需 owner 裁决）**：审查者建议「期望值改读 `evidence/snapshot-pre-import/*.json`」与它自己的 W-8 互斥——快照就是导入前的话术，把它写进 e2e 等于把话术重新变成真值，运营合法改稿即红，正是 W-8 要消灭的耦合。现状的真值分工是：**话术层锚在门禁**（parity 拿端点输出与 git 内 12 份快照逐字比），**结构与顺序锚在 e2e**（第 1 组两两不等 + 第 6、7 组的改稿/增删换序不变量）。真正的残余风险只剩「端点与渲染同时读到同一份错数据」，这一层是否要在 e2e 再造非话术锚，请 owner 拍板而不是实现者默认 | `312`（parity 作为话术锚仍 12/12）、`311`（22 passed 含第 7 组）、PROB-044 `Notes`（含两个取向与出路） |
| W-8 | `lead.spec.ts:13` 硬编码了现已住在 CMS 里的 hero 话术 ⇒ 运营改这一句会让「留资」用例红且失败信息与被测功能无关 | **接受并已修（连同 `page-copy.spec.ts` 用例 1 同类问题一起）**：`lead.spec.ts` 改为只锚结构判据（`h1.hero-title` 可见 + `span.line` 非空 + 表单可开），注释写明「本用例主体是留资表单不是文案」；第 1 组改为「两两不等 + 两侧非空」的不变量，不再写死品牌话术。结案登记为 **PROB-034（DONE）** | `311`（改后 e2e 22 passed，含 lead 与 page-copy 全套）、`312`（同轮 parity 仍 12/12 ⇒ 话术锚没丢） |
| W-9 | `pageCopyProjection.ts` 163 行纯函数零单元测试，`hero.titleEm !== ''` 空串分支无覆盖，失败定位粒度粗 | **接受，登记为 PROB-038（OPEN）**：并把它升格为「实质缺口」而非 nice-to-have——投影是双向的（`toSchemaShape` 写库 / `toReaderShape` 出端点），两侧互逆性目前只由「端点输出 vs 导入前快照」间接证明，**合法改稿之后这条证明就永久失效**（与 PROB-041 同源）。最小做法已写进台账（用 12 份快照作输入断言 round-trip 深比相等 + 两条分支各一例），但引入测试运行器属依赖变更（AGENTS.md 红线对照），开工前先定 vitest 还是 `node --test` | `343`（本轮唯一新增的类型分支对面，覆盖 parity 比较器而非投影）、`312`/`294`（间接证明面仍在）、PROB-038 `Notes` |
| W-10 | e2e 的 origin 写死在 `origins.ts:7-8`，门禁读 `apps/astro/.env` 的 `PUBLIC_CMS_ORIGIN` ⇒ 换端口时两套各测一站 | **接受，登记为 PROB-040（OPEN）**：本轮不改的真实约束是 `origins.ts` 同时被 leads 系列用例共用（PROB-005/006 的主战场），改取值源会波及另一条需求线。修法与前置真值同步（`AI_WORKSPACE.md` 的 e2e 前置须写明「CMS 端口以 `.env` 的 `PUBLIC_CMS_ORIGIN` 为准」）已写进台账。**当前不成立为缺陷**：本轮全部实测（CMS `:3000`、Astro `:4321`）两侧同源同值，`311`/`312` 是同一次跑批 | PROB-040 `Notes`；`313`/`314`（两侧类型检查同轮绿，无端口漂移迹象） |
| W-11 | `render-text.mjs:57` 提取前删 `<head>` ⇒ SEO `title`/`description` 的**落地值**不受任何产物门禁校验（本项目把 SEO 文案也搬进了 CMS） | **接受，登记为 PROB-039（OPEN），并承认审查者赢了一层**：spec-review H-2 要求的「SEO 有零参数机器对面」本轮以 `astro-copy-agents9.mjs`（源码级：`<title>`/`meta`/`canonical` 三件套存在 + 四页 `title={c.meta.title}` 4/4 取自 CMS）与 `astro-copy-coverage.mjs`（字段级）满足了**字面**要求，但 W-11 指出满足的是**错的那一层**——文案入 CMS 后回归只会出现在 dist 的 `head` 里，源码级门禁看不见。不在本轮补的原因不是拖延：改抽取器输出结构必然改 P1 冻结基线 `evidence/snapshot-pre-import/render/*.json`，基线一变 render-diff 的历史判定不可比，属「基线退役」议题，与 PROB-041 同批处理才省事（修法与红侧口径已写全：手改某份 dist 的 `<title>` 必须点名站点与页） | `297`（覆盖度门禁固化后 `A\B total=0`）、`309`/`310-gate-agents9`（源码级三件套对面）、`341`/`342`（门禁入口缺项即红的常驻自检） |
| W-12 | `PageFeatures.ts:3` 引入未使用的 `ICON_OPTIONS` | **接受并已修**：删该 import；文件内 `ICON_OPTIONS` 引用现为 0，图标词表仍由 `pageCopyShared.ts` 单一来源提供 | `313`（CMS `tsc --noEmit` 0 错误）、`314`（`pnpm astro:typecheck` 0 错误） |
| I-1 | 投影头注释声称「覆盖度脚本用 `fromRecord`」，实际无跨文件消费者 ⇒ fake_comments | **接受并已修**：头注释改成如实列出三个真实消费者（导入脚本 / 读端点 / parity 与 coverage 的期望侧），`fromRecord` 因无跨模块消费者取消 `export`。修完这一处也让 W-9 的缺口在「文档层」不再被夸大 | `313`（去 export 后 CMS `tsc` 仍 0 错误 ⇒ 确无外部引用）、`pageCopyProjection.ts:1-12` 现文 |
| I-2 | 钩子抛中文单语 `new Error`，而同文件字段 label 全 `{zh,en}` ⇒ 报错语言与界面语言策略不一致 | **不接受**：label 的 `{zh,en}` 是后台界面的**显示载体**，抛错文本是诊断信息，两者不是同一件事的两种写法；给 `Error` 造双语等于新增第二套文案载体（§4 禁双写），而 Payload 的 `Error` 展示面本来就不做本地化。真正的一致性问题在别处且已处理：错误文案必须**可诊断**（点出集合/项目/该如何收敛到一条），这条已满足 | `pageCopyShared.ts:78-97` 现文（抛错句自带「该项目在本页面已有一条文案记录」与处置指引） |
| I-3 | `diagram.nodes`（`maxRows:3` 无 `minRows`）与 `cases.minis`（`maxRows:2` 无 `minRows`）与本文件「位置耦合即锁长度」的做法不一致，少给一行会让 Astro 按索引取值出现空洞 | **不接受（反证在模板里）**：`index.astro:126` 与 `:264` 都是 `.map((node, i) => …)`，`i` 只用于**算布局参数**（`const y = 92 + i * 112`、`['A','B'][i]`），不存在 `nodes[2]` 这类定值取用 ⇒ 少一行得到的是「紧凑排版」而不是空洞或 `undefined`。全文件真正按位置定值取用的只有 `chips[0]`/`chips[1]`/`chips[2]`（`:148-150`），而 `chips` 恰好就是 `minRows:3, maxRows:3` 锁死的那一组 ⇒ 规则「位置耦合即锁长度」被完整遵守，两处 `maxRows`-only 是刻意的可变长设计（图节点数与案例数本就允许站点各取 1–3 / 1–2） | `apps/astro/src/pages/index.astro:126,148-150,264` 与 `PageHome.ts:137,164-165,335` 对读；`297`（覆盖度门禁证明字段一比一在册，锁与不锁都影响产物） |
| I-4 | 迁移里 FK 建成 `ON DELETE set null` 而列是 `project_id NOT NULL` ⇒ 删 project 会被约束拒绝而非级联清理，行为安全但报错难懂 | **接受，登记为 PROB-043（OPEN）**：定性照搬审查者——「行为安全但报错误导」，故不属红线；但改列可空或改 FK 语义都是数据语义变更，且四张表已有数据，须按 §7 走「新增 → 回填 → 独立发布期删旧」的扩展迁移，不该塞进清理批次。开工前要先定取向（禁止删除并给可读报错 / 级联删文案），取向未定就动手属于替 owner 做产品决定 | PROB-043 `Notes`（含两取向与最小改法） |
| I-5 | 导入脚本硬编码「期望 12 / 期望 3」并在不符时抛 ⇒ 集合数一变即需改脚本（与 W-2 同源，脚本自检，影响小） | **接受，随 W-2 登记为 PROB-035（OPEN）**，并写明期望条数的正确推导已在台账里：`PAGE_IDS.length * SITE_IDS.length` 与 `SITE_IDS.length`，而不是复制常量 12/3 | `279`（`合计 12 条（期望 12）` 现由常量得出，非静默）、PROB-035 `Notes` |
| I-6 | `cmsOrigin.ts` 的中文报错文案（含 URL）会被打进浏览器包，正是 W-6 那两个假命中的来源 ⇒ 产物噪声 | **接受定性、保留现状，并入 PROB-037 一起决定**：审查者自己列为 INFO 且判「功能无害」，而它唯一可机检的后果（谓词假命中）已由 PROB-037 承接；若为消噪声去把报错文案拆成「客户端可读的短串 + 服务端完整串」，那才是新增一套载体。台账里已把这条并列成 PROB-037 的顺带决定项 | PROB-037 `Notes`（「顺带决定：报错文案要不要留在客户端包」）、`302`（该 chunk 现状被门禁如实记录） |
| I-7 | `render-diff.mjs:68-69` 对产物文件用无 `try/catch` 的 `readText`，目录在但单文件缺时抛裸 ENOENT，信息不指向「重建哪个站」 | **接受并已被 HIGH-3 顺带压住大半**：门禁现在先跑 `checkDistFreshness`，缺产物/陈旧都会点名构建入口；剩余的「目录齐但单文件缺」只在人为删文件时出现，裸 ENOENT 自带完整路径已可定位，加包装属于给不会发生的场景造防御（与 W-3 同理，但这里剩余面很小，所以只做「不额外处理」而不改代码）。**不为此单开 PROB**，如实记在这里 | `303`（缺产物分支已点名 `astro:build:yunque`）、`300`（新鲜度断言在读产物之前） |
| I-8 | `cms-unreachable.mjs:19-20` 自陈「本门禁会清空 `apps/astro/dist`，四条产物门禁必须先跑」的顺序前提无任何机制强制 | **接受并保留，已把顺序钉进入口真值**：`AI_WORKSPACE.md` 新增的 `page_copy_gates` 段按**可照抄的先后顺序**列全八条并逐条标注前置（哪些须先构建、哪条会清 dist），使「跑错顺序」需要主动打乱清单而非无意踩中；而前提破了也不是静默破——缺 dist 时产物门禁直接非零并点名重建入口（`303` 实证）。审查者自评「仅列为 INFO」与此判断一致 | `AI_WORKSPACE.md` 的 `page_copy_gates` 段；`341`（门禁清单与盘上脚本一一对应的自检）、`303`（缺产物即红且给命令） |
| I-9 | `client-bundle.mjs:16` 的用法注释要求 `cd apps/astro`，而脚本内路径全相对脚本自身解析 ⇒ 注释与实现相反（cargo_cult 残留，误导复现者） | **接受并已修**：用法行改为 `node scripts/astro-copy-client-bundle.mjs`（零手填参数、与 cwd 无关、须先跑过三站构建），并顺手把三站清单的去向指向共用模块 | `302`（改注释同轮该门禁仍绿）、`341`（`page_copy_gates` 里该命令逐字存在于合同行与入口段，缺即红） |

### 测试缺口逐条对账（Gaps 1–9）

1. 重复记录防御：**已补**——四条唯一索引 + 端点 `PAGE_COPY_DUPLICATE` 守卫 + 直连 SQL 红侧（`274`）+ 库侧「重复组=0」巡检（`281`）；e2e 层的 `toHaveLength(1)` 按 HIGH-1 行的理由不做并写明理由。
2. 投影单元测试：**未补**，PROB-038（OPEN），并已把它从「测试愿望」升格为「改稿后无法再证明互逆性」的实质缺口。
3. 产物新鲜度：**已补**（`astro-copy-dist-dirs.mjs` + 红侧 `303`）；同时如实否掉审查者给的 `gitRev` 判据（未提交 ⇒ 同 commit 分辨不出）。
4. `<head>`/SEO meta 产物门禁：**未补**，PROB-039（OPEN），根因是「改抽取器就要改 P1 冻结基线」，与 PROB-041 同批。
5. 属性级视觉修复无入库校验：**已补**——`cap-tag` 配色判定从 gitignored 的 `142` 搬进常驻 `astro-copy-render-diff.mjs`（`300` 三站断言行）。
6. e2e 外部真值：部分——话术真值锚在 parity 门禁（`312`）而非 e2e；e2e 侧非话术不变量待 owner 裁决（PROB-044）。
7. 多 origin 一致性：**未补**，PROB-040（OPEN）。
8. 清单单一事实源：三只 dist 门禁已合一（PROB-031 DONE），残余 parity/render-text 登记 PROB-035（OPEN）。
9. `apps/e2e` 无 typecheck 入口：**本轮不修**，属 PROB-014（`apps/e2e` 下 `tsc` 的 `TS2580` 与入口缺失）既有在册项，spec-review 的同名转交也归它，不重复开账。

**triage 净结论**：三条 HIGH 全部修毕且各有非零退出码的红侧，**无遗留 HIGH blocker**。六条 WARNING + 两条 INFO 的同类缺口合并登记为 **PROB-035..040、PROB-043、PROB-044（OPEN）**，交付轮 5.2 `evidence/follow-ups.md` 汇总；其中 **PROB-044 需要 owner 拍板**（e2e 是否只测结构与顺序、话术真值只锚在门禁层），我不替它默认。三条（W-3 / I-2 / I-3）按反证不接受并给出文件行号级依据，一条（I-7）以「不为此单开台账」如实收口而不是静默忽略。
