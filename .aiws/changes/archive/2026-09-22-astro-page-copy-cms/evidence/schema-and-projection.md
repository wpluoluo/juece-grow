# 证据：类型单一真值 + 四个页面集合 schema（P2 / P3，tasks 2.2–2.9）

> Change: `astro-page-copy-cms` · 生成时间 2026-09-20 · 上游快照见 `snapshot-pre-import.md`（P1）
>
> 本文件回答三件事：**磁盘上现在到底有什么**、**五处「一比一镜像 vs 通用字段」的重叠是怎么定案的**（design D8）、**用什么命令可复现地证明它没跑偏**。逐条验证命令与退出码见 `verification.jsonl`（P2/P3 段 = 第 11–35 行，台账合计 35 行）。

## 1. 磁盘产物清单

### Astro 侧（P2，tasks 2.2 / 2.3）

| 文件 | 行数 | 角色 |
|---|---|---|
| `apps/astro/src/types/pages/home.ts` | 79 | `HomeContent` 类型真值（从 `content/home.ts` 抽出） |
| `apps/astro/src/types/pages/features.ts` | 39 | `FeaturesContent` + `FeaturePanel` 五路 `kind` 判别联合 |
| `apps/astro/src/types/pages/solutions.ts` | 30 | `SolutionsContent` + `SolutionIndustry` |
| `apps/astro/src/types/pages/pricing.ts` | 39 | `PricingContent` + `PricingPlan` |
| `apps/astro/src/types/icons.ts` | — | `IconKey` **全仓唯一声明**（`:6`） |
| `apps/astro/src/types/shared.ts` | — | `LabeledValue = { value, label }`（三处同形复制品的归并点） |

`content/*.ts` 四个数据文件由 1933 行降到 1771 行（home 513 / features 491 / solutions 526 / pricing 241），类型已迁出、只剩 `import type` + 数据；数据本身在 2.14 才删。三处组件结构复制品（`PageHero.astro` 的 `stats`、`PricingTable.astro` 的 `PricingPlan`、`FeatureGrid.astro` 自抄且已与真值漂移成 `desc?` 的 `FeatureItem`）全部改为 import 真值。

### CMS 侧（P3，tasks 2.4–2.7、2.9）

| 文件 | 行数 | schema 规模（`63-coverage-check.mjs` 实测，见 `73`） |
|---|---|---|
| `collections/pages/PageHome.ts` | 443 | leaf 80 / group 15 / array 9 / hasMany 3 / blocks 0 |
| `collections/pages/PageFeatures.ts` | 350 | leaf 52 / group 5 / array 8 / hasMany 5 / **blocks 字段 1，含 5 个 block** |
| `collections/pages/PageSolutions.ts` | 142 | leaf 22 / group 3 / array 4 / hasMany 2 |
| `collections/pages/PagePricing.ts` | 198 | leaf 25 / group 3 / array 4 / hasMany 1 |
| `collections/pages/pageCopyShared.ts` | 97 | 四集合共用：`ICON_OPTIONS`/`ACTION_OPTIONS`/`pageCopyAccess`/`pageCopyCommonFields()`/`uniqueProjectPerCopy` |

合计 1230 行，单文件最大 443 行，均在 AGENTS.md §4 限额内。注册在 `payload.config.ts`，分组 `{zh:'内容与站点', en:'Content & Sites'}` 与 `Articles`/`Sites` 同组；`payload generate:types` 写 `payload-types.ts`（相对 `HEAD` 净 +986 行 / −0）。

## 2. D8 五处定案与代码后果

「一比一镜像 TS 类型」（owner 裁决的方案 B）与「通用字段」在四张表上叠出了五处重叠，P3 建完才暴露。逐条裁决 → 已落地的代码后果：

| # | 定案 | 代码后果（已验证） |
|---|---|---|
| ① | 页面标题/描述的唯一载体是镜像出来的 `meta.{title,description}`，**不设** `seoTitle`/`seoDescription` | `pageCopyCommonFields()` 里整个 SEO `collapsible` 组删除；四集合 `admin.useAsTitle: 'id'`（Payload `validateUseAsTitle` 明确禁止含 `.` 的嵌套路径，`meta.title` 不能当标题列，`'id'` 是其唯一白名单）；`defaultColumns: ['project','status','updatedAt']`。删在**任何迁移文件之前** ⇒ 不存在要 DROP 的列。验收措辞同步改齐（见 §5） |
| ② | canonical 不入 CMS，保持 `Layout.astro:43` 构建期由 `Astro.url` 派生 | 零代码改动；SEO 三件套 = 后台两项 + 构建期一项 |
| ③ | 端点输出必须等于 **Astro 类型形态**而非 Payload 存储形态 | 新增唯一投影模块（§3）；`toReaderShape` 接进 2.11 端点，`toSchemaShape` 接进 2.12 导入与 2.13 比对 |
| ④ | parity/覆盖度比对必须施加**同一份**投影，映射表未覆盖的差集即缺陷，禁止「忽略字段」消音 | `63-coverage-check.mjs` 的 A 侧改成 `collectDumpPaths(toSchemaShape(page, dump), …)`，并升级为门禁：`totalMissing > 0` 即 `process.exit(1)` |
| ⑤ | 生成器把 slug 单数化（`page-features` → `PageFeature`）接受，不为此改 slug | 零改动；内部类型名不外泄到 JSON，改 slug 会连带改 URL |

## 3. 唯一投影模块 `scripts/astro-copy-projection.mjs`（109 行）

导入脚本、parity 脚本、覆盖度门禁、端点四方共用同一份规则 ⇒ 规则本身不构成第二套真值。

- `toSchemaShape(page, content)`（TS 快照形状 → schema 形状，深拷贝后逐条施加，未知 page / 非对象即抛）：
  - **R1 `foldHeroTitlePair`**（features/solutions/pricing）：先断言 `hero` 是对象、`titleLines` 不存在、`titleA`/`titleEm` 均为字符串，再折成 `titleLines = [{text: titleA, emphasis: false}]`，**仅当 `titleEm !== ''`** 才追加 `{text: titleEm, emphasis: true}`（空串不能追加，因为 `titleLines[].text` 在 schema 里 `required`）。
  - **R2 `renameHeroLineKey`**（home）：逐行断言 `em` 存在且为 boolean 且 `emphasis` 不存在，然后 `delete line.em; line.emphasis = em`。
  - **R3 `renamePanelKind`**（features）：断言 `caps` 是数组且每个 `cap.panel.kind` 属于五个合法 `kind`，然后 `cap.panel = [{ blockType: kind, ...fields }]`（Payload `blocks` 只能是数组，`minRows=maxRows=1` 锁成恰好一行）。
- `toReaderShape(page, record)`（schema 形状 → Astro 类型形态，端点侧）：仅 features 有规则——断言 `panel` 是长度为 1 的数组且 `blockType` 合法，解包成 `{ kind: blockType, ...fields }`。
- 三条规则**前提不满足即抛**，不静默跳过。所有规则都不允许出现「同时存在 `em` 与 `emphasis`」「panel 已是数组」这类半途形态。

## 4. 覆盖度门禁实测（`73-coverage-after-minrows.log`，`exit=0`）

A = 12 份快照经 `toSchemaShape` 投影后的叶子路径集，B = 四集合 schema 声明路径集（`collapsible`/`row`/`tabs` 透明，`group` 加前缀，`array`/`blocks` 加 `[]`，`hasMany` 视作标量数组）。

| 集合 | A | B | `A\B` | `B\A`（已剔除 `id`/`createdAt`/`updatedAt`/`project`/`status`） |
|---|---|---|---|---|
| `page-home` | 76 | 89 | **0** | `hero.primary.href`、`products.spotlight.link.external` |
| `page-features` | 43 | 53 | **0** | — |
| `page-solutions` | 20 | 26 | **0** | — |
| `page-pricing` | 22 | 29 | **0** | `plans[].currency` |

`SUMMARY A\B total=0`：schema 无遗漏字段。`B\A` 三条均为「TS 里声明为可选、12 份快照恰好没填」——三站主按钮全是 `action:'lead'` 故无 `href`；`external` 仅 juece 的另外两处用过；`currency` 三站九档的键集合里根本不存在。这三条是**导入后将保持为空**的合法可选项，不是缺陷。

投影接进之前 `A\B = 8` 条，全部是 R1/R2/R3 的产物（`titleA`/`titleEm`、`em`、`kind`、`panel` 路径形状）——这条从 8 → 0 的过程记录在 `63-coverage-check.log`（无门禁、只报告）与 `67-coverage-after-projection.log`（有门禁）两份日志里。

## 5. 需求真值同步（措辞级，不改范围）

D8① / D8③ 使 REQ-0003 两条验收标准原文变得不再准确，已改齐并留痕：

- `REQUIREMENTS.md` 验收第 1 条：类型真值地点写明 `apps/astro/src/types/pages/*.ts`，并允许 §3 的两处受控形变。
- 验收第 6 条：改为「SEO 三件套构建后逐页齐全：标题/描述在后台可配（即页面内容里的 `meta`，**不另设 `seoTitle`/`seoDescription` 覆写字段**）；canonical 由构建期页面 URL 派生」。
- `.aiws/requirements/requirements-issues.jsonl` REQ-0003 的 `Data_Model` 重写（类型路径 + 展示序即索引序不存 `sortOrder` + `meta` 唯一载体），`Updated_At` → `2026-09-20T19:55:00Z`，Notes 注明「仅措辞对齐，范围未变」。
- `.aiws/requirements/CHANGELOG.md` 追加 1 行（`append-changelog-req0003-wording.mjs`，`74` `exit=0`，复跑 `no-op`），明确记录「接口与 schema 均未变（`seo*` 从未进过迁移文件）」。

## 6. 验证与门禁

CMS 侧：`cd apps/cms && npx tsc --noEmit -p tsconfig.json` → `pnpm generate:types` → 再 `tsc` → `node .aiws/tmp/astro-page-copy-cms/63-coverage-check.mjs`，四步全 `exit=0`（日志 `60`/`61`/`62` → `64`/`65`/`66`/`67` → `71`/`72`/`73`）。刻意**不跑** `pnpm --filter cms build`：CMS dev 正在 `:3000` 跑（Astro 构建前置），`next build` 会争用共享 `.next`；全量构建留在 3.2。

Astro 侧：`pnpm astro:typecheck` `exit=0`（`49`）、`pnpm astro:build` `exit=0`（`50`），juece 四页可见文本 sha 与 P1 基线 **4/4 IDENTICAL / mismatches=0**（`68`）⇒ P2 的类型收敛对渲染零影响，符合「DOM 与文本逐字一致」这条非目标。`minRows` 补齐不重跑渲染基线：它只作用于写侧校验，Astro 仍在读 `content/*.ts`，直到 2.14 才切读路径。

治理门禁：§5 改了 `REQUIREMENTS.md` 措辞后先跑 `aiws validate .`，**按预期 `exit=2`** 报「truth file changed since last sync」（`76`，baseline `78709ae7…` vs 当前 `1b30538d…`）⇒ 漂移是被门禁发现的，不是被绕过的；随后 `aiws change sync astro-page-copy-cms` 由命令自己盖章（`77`，`Changed files` 只列 `REQUIREMENTS.md`，stamp 落 `.aiws/tmp/change-sync/20260920-120647Z-…json`），复跑 `aiws validate .` → `exit=0`（`78`）。全程未手改 `.ws-change.json` 里的基线值。

## 7. 过程中的偏差与负向（如实登记）

1. **规划轮的事实错误**：tasks 2.2 原文与 design D3 都写「`features.ts:10-14` 内联重复一份 `IconKey`」——按 `git show 7279d55:apps/astro/src/content/features.ts` 复核，那五行是 `FeaturePanel` 的 `kind` 判别联合，`features.ts` 从未声明 `IconKey`。已在 tasks 2.2 与 D3 就地更正。
2. **我自己写漏的约束**：`PageFeatures`/`PageSolutions` 的 `hero.stats` 只给了 `required` 没给 `minRows:1`，与 D2 表不符。由 `70-list-row-constraints.mjs`（逐字段枚举行约束）自查发现，补齐后重跑三道门禁（`71`/`72`/`73`）。
3. **开工门槛缺失**：`apps/astro` 此前没有可用的类型检查入口——仓内 TypeScript 7 拒绝原 `tsconfig.json` 的 `baseUrl`（TS5102）与相对 `paths`（TS5090），`exit=1`（`43`）。删 `baseUrl`、`paths` 改相对写法后 `exit=0`（`44`），并新增 `pnpm astro:typecheck`；缺陷登记为 **PROB-025**（`48`，台账 24→25 行，复跑 `no-op`）。
4. **不采信子代理的环境**：子代理曾用自己下载的 `typescript@5.9.2` 报「已过关」。该门禁不认——所有类型判定以仓内依赖重跑为准（`43`/`44`/`49`）。
5. **路径约定不一致（运行前发现）**：投影后的形状是 `caps[].panel[].blockType`，而覆盖度脚本的 blocks 分支原本发射 `caps[].panel.blockType`。修法是把 blocks 分支统一成 `[]` 后缀（与 `payload-types.ts` 把 blocks 字段类型化成数组一致），而不是为比对特判一条路径。

## 8. 尚未落地（不在本证据范围）

- tasks 2.8 的**后半**（`types/pages/*` 的 `hero` 改 `titleLines`、四个渲染器只留一种循环）与 2.14 的切读路径同批，否则改类型不改数据源会立刻红。
- 2.10 建表迁移、2.11 端点、2.12 导入、2.13 parity、2.15 去 `SITE_ID` 兜底、2.16 PROB-024、2.17 e2e；以及 3.x 全部门禁。**本文件不含任何数据库改动证据：截至本文件写就时，四个集合只有 schema 与生成类型，库里没有新表、没有记录。**
- ⇒ **路标**：上一条写就之后 P4 已落地（2.10–2.13 + 3.1 + 3.7 端点部分），库内现有 39 张 `page_*` 表与 12 条已发布记录；那部分证据在 `evidence/migration-import-endpoint.md`，本文件的 §3 模块路径（`scripts/astro-copy-projection.mjs`）也已在 P4 迁入 `apps/cms/src/lib/pageCopyProjection.ts`。本文件的 P2/P3 结论（覆盖度、门禁链、偏差登记）不受影响，不追改。
