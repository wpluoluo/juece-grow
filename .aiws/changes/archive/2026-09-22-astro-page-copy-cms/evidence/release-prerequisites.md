# 上线前置条件（release prerequisites）— astro-page-copy-cms

> Change: `astro-page-copy-cms` ｜ REQ-0003 ｜ 编写时间：2026-09-21
> **本文件是「上线前必须人工完成的事」清单，不是执行记录。本 change 全程只连本地容器库
> `127.0.0.1:5434`（Docker `juece-grow-postgres`），线上地址未连接、未执行任何 DDL 或写入。**
> owner 已裁决：线上迁移**不开维护窗口**（见 `.aiws/memory-bank` 与本文件 §6 的免窗口论证），
> 因此下面每一步都写成可独立择期执行、且失败即回到原状的形式。

## 0. 为什么必须有人来做这件事（不是可选）

切换后公开站**没有代码内文案副本**：`apps/astro/src/content/{home,features,solutions,pricing}.ts` 已随
读路径切换整体删除（−1937 行），四页构建期一律走
`getPageCopy()` → `GET /api/v2/content/pages?site=&page=`。同时 `site.ts` / `astro.config.mjs` 的
`|| 'juece'` 兜底已按 AGENTS.md §4 移除。⇒ **线上库里没有这 12 条记录、或 CMS 不可达时，构建会硬失败**
（这是设计要求的性质，由 `scripts/astro-copy-cms-unreachable.mjs` 钉住，不是缺陷）。

## 1. 数据库：两条迁移必须由人执行（CMS 不会自动跑）

`apps/cms/src/payload.config.ts` 里**没有** `migrations.prodMigrations` 配置 ⇒ Payload 在生产环境
**永不自动 migrate**。两条迁移文件都已在 `apps/cms/src/migrations/index.ts` 的数组里按序登记
（P11-a 顺带补上了第一批 `20260920_121115` 此前只存在于工作树的漏登记）。

| 序 | 迁移 | 内容 | 破坏性 |
|---|---|---|---|
| 1 | `20260920_121115_page_copy_collections` | 4 张表 `page_home` / `page_features` / `page_solutions` / `page_pricing` 及其 `project_id` 普通索引 | 无（纯新增，`up()` 里 `DROP`/`RENAME` 命中 0） |
| 2 | `20260920_195201_page_copy_project_unique_index` | 上述 4 表各一条 **唯一索引**：`project_idx` / `project_1_idx` / `project_2_idx` / `project_3_idx`（列 `project_id`） | 无 |

**通道 A（推荐，走 Payload 账本）**

```bash
cd /path/to/juece-grow
DATABASE_URI='postgres://juece:<强密码>@127.0.0.1:5432/juece_grow' pnpm --filter cms exec payload migrate
```

**通道 B（与本地同法：直接执行 `up()` 的 SQL）** —— 只跑第 2 条时用它，逐条对应迁移文件：

```sql
CREATE UNIQUE INDEX "project_idx"   ON "page_home"      USING btree ("project_id");
CREATE UNIQUE INDEX "project_1_idx" ON "page_features"  USING btree ("project_id");
CREATE UNIQUE INDEX "project_2_idx" ON "page_solutions" USING btree ("project_id");
CREATE UNIQUE INDEX "project_3_idx" ON "page_pricing"   USING btree ("project_id");
```

> 上面四条与迁移 `up()` 逐字同形，**故意不带 `IF NOT EXISTS`**：跑第二遍会以
> `relation "project_idx" already exists` 失败——那是「这条 DDL 已经做过」的正确信号，
> 不要把它吞成幂等成功。

> 本地经验**不可**照搬到线上：本地账本 `payload_migrations` 里有 `batch = -1` 的历史行，
> 曾让 `payload migrate` 直接拒跑（本地因此走通道 B）。线上是全新库、账本为空，通道 A 顺序正常。

**为什么第 2 条不能省**：`pageCopyShared.ts` 的 `beforeChange` 钩子是 find-then-write，非原子——
两个编辑并发新建同一 project 时两条都能过钩子；而端点用 `limit: 2` + `docs.length > 1 → 500
PAGE_COPY_DUPLICATE`，索引才是真正执行「一个项目一条文案」的东西。本地实测（`evidence/project-uniqueness-p11.md`）。

**执行后核对（只读）**

```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'page_%';                     -- 期望 4 行
SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN
  ('project_idx','project_1_idx','project_2_idx','project_3_idx');                 -- 期望 4 行，indexdef 含 UNIQUE
```

> 索引名是 Payload 对 compound index 的通用命名（不带表前缀）。执行前先只读查名冲突：
> `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN (...)` 必须 **0 行**，
> 否则说明库里已有同名索引（本地实测 0 冲突，`272-check-index-name-collision.mjs`）。

## 2. 内容：12 条记录导入（一次性，且默认拒绝覆盖）

```bash
# 仓库根，零手填参数；连的是 CMS 的 DATABASE_URI
pnpm --filter cms exec payload run scripts/import-astro-copy.ts
```

- 全新库：直接跑，期望 `created=12 updated=0`，12 条全部 `status: 'published'`。
- 库里已有记录：**脚本默认抛错不写**（fail-closed，HIGH-2 / PROB-030）——整份快照覆盖会抹掉运营在后台
  的手工改稿（AGENTS.md §7）。只有确实要回到快照时才加
  `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1`，且**必须先做 §4 的备份**。
- 改单条文案请走后台（Payload admin），不要跑脚本。

## 3. 构建：三个站各自必须给的 env

| 变量 | 必须的值 | 缺失后果 |
|---|---|---|
| `SITE_ID` | 每站显式：`juece` / `erp` / `yunque`（`pnpm astro:build` / `:erp` / `:yunque` 的 `cross-env` 已内置） | 缺失即**构建期抛错**（兜底已删）。根 `build.mjs` 与 e2e 前置都依赖它 |
| `PUBLIC_CMS_ORIGIN` | 指向线上 CMS 可达地址（`apps/astro/.env`） | 拉不到 CMS 即非零退出，且 `dist` 内零 HTML（负向门禁实测性质） |

构建命令与顺序（线上与本地同形）：

```bash
pnpm cms:build            # CMS 生产构建（含 TS 校验）
pnpm astro:build          # 主站 → apps/astro/dist
pnpm astro:build:erp      # ERP 分站 → dist-erp
pnpm astro:build:yunque   # 云雀分站 → dist-yunque
```

> Windows + Node 24 的已知环境现象：astro 页面全部生成后，进程退出阶段可能以 `3221226505`
> （libuv 断言崩溃）结束。根 `scripts/build.mjs` 只在 `dist/index.html` 与 `dist/articles` 都存在时
> 放行该码，其它非零码仍判失败。**不要把这条当作可普遍放行的退出码**——先在产物上确认页面真的生成了。

## 4. 备份（做任何 DDL / 导入动作之前）

```bash
node scripts/backup.mjs --uri 'postgres://juece:<强密码>@127.0.0.1:5432/juece_grow'
```

生产走服务器原生 `pg_dump`（`docs/08-deployment.md` §5），备份入 `backups/`（不提交）。
恢复：`psql -h 127.0.0.1 -U juece -d juece_grow < backups/<文件>.sql`。

## 5. 上线后的验收（每条都是仓库内零参数命令，可复跑）

```bash
node scripts/astro-copy-parity.mjs            # 端点 ↔ 快照投影 12/12 逐字一致
node scripts/astro-copy-coverage.mjs          # 快照叶子 ⊆ 集合 schema，A\B total=0
node scripts/astro-copy-agents9.mjs           # AGENTS.md §9 机检 12 条断言
node scripts/astro-copy-render-diff.mjs       # 三站产物可见文本 = 切换前基线（含 dist 新鲜度）
node scripts/astro-copy-hero-diff.mjs         # 12 条 hero 内部 DOM sha256 = 基线
node scripts/astro-copy-client-bundle.mjs     # 浏览器包无站点解析报错文案、CMS 地址已内联
node scripts/astro-copy-evidence-archive.mjs  # 台账证据逐条在库内可核对
```

顺序注意：`astro-copy-cms-unreachable.mjs` 会清空 `apps/astro/dist`（失败构建在开始就清 outDir），
必须放在三条读 dist 的门禁**之后**，且跑完要重建才能再读。

## 6. 免维护窗口的论证（owner 裁决「不开窗口」的依据）

1. **只加不改**：两条迁移 `up()` 合计只有 `CREATE TABLE` / `CREATE TYPE` / `CREATE UNIQUE INDEX`，
   无 `DROP` / `RENAME` / 列类型变更（quality-review 逐条通读并记 `✓ 迁移 up() 无破坏性语句`）。
   既有表（含 `leads`）零触碰——本 change 的 diff 里生产代码没有任何 lead 相关文件（`astro-copy-agents9.mjs` §7 断言）。
2. **旧链路在切换前保持可用**：只要不删 `content/*.ts` 的那次前端发布与 DDL 之间不交叉，
   顺序是「DDL → 导入 → 再发布静态站」，任一步失败都不影响线上正在服务的旧产物。
3. **唯一索引可能建失败**：若线上库里同 project 已存在两条文案（历史脏数据），`CREATE UNIQUE INDEX`
   会以冲突报错结束、库不变。此时按端点守卫查 `SELECT project_id, count(*) FROM page_home GROUP BY 1 HAVING count(*)>1`
   定位，人工裁决留哪条——**不要**用 `--check-evidence` 式的批量清理脚本。

## 7. 本轮没在线上/真实并发下验证的点（不要当成已验证）

- 唯一索引在**真实并发**下的表现：本地只证明了约束存在（quality-review HIGH-1 的并发 `create` 属写库，越出只读审查约束，未跑）。
- 端点 `SITE_NOT_FOUND` / `CONTENT_FETCH_FAILED` 两条分支：构造要改库或断库，未在门禁内覆盖，只有代码路径审阅。
- Payload 后台拖拽排序（`_order` / 行增删）在真实 UI 的行为：第 7 组 e2e 走 REST 断言，不等于 UI 操作验证。
- 线上原生 Postgres 的索引名冲突面：本地实测 0 冲突，线上未查（§1 的只读查询就是为这一步准备的）。
