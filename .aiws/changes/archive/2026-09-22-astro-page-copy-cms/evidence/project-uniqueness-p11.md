# P11-a 证据：project 唯一性下沉到数据库 + 端点重复守卫 + 导入脚本 fail-closed

> Change: `astro-page-copy-cms` ｜ 来源：独立质量审查 HIGH-1 / B-1(导入侧)
> 时间：2026-09-21（本地容器库 `127.0.0.1:5434` / `juece_grow`，Docker 容器 `juece-grow-postgres`）
> 临时脚本与日志：`.aiws/tmp/astro-page-copy-cms/269…282`
> **范围声明：本轮所有数据库动作只发生在本地容器库；线上地址未连接、未执行。未跑 `pnpm --filter cms build`（构建门禁由主 session 收尾统一跑）。**

## 0. 修复的三条已核实缺陷

| # | 缺陷（修前事实） | 修法 |
|---|---|---|
| 1 | `pageCopyShared.ts:75-97` `uniqueProjectPerCopy` 是 `beforeChange` 钩子里的 find-then-write，非原子 ⇒ 并发 create 可绕过 | 集合级 `indexes: [{ unique: true, fields: ['project'] }]` ⇒ DB 唯一索引执行约束 |
| 2 | 迁移 `20260920_121115` 里 `page_*` 的 `project_id` 只有普通 btree 索引，全文 `CREATE UNIQUE INDEX` 命中 **0** ⇒ 库层无任何唯一性约束；`route.ts:49-56` 用 `limit: 1` 无守卫，出现两条时（Postgres 无 ORDER BY 不保证行序）静默返回任意一行 | 新迁移建 4 条唯一索引；端点改 `limit: 2` + `docs.length > 1` 即 `err('PAGE_COPY_DUPLICATE', …, 500)` |
| 3 | `import-astro-copy.ts:73-81` 对已存在记录无条件 `payload.update` 写回整份快照，头注释 `:4` 却自称「重建命令…唯一入口」⇒ 任何人按注释跑一次即抹掉后台手工改稿（AGENTS.md §7） | 更新分支 fail-closed：缺 `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1` 即抛（非零退出）；头注释改为「一次性导入 + 覆盖需显式许可」 |

## 1. 代码改动（5 个文件，行数均 ≤1000）

1. `apps/cms/src/collections/pages/pageCopyShared.ts`（104 行）
   - `:1` 类型导入加 `CompoundIndex`；
   - `:29-34` 新增**唯一一处**导出 `export const pageCopyIndexes: CompoundIndex[] = [{ unique: true, fields: ['project'] }]`，注释写明「钩子是 find-then-write、能绕；索引才是执行者」，并说明**集合无软删列 ⇒ 不加 WHERE 条件**（`deleted_at` 在既有迁移里 0 命中）。
2. 四个集合各自 `indexes: pageCopyIndexes`（字面量只有一份，AGENTS.md §4 禁双写）：
   - `PageHome.ts:26`、`PageFeatures.ts:197`、`PageSolutions.ts:25`、`PagePricing.ts:40`（444/351/143/199 行）。
3. `apps/cms/src/app/api/v2/content/pages/route.ts`（86 行）`:49-65`：页面查询 `limit: 1` → `limit: 2`，`docs.length > 1` 走统一信封 `err('PAGE_COPY_DUPLICATE', …, 500, req)`；注释两行说明「索引是执行，守卫是线上 DDL 落后于代码时的响铃」。不手写 `Response.json`，不新增响应形态。
4. `apps/cms/scripts/import-astro-copy.ts`（115 行）：
   - 头注释重写（`:1-17`）：删掉「重建命令…唯一入口」的口径，改为「一次性导入 + 覆盖需显式许可 + 单条改稿走后台」，并保留「全新库零配置可跑 = bootstrap 路径」；
   - `:39` 新增 `const ALLOW_OVERWRITE = process.env.IMPORT_ASTRO_COPY_ALLOW_OVERWRITE === '1'`；
   - `:79-86` 更新分支前置守卫：缺许可即抛，抛出点在 `payload.update` **之前**（首个已存在记录就中止，未产生任何写入）。新建分支未改动。
5. 迁移产物（工具生成，进 git）：`apps/cms/src/migrations/20260920_195201_page_copy_project_unique_index.ts`（17 行）+ 同名 `.json` 快照；`apps/cms/src/migrations/index.ts` 由工具追加登记（本轮同时把上一批 `20260920_121115_page_copy_collections` 的登记补齐，见 §2.1 说明）。

## 2. 迁移：生成 → 审计 → 单事务执行 → 复核

### 2.1 生成（`271-migrate-create.log`，`migrate_create_exit=0`）

```
pnpm --filter cms exec payload migrate:create page_copy_project_unique_index
[03:52:01] INFO: Migration created at F:\juece-grow\apps\cms\src\migrations/20260920_195201_page_copy_project_unique_index.ts
```

`migrate:create` 只改了 `migrations/index.ts` 与新迁移两份文件；`payload-types.ts` 未被触碰（mtime 实测仍为 `Sep 20 19:43`，索引不进类型）。
附带发现（如实登记，未擅自处理）：`index.ts` 的 diff 显示**上一批的 `20260920_121115_page_copy_collections` 此前并未登记进 `migrations` 数组**（该登记只存在于工作树，本轮 `migrate:create` 把它和新行一起写了出来）。不影响本地（DDL 是手工通道执行的），但线上 `payload migrate` 的批次顺序依赖这份数组 ⇒ 归主 session 收尾确认。

### 2.2 通读 up()：只有 CREATE UNIQUE INDEX，零破坏性语句

新迁移 `up()` 全文 4 条语句（`269-apply-project-unique-index.mjs` 逐条正则断言形状后才执行）：

```sql
CREATE UNIQUE INDEX "project_idx"     ON "page_home"      USING btree ("project_id");
CREATE UNIQUE INDEX "project_1_idx"   ON "page_features"  USING btree ("project_id");
CREATE UNIQUE INDEX "project_2_idx"   ON "page_solutions" USING btree ("project_id");
CREATE UNIQUE INDEX "project_3_idx"   ON "page_pricing"   USING btree ("project_id");
```

`down()` 是 4 条 `DROP INDEX`（仅回滚路径会跑，本轮从未调用）。快照侧复核：`git diff --no-index` 新旧 `.json` = **61 insertions / 1 deletion**，唯一删除行是快照自身的 `"id"`（uuid），4 处新增全是 `isUnique: true` 的 `project_id` 索引 ⇒ 零列/表变更。

工具生成的索引名是 `project_idx` / `project_1_idx` … 这种**通用名**（Payload 对 compound index 的命名规则），不像既有 `page_home_project_idx` 那样带表前缀。为避免「撞名 ⇒ up 失败 / down 误删他表索引」，先做只读检查（`272-check-index-name-collision.mjs`，`collision_check_exit=0`）：

```
目标索引名 project_idx, project_1_idx, project_2_idx, project_3_idx 在 public 下已存在 0 条
以 project 开头的索引名（对照，只读）：3 条（都在 projects 表，且非同名）
```

结论：名字不撞，未改名（改名 = 手写裸 SQL 造成 schema 漂移，方案 (1) 明令禁止）。

### 2.3 执行（`269-apply-project-unique-index.log`，`apply_exit=0`）

处置口径沿用 `.aiws/changes/astro-page-copy-cms/evidence/migration-import-endpoint.md:23,26`：本地账本只有 `20260825_131753(batch=1)` 与 `dev(batch=-1)`，`payload migrate` 会自行拒绝 ⇒ **DDL 走应用层脚本，账本不写新行**。

```
up DDL 提取成功：4 条，逐条形状断言通过（全部 CREATE UNIQUE INDEX on project_id）
guard host=127.0.0.1 port=5434 db=juece_grow OK
单事务 COMMIT 成功
执行后 project_id 唯一索引 4 条（期望 4）… page_home: OK(1) / page_features: OK(1) / page_solutions: OK(1) / page_pricing: OK(1)
行数未变：page_home=3 page_features=3 page_solutions=3 page_pricing=3（期望各 3）
账本未写入新行：20260825_131753(batch=1), dev(batch=-1)
```

连接串硬门禁在 `85-inspect-db.mjs:localUri()`（`hostname=127.0.0.1 && port=5434 && pathname=/juece_grow`，任一不符即抛）；本轮只打印断言结论，未输出任何凭据值；`.env` / `.aiws/secrets/*` 未写入。

### 2.4 红侧自证（`274-red-side-duplicate-rejected.log`，`redside_exit=0`）

探针**绕过 Payload**（裸 SQL），并把 `page_home` 已有行整行复制成第二条（列清单由 `information_schema` 推出、排除 `id`）⇒ 除了 `project_id` 唯一索引之外，没有任何别的约束可能拒绝它。事务显式 `BEGIN … ROLLBACK`：

```
探针：把 page_home id=1（project_id=6）整行复制成第二条，仅新 id 由序列分配
事务已 ROLLBACK（红侧不提交）
被拒：SQLSTATE=23505 | duplicate key value violates unique constraint "project_idx" | constraint=project_idx
SQLSTATE 23505 = unique_violation ⇒ 数据库层唯一性生效
ROLLBACK 后复核：project_id 唯一索引 4 条 -> page_features:project_1_idx, page_home:project_idx, page_pricing:project_3_idx, page_solutions:project_2_idx
行数：page_home=3 page_features=3 page_solutions=3 page_pricing=3（期望各 3）
page_home max(id) 前=3 后=3（相等 ⇒ 探针没有推进可见行）
```

脚本对「被接受」和「被拒但 SQLSTATE≠23505」两种结果都抛错，所以这条日志的 `exit=0` 只在约束真的咬人时才可能拿到。

### 2.5 手工通道自身的负向（`275-apply-rerun-negative.log`，`apply_rerun_exit=1`）

```
Error: 已存在 4 条 project_id 唯一索引，拒绝重复执行：page_features/project_1_idx, page_solutions/project_2_idx, page_pricing/project_3_idx, page_home/project_idx
```

⇒ 复跑不会半截重来（与上批次 `87` 同一处置）。

## 3. 五条验证的实跑记录

| # | 命令 | 日志 | 退出码 | 关键输出 |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit -p apps/cms/tsconfig.json` | `276-tsc-after-p11a.log` | **0** | 仅 npm `devdir` 配置警告，无诊断 |
| 2 | `node scripts/astro-copy-parity.mjs` | `277-parity-after-index.log` | **0** | `合计比对 12 个 (site,page)，端点侧叶子字符串 1374` / `12/12 (site,page) 逐字一致` |
| 3 | `node .aiws/tmp/astro-page-copy-cms/274-red-side-duplicate-rejected.mjs` | `274-…log` | **0**（0 = 约束确实拒绝了插入） | `SQLSTATE=23505 … "project_idx"`，随后 ROLLBACK、行数各 3 |
| 4a | `env -u IMPORT_ASTRO_COPY_ALLOW_OVERWRITE pnpm --filter cms exec payload run scripts/import-astro-copy.ts` | `278-import-no-permission-expect-red.log` | **1**（预期红） | `Error: page-home 里 project=6（site=juece）已有一条文案记录。本脚本是一次性导入；要覆盖后台手工改动请显式设置 IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1；只改单条文案请走后台。` |
| 4b | `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1 pnpm --filter cms exec payload run scripts/import-astro-copy.ts` | `279-import-with-permission.log` | **0** | `created=0 updated=12 合计 12 条（期望 12）；读回 page-home 已发布 3 条（期望 3）`，逐条 `updated page-*/id site=*` |
| 4c | 再次 parity | `280-parity-after-import.log` | **0** | `12/12 (site,page) 逐字一致`，叶子字符串 1374 |
| 5 | `pnpm --filter e2e exec playwright test tests/page-copy.spec.ts` | `282-e2e-page-copy.log` | **0** | `Running 9 tests … 9 passed (13.8s)`；含 2 条依赖管理员凭据的用例（凭据从 `.aiws/secrets/test-accounts.json` 注入，日志只出用户名 `e2e-admin`，未出口令） |

补充只读复核（`281-page-indexes-post.log`，`inspect_post_exit=0`，跑在 4b 之后）：四张表各 1 条 `project_id` 唯一索引、`重复 (表, project_id) 组：0 组`、行数 `3/3/3/3`、账本仍 2 行。

CMS dev（`:3000`）与 Astro dev（`:4321`）全程未重启、未杀进程；改完 `route.ts` 后 `curl /api/v2/content/pages?site=juece&page=pricing` 返回 200，说明 Next dev 已热编译新守卫（守卫不误伤正常单条路径，parity/e2e 双证）。

## 4. 设计取舍（为什么两处都留）

- **索引 + 端点守卫不是双写**：索引是约束的执行者（并发 create 也挡得住），端点守卫是「线上 DDL 落后于代码」时（迁移未跑 / 未跑全）的**响铃**——那时应用层没有任何东西能挡住重复，静默返回任意一行是最坏结果（错内容比 500 难查得多）。同一 `limit: 2 + >1` 判定在导入脚本 `:75-77` 早已存在，本轮把端点对齐到同一形状，不是新发明的第二条路径。
- **`beforeChange` 钩子保留**：它在常规路径上先跑，给运营友好的中文报错（「请直接编辑现有记录」）；索引挡住的是钩子挡不住的竞态——只有真撞上并发才会把 Postgres 的 23505 冒到调用方，而该消息只含索引名 `project_idx`，不回显任何行内容（AGENTS.md §6）。

## 5. 需要主 session 拍板的两点（已按方案落地，但如实说明偏差）

1. **`envelope.ts` 里没有「错误码类型联合」**（方案 (3) 的前提不成立）。实测该文件 52 行，签名是 `err(code: string, message: string, status = 400, req?)`；全仓 `apps/cms/src` 检索 `^export (type|const) \w*(Code|ERROR)\w*` 与 `'A_B' |` 均 **0 命中**，既有码字（`INVALID_SITE` / `PAGE_COPY_NOT_FOUND` / `CONTENT_FETCH_FAILED` …）都是行内字符串字面量。故本轮沿用同一条路径：`err('PAGE_COPY_DUPLICATE', …)`。若真要收敛成联合类型，那是对全部路由调用点的重构（含 `articles`、`leads`、`reminders`），超出本轮范围，我没有擅自扩。
2. **索引名由工具生成为 `project_idx` / `project_1_idx` …**（不带表前缀，与既有 `page_home_project_idx` 风格不一致）。方案 (1) 要求声明式生成，手写名字会漂移，所以我没改；改用只读撞名检查（§2.2）证明这四个名字在 public 下未被占用。若要更好看的名字，需要 Payload 侧接受自定义索引名（该 `CompoundIndex` 类型只有 `fields` + `unique` 两个键，见 `payload/dist/collections/config/types.d.ts:731-734`），做不到 ⇒ 只能靠手写 SQL，不建议。

## 6. 未验证项与原因

- **`PAGE_COPY_DUPLICATE` 的 500 分支未做线上实测**：要触发它必须先造出两条同 `(project, status=published)` 记录，而唯一索引正是本轮建的（造重复要 DROP 索引或裸改库 = 破坏性操作，红线禁止）。它的逻辑与已实测过的 404/400 分支同构，红侧由 §2.4 的 23505 承担（那条自证证明的是「库层不会让重复存在」，即守卫的触发前提）。
- **CMS 全量构建（tasks 3.2）未跑**：明令禁止与运行中的 dev 争用 `.next`，留给主 session 收尾。
- **Astro 三站构建 / 渲染层比对未跑**：不在本轮改动面（本轮只动 CMS 集合、读端点、导入脚本）；parity 1374 叶子字符串逐字一致已覆盖「端点输出未变」。
- **并发 create 的真实压测未做**：唯一索引 + 23505 自证已覆盖其正确性来源；额外压测只会得到同一约束的拒绝，且要写探针数据（红侧要求零痕迹）。
- **线上库未连接、未执行**：本轮 DDL 只在本地容器库；发布时须先跑迁移再切 Astro 构建（口径同 `migration-import-endpoint.md` §7）。
