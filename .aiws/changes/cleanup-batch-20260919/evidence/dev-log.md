# dev-log · cleanup-batch-20260919（Payload 侧清理实现）

分支：`change/cleanup-batch-20260919`（不切分支 / 不 commit / 不 push）
执行者：ws-dev 实现 subagent
本日志按步骤增量追加：每步记录「命令 / 实际输出关键行 / 结论」，可独立重跑。

## 步骤 0 · 前置事实核对（只读）

### 0.1 护栏确认

```
$ docker ps --filter "name=juece-grow-postgres" --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
juece-grow-postgres       Up 24 hours (healthy)   0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp
```

```
# apps/cms/.env 变量名清单（值不外泄）
$ cut -d= -f1 apps/cms/.env
DATABASE_URI
PAYLOAD_SECRET
NEXT_PUBLIC_SERVER_URL
CHATWOOT_WEBHOOK_SECRET
```

- 结论：**改动前 `.env` 实际有 4 个变量**（任务书假设 3 个；按「只追加」护栏执行，收尾应为 5 个：原 4 个 + `PUBLIC_CORS_ORIGINS`）。
- 只连本机容器映射端口 5434；未搜索/读取任何 `secrets/`、其他 `.env*`、其他仓库。

### 0.2 PROB-001 事实复核（死字段 / 死表）

```
$ grep -rn "activity" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
    --exclude-dir=.aiws --exclude-dir=.pi --exclude-dir=.opencode --exclude-dir=.agents \
    --exclude-dir=dist --exclude=*.tsbuildinfo .
apps\cms\src\collections\Leads.ts:379        name: 'activity',          ← 定义本身
apps\cms\src\payload-types.ts:202,763        activity?: ...             ← 生成物
apps\cms\src\migrations\20260830_122948.{ts,json}                       ← 基线迁移建表语句
（其余命中均为 docs/.aiws 文档叙述、scripts/deploy-*.sh 的 pg_stat_activity、.agents 技能文档）
```

- 结论：业务代码对 `Leads.activity` **零读零写**，无 `data.activity` / `activity:` 写入路径；事件实际只落 `lead-activities`（`Leads.ts` `afterChange` 钩子）。

```
$ docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc \
    "select count(*) from information_schema.tables where table_name='leads_activity'"
1
$ docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc "select count(*) from leads_activity"
0
```

- 结论：表存在但 **0 行**（drop 安全）。

```
$ docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc "select name, batch from payload_migrations order by id"
20260825_131753|1
dev|-1
```

- 结论（重要前置发现）：本地 dev 库存在 `batch = -1` 的 `dev` 记录 ⇒ 本库由 **drizzle dev-push** 动态同步而来；且磁盘上唯一的迁移 `20260830_122948` **未**记录在 `payload_migrations` 中。
  这会影响步骤 3.5「应用迁移到本地库」的可行方式（Payload `migrate` 对 dev-push 库有数据丢失确认门禁），详见步骤 3。

### 0.3 PROB-003 空目录与引用面核对

```
$ for d in apps/cms/src/components apps/cms/src/app/api/dev-seed apps/cms/src/app/api/v2/sites/clone \
      apps/cms/src/app/dashboard apps/cms/scripts src; do find "$d" -printf '%y %p\n'; done
d apps/cms/src/components
d apps/cms/src/app/api/dev-seed
d apps/cms/src/app/api/v2/sites/clone
d apps/cms/src/app/dashboard
d apps/cms/scripts
d src
```

- 结论：六个目录**全部为空**（无任何子项、无隐藏文件）。

```
$ grep -rn -E "src/components|dev-seed|sites/clone|app/dashboard|cms/scripts" <全仓，排除构建产物>
（无命中，EXIT=0 无输出）

$ grep -n "components" "apps/cms/src/app/(payload)/admin/importMap.js"
1:import { StatusCell ... } from '../../../../components/StatusCell.tsx'
17:import { Icon ... } from '../../../../components/Logo.tsx'
19:import { NavDashboardLink ... } from '../../../../components/NavDashboardLink.tsx'
20:import { JueceDashboard ... } from '../../../../components/Dashboard.tsx'

$ ls apps/cms/components/
Dashboard.tsx  DashboardCharts.tsx  Logo.tsx  NavDashboardLink.tsx  StatusCell.tsx
```

- 结论：`payload.config.ts` / `Leads.ts` 声明的 `./components/*.tsx` 经 importMap 解析到 **`apps/cms/components/`**（有内容，不删）；`apps/cms/src/components` 等六目录零引用，可删。

```
$ grep -rn "leadActivity" apps/cms/src
apps\cms\src\collections\Leads.ts:64:      // 线索动态：在唯一写入路径记录关键事件（创建/状态流转/分配/跟进写注），见 lib/leadActivity。
$ ls apps/cms/src/lib/
envelope.ts  i18n.tsx  leadSources.ts  leadStats.ts  reminderCron.ts
```

- 结论：`src/lib/leadActivity` **不存在**，`Leads.ts:64` 注释为失效注释（唯一命中）。

### 0.4 迁移/类型工具链基线（关键安全探针）

```
$ pnpm --filter cms exec payload generate:types
[17:27:31] INFO: Compiling TS types for Collections and Globals...
$ git diff --stat apps/cms/src/payload-types.ts
（空）
```

- 结论：`payload generate:types` 调用形式可用；**当前 config schema 与生成物完全一致**，说明「磁盘 drizzle 快照 == config schema」，预测后续 `migrate:create` 的差异只可能来自我这次删字段。
- 读 `@payloadcms/drizzle` 源码确认语义：
  - `buildCreateMigration.js`：`migrate:create` 用**磁盘上最新的 `.json` 快照**与新 schema 做 diff（不读库），并 `payload/bin/migrate.js` 置 `disableDBConnect: true` + `PAYLOAD_MIGRATING=true` ⇒ 生成迁移不碰库。
  - `db-postgres/dist/connect.js:110`：`NODE_ENV !== 'production' && PAYLOAD_MIGRATING !== 'true' && push !== false` ⇒ 本地起 dev 会走 drizzle `pushSchema`（会自动同步表结构，删表会触发数据丢失交互确认）。
  - `drizzle/dist/migrate.js:30`：若 `payload_migrations` 存在 `batch = -1` 记录，`payload migrate` 会弹「data loss will occur，是否继续」确认，非交互下 `process.exit(0)` ⇒ 见步骤 3.5 的实际处置。

## 步骤 1 · CORS 配置先行（PROB-002 前半）— 已完成

在删默认值**之前**，把 `PUBLIC_CORS_ORIGINS` 补齐到全部声明处。值统一为
`https://juece.cloud,https://erp.juece.cloud,https://yunque.juece.cloud,http://localhost:4321,http://127.0.0.1:4321`。

### 1.1 `apps/cms/.env.example`（改）

追加中文注释「逗号分隔的 origin 列表，缺失即启动失败，无内置默认。」+ 该变量。

### 1.2 `apps/cms/.env`（只追加，gitignored）

原文件末尾无换行符（`tail -c 1` → `0`），故追加串以 `\n` 起始，避免与 `CHATWOOT_WEBHOOK_SECRET` 行粘连。

```
$ printf '...\n' >> apps/cms/.env
append done
$ grep -v '^#' apps/cms/.env | grep -v '^$' | cut -d= -f1
DATABASE_URI
PAYLOAD_SECRET
NEXT_PUBLIC_SERVER_URL
CHATWOOT_WEBHOOK_SECRET
PUBLIC_CORS_ORIGINS

# 追加性证明：旧文件 233 字节，新文件 479 字节，前 233 字节逐字节相同
$ b=$(wc -c < /tmp/cms.env.bak.pre-cors); head -c "$b" apps/cms/.env | cmp - /tmp/cms.env.bak.pre-cors
PROOF: first 233 bytes byte-identical => append-only, nothing rewritten
$ grep -c '^PAYLOAD_SECRET=.'      → 1
$ grep -c '^DATABASE_URI=.'        → 1
$ grep -c '^NEXT_PUBLIC_SERVER_URL=.' → 1
$ grep -c '^CHATWOOT_WEBHOOK_SECRET=.' → 1
```

- 结论：4 个原变量（含 `PAYLOAD_SECRET`、`DATABASE_URI`）**全部仍在且值非空**，未整文件重写；现共 5 个变量。备份留存于 `/tmp/cms.env.bak.pre-cors`（步骤 5 负向验证复用）。

### 1.3 `scripts/cms-run.sh`（改）

必需项段落新增（保持既有 `${VAR:?}` 风格与 `set -euo pipefail`）：

```bash
# CORS 白名单无内置默认：未注入即终止（CMS 启动也会因缺该变量抛错）。
: "${PUBLIC_CORS_ORIGINS:?请先 export PUBLIC_CORS_ORIGINS（逗号分隔的公开站 origin，可直接复制：https://juece.cloud,https://erp.juece.cloud,https://yunque.juece.cloud）}"
```

并把 `PUBLIC_CORS_ORIGINS=$PUBLIC_CORS_ORIGINS` 写入生成的 `/opt/juece-grow/cms.env` heredoc（与其他变量同一 env-file 通道）。

```
$ bash -n scripts/cms-run.sh
SYNTAX OK
# 负向（取脚本前 11 行=守卫段落，未执行任何 docker 命令）：
$ PROD_DATABASE_URI=x PAYLOAD_SECRET=y CHATWOOT_WEBHOOK_SECRET=z PUBLIC_CORS_ORIGINS= bash /tmp/guard.sh
/tmp/guard.sh: line 11: PUBLIC_CORS_ORIGINS: 请先 export PUBLIC_CORS_ORIGINS（逗号分隔的公开站 origin，可直接复制：…）
exit=1
# 正向：
$ … PUBLIC_CORS_ORIGINS=https://juece.cloud bash /tmp/guard.sh → exit=0
```

- 结论：未注入 / 注入空值均立即终止（含 `:=` 空串），错误文本可复制取值；脚本未执行任何容器操作。

### 1.4 `docs/08-deployment.md`（改）

§3「生产关键项」在 CMS 主库条目后新增 `PUBLIC_CORS_ORIGINS` 条目：三站逗号分隔注入、**无内置默认**、缺失或 trim 后为空集合则启动即抛错且错误文本点名该变量、非白名单 Origin 不出 CORS 头、并指明 `scripts/cms-run.sh` 的 `${PUBLIC_CORS_ORIGINS:?}` 同语义前置校验。

## 步骤 2 · CORS 去兜底（PROB-002 后半）— 已完成

`apps/cms/src/lib/envelope.ts`（改，51 行）：

- 删除 `DEFAULT_CORS_ORIGINS` 常量（全仓已无代码引用，仅 `.aiws` 计划文档留痕）。
- `allowedOrigin()` 唯一路径：`process.env.PUBLIC_CORS_ORIGINS` → `split(',')` → `trim` → `filter(len>0)`；
  集合为空即 `throw new Error('PUBLIC_CORS_ORIGINS 未配置或为空：CORS 白名单无内置默认，须以逗号分隔注入公开站 origin（如 https://juece.cloud,…）')`。
- 校验**先于** `if (!origin) return null`：白名单配置本身不合法时，服务端拒绝任何 v2 响应（misconfiguration 不得被静默放行）。
- 无 try/catch、无 dev 例外分支、无 memo 兜底；`corsHeaders / ok / err / OPTIONS` 一字未动（签名与颁发行为不变）。
- 文件头注释同步由「缺失环境变量时启用内置默认」改为「唯一来源 … 无内置默认；变量缺失或 trim 后为空集合即抛错——宁可拒绝服务，也不用兜底白名单放行跨端请求」。

```
$ grep -rn "DEFAULT_CORS" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .
（apps/cms 代码零命中；仅 .aiws 计划/评审文档叙述历史状态）
$ grep -rn "PUBLIC_CORS_ORIGINS" <全仓代码/脚本/文档>
apps/cms/.env:6  apps/cms/.env.example:8  apps/cms/src/lib/envelope.ts:4,9,15
docs/08-deployment.md:101  scripts/cms-run.sh:11,19
```

## 步骤 3 · 删死字段与迁移（PROB-001）— 已完成

### 3.1 删 `Leads.activity` 字段块（改 `apps/cms/src/collections/Leads.ts`）

删除 `{ name: 'activity', type: 'array', … fields: [time,type,summary] }` 整块（原 378–410 行），
`nextFollowUpAt` 成为末字段。文件 412 → 379 行（`wc -l` 实测）。未改动任何 `hooks` / `endpoints` 逻辑。

### 3.2 失效注释修正（原 `Leads.ts:64`，唯一命中）

```
- // 线索动态：在唯一写入路径记录关键事件（创建/状态流转/分配/跟进写注），见 lib/leadActivity。
+ // 线索动态：本 afterChange 钩子即唯一写入路径，关键事件（创建/状态流转/分配/跟进写注）
+ // 直接写入 lead-activities 集合（模型见 collections/LeadActivities.ts）。
```

`ls apps/cms/src/lib/` 证实 `leadActivity.ts` 不存在；改后全仓 `grep leadActivity` 在 `apps/cms/**` 代码内零命中。

### 3.3 再生成类型

```
$ pnpm --filter cms exec payload generate:types
[17:33:29] INFO: Types written to F:\juece-grow\apps\cms\src\payload-types.ts
$ git diff --stat apps/cms/src/payload-types.ts
 apps/cms/src/payload-types.ts | 19 -------------------
 1 file changed, 19 deletions(-)
@@ export interface Lead      : 删除 activity?: { time; type; summary; id }[] | null
@@ export interface LeadsSelect: 删除 activity?: T | { time; type; summary; id }
```

- 结论：类型再生成**只**移除 `activity`，无附带漂移。

### 3.4 生成 drop 迁移

```
$ pnpm --filter cms exec payload migrate:create drop_lead_activity
[17:33:40] INFO: Starting migration: generating UP statements...
[17:33:40] INFO: Migration UP complete. Generating DOWN statements...
[17:33:40] INFO: Migration created at F:\juece-grow\apps\cms\src\migrations/20260919_093340_drop_lead_activity.ts
[17:33:40] INFO: Done.
```

产物：`apps/cms/src/migrations/20260919_093340_drop_lead_activity.ts`（+ 同名 `.json` 快照 + `index.ts` 登记）。

**逐行核对结果**（`up` 全文仅 2 条语句）：

```sql
DROP TABLE "leads_activity" CASCADE;
DROP TYPE "public"."enum_leads_activity_type";
```

`down` 仅反向重建同类对象（`CREATE TYPE enum_leads_activity_type` / `CREATE TABLE leads_activity` / 其 FK
`leads_activity_parent_id_fk` / `leads_activity_order_idx` / `leads_activity_parent_id_idx`）。
**掺入的无关列变更：无** —— 本地库与 schema 无该层面的漂移（与 0.4 探针预测一致）。

`CASCADE` 爆炸半径预核（确认不会波及他表）：

```
$ psql -tAc "select tc.table_name, tc.constraint_name from information_schema.table_constraints tc
     join information_schema.constraint_column_usage ccu on tc.constraint_name=ccu.constraint_name
     where tc.constraint_type='FOREIGN KEY' and ccu.table_name='leads_activity'"
（空 —— 无任何他表引用 leads_activity，CASCADE 只会带走其自身索引/外键）
$ psql -tAc "select relname, relkind from pg_class where relname like 'leads_activity%'"
leads_activity|r  leads_activity_order_idx|i  leads_activity_parent_id_idx|i  leads_activity_pkey|i
```

### 3.5 应用到本地库 —— 仓内可行方式说明（偏离任务书预设，已按护栏保守处置）

先按任务书预设跑官方命令，实际行为是 Payload 自身的**数据安全门禁拦住**：

```
$ timeout 180 pnpm --filter cms exec payload migrate
[17:34:41] INFO: Reading migration files from F:\juece-grow\apps\cms\src\migrations
? It looks like you've run Payload in dev mode, meaning you've dynamically pushed changes to your database.
  If you'd like to run migrations, data loss will occur. Would you like to proceed? » (y/N)
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 143: payload migrate   ← 非交互下挂起至超时
$ psql -tAc "select count(*) from information_schema.tables where table_name='leads_activity'"
1          ← 未应用，也未破坏
（快照 22|12|12|5|2 完全未变）
```

根因（读源码定位，非猜测）：见 0.2 / 0.4 —— `payload_migrations` 有 `batch=-1` 的 `dev` 记录，
`drizzle/dist/migrate.js:30` 据此弹「data loss will occur」确认；且磁盘唯一的历史迁移 `20260830_122948`
从未被记录进 `payload_migrations`，若强行答 `y`，它会先对已存在的表执行 `CREATE TABLE`（真会造成损失/报错回滚）。
**本仓本地库是 dev-push 库，`payload migrate` 在其上不可安全使用，未强行绕过该门禁。**

改用最保守的可控方式：把**已生成迁移自身的 `up` DDL**（严格限定在 `leads_activity` 与其枚举类型，
即任务书护栏点名的唯一许可对象）经 `psql -v ON_ERROR_STOP=1` 在单事务内落库：

```
$ docker exec juece-grow-postgres psql -U juece -d juece_grow -v ON_ERROR_STOP=1 \
    -c 'BEGIN; DROP TABLE "leads_activity" CASCADE; DROP TYPE "public"."enum_leads_activity_type"; COMMIT;'
BEGIN / DROP TABLE / DROP TYPE / COMMIT

$ docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc \
    "select count(*) from information_schema.tables where table_name='leads_activity'"
0                                              ← 期望 0，达成

$ psql -tAc "select (select count(*) from pg_class where relname like 'leads_activity%') as objs,
     (select count(*) from pg_type where typname='enum_leads_activity_type') as enum_type,
     (select count(*) from information_schema.columns where table_name='leads_activity') as cols"
0|0|0                                          ← 表/索引/枚举/列 零残留

$ psql -tAc "select (select count(*) from information_schema.tables where table_schema='public'),
     (select count(*) from leads), (select count(*) from lead_activities),
     (select count(*) from articles), (select count(*) from payload_migrations)"
21|12|12|5|2                                   ← 仅表数 22→21，12 条真实线索等业务数据逐张未变
```

- 结论：`leads_activity` 已从本地库消失，无关表/行零变化；**未** TRUNCATE、**未** ALTER/DROP 任何非 `leads_activity` 对象、
  **未** 改动 `payload_migrations` 记账（手工插行属许可范围外的写操作，且对该库无收益）。
- 遗留（须写入风险）：迁移文件是生产侧交付物；生产库将经 Payload 官方 `migrate` / `prodMigrations` 自动通道执行同一 `up`。
  本地 dev 库因 dev-push 管理模式不经该通道，故其 `payload_migrations` 仍不记录本迁移。

## 步骤 4 · 删空目录（PROB-003）— 已完成

引用面确认见 0.3（六目录皆空、`payload.config.ts` 组件声明经 importMap 解析到 `apps/cms/components/`，零引用）。
追加确认 git 未跟踪其中任何文件：

```
$ git ls-files -- apps/cms/src/components apps/cms/src/app/api/dev-seed \
    apps/cms/src/app/api/v2/sites/clone apps/cms/src/app/dashboard apps/cms/scripts src
（零输出 —— 六个路径下无任何被跟踪文件）
```

删除用 `rmdir`（非 `rm -rf`）：目录若非空即失败，本身即是二次护栏。

```
$ for d in <六个路径>; do rmdir "$d" && echo "rmdir OK: $d"; done
rmdir OK: apps/cms/src/components
rmdir OK: apps/cms/src/app/api/dev-seed
rmdir OK: apps/cms/src/app/api/v2/sites/clone
rmdir OK: apps/cms/src/app/dashboard
rmdir OK: apps/cms/scripts
rmdir OK: src

$ for d in <六个路径>; do [ -e "$d" ] && echo "STILL EXISTS: $d" || echo "gone: $d"; done
gone:（六条全部 gone）
```

- 结论：六个空目录全部删除，无一含隐藏文件或被引用；`apps/cms/components/`（有内容的 admin 组件目录）**未触碰**。
- 旁证：`apps/cms/src/app/intake/` 有 `layout.tsx` + `page.tsx`，非空，保留。
- 观察（范围外，未擅自处理）：删掉 `sites/clone` 后，父目录 `apps/cms/src/app/api/v2/sites/` 成为**新的空壳目录**
  （`find apps/cms/src -type d -empty` → `apps/cms/src/app/api/v2/sites`）。它不在任务书枚举的六条内，故保留；
  git 不跟踪空目录 ⇒ 对提交零影响，建议随后续结构清理一并删除。

```
$ git status --short -- apps scripts docs
 M apps/cms/.env.example
 M apps/cms/src/collections/Leads.ts
 M apps/cms/src/lib/envelope.ts
 M apps/cms/src/migrations/index.ts
 M apps/cms/src/payload-types.ts
 M docs/08-deployment.md
 M scripts/cms-run.sh
?? apps/cms/src/migrations/20260919_093340_drop_lead_activity.json
?? apps/cms/src/migrations/20260919_093340_drop_lead_activity.ts
```

- 结论：改动面恰为「改 6 文件 + 新增迁移 2 文件」，无计划外文件被动；`apps/cms/.env` 因 gitignore 不入 git（预期）。

## 步骤 5 · 验证 — 全部真跑

### 5.1 `pnpm --filter cms build`

```
$ pnpm --filter cms build        （NODE_ENV=production，webpack）
▲ Next.js 16.3.2 (webpack)
- Environments: .env
✓ Ready ... （middleware 约定 deprecation 警告为既有，非本次引入）
  Running TypeScript ...
  Finished TypeScript in 2.1s ...          ← 无 TS 错误
✓ Generating static pages using 13 workers (10/10) in 1982ms
Route (app)
┌ ○ /                        ├ ƒ /admin/[[...segments]]
├ ○ /_not-found              ├ ƒ /api/[...slug]
├ ƒ /api/v2/content/articles ├ ƒ /api/v2/health
├ ƒ /api/v2/leads            ├ ƒ /api/v2/reminders/run
├ ƒ /api/v2/stats/leads      ├ ƒ /api/v2/webhooks/chatwoot
└ ○ /intake
BUILD_EXIT=0
```

- 结论：构建成功；产物路由表**不再含** `/api/dev-seed`、`/dashboard`（与步骤 4 删空目录互证）；`- Environments: .env` 证实 `PUBLIC_CORS_ORIGINS` 已进入构建期环境。

### 5.2 命令可行性修正（重要）

```
$ pnpm --filter @juece/e2e exec playwright test tests/security.spec.ts
No projects matched the filters in "F:\juece-grow"      ← 任务书给的 filter 不存在
$ python -c "print(json.load(open('apps/e2e/package.json'))['name'])"
e2e
$ pnpm --filter e2e exec playwright --version
Version 1.62.1
```

- 结论：仓内可行 filter 为 `e2e`（`pnpm-workspace.yaml` 只声明 `apps/*`）。后续均用 `pnpm --filter e2e exec playwright test tests/security.spec.ts`。

### 5.3 正向：CMS dev + 既有安全用例（含 C5 五个 CORS 用例）

```
$ pnpm --filter cms dev > /tmp/cms-dev.log &
✓ Ready in 2.1s   /  - Environments: .env
$ curl -s http://127.0.0.1:3000/api/v2/health
{"success":true,"data":{"status":"ok"}}
```

dev 日志内 drizzle 同步段：`[✓] Pulling schema from database...` 后**无任何 data-loss 警告、无交互提示**
⇒ 证 3.5 之后 config schema 与本地库 schema 已一致（否则会弹确认并卡住启动）。

```
$ pnpm --filter e2e exec playwright test tests/security.spec.ts
  ok 16 › C5 CORS 白名单 › 白名单 Origin 请求内容端点回 Allow-Origin=自身
  ok 17 › C5 CORS 白名单 › 非白名单 Origin 不回 Allow-Origin（跨端投毒被拒，C5）
  ok 18 › C5 CORS 白名单 › 无 Origin 请求不回 Allow-Origin（服务端/非浏览器调用）
  ok 19 › C5 CORS 白名单 › 白名单 Origin 的 OPTIONS 预检返回 204 + 方法头
  ok 20 › C5 CORS 白名单 › 白名单 Origin 的 POST 仍回 Allow-Origin
  3 skipped
  23 passed (17.1s)
```

- C5 五例全绿 ⇒ 用例拿 `https://juece.cloud` 撞白名单，命中的正是新注入的 `PUBLIC_CORS_ORIGINS`（默认值已删）。
- 3 个 skipped 均为既有条件跳过（C6 需 `CMS_ADMIN_USERNAME/PASSWORD`；C7 两例需测试进程的 `CHATWOOT_WEBHOOK_SECRET`），与本次改动无关，未去取任何凭据。
- 手工旁证（同一 env 生效）：

```
$ curl -D - -H 'origin: https://juece.cloud' 'http://127.0.0.1:3000/api/v2/content/articles?site=juece'
HTTP/1.1 200 OK / access-control-allow-origin: https://juece.cloud
$ curl -D - -H 'origin: https://evil.example' '…/api/v2/content/articles?site=juece'
HTTP/1.1 200 OK （无 access-control-allow-origin 头）
$ curl -X OPTIONS -D - -H 'origin: https://yunque.juece.cloud' http://127.0.0.1:3000/api/v2/leads
HTTP/1.1 204 No Content / access-control-allow-methods: GET,POST,OPTIONS / access-control-allow-headers: Content-Type
                      / access-control-allow-origin: https://yunque.juece.cloud
```

- 跑完后库核对：`21|12|12|5|2`（与 3.5 落库后完全一致，e2e 未残留业务数据）。
- 观察（既有实现，非本次引入）：`api/v2/health/route.ts` 的 `GET()` 未接收 request 参数 ⇒ 健康端点本身不颁发 CORS 头；但 `allowedOrigin()` 仍被调用，故 5.4 负向能即时暴露。

### 5.4 负向：去掉 `PUBLIC_CORS_ORIGINS` 后的 fail-fast

改前备份 `/tmp/cms.env.bak.withcors`（479 B，md5 `6bcb1ee12fd5…`）；构造临时文件 = 该备份的**前 233 字节**
（与步骤 1.2 追加前的原文件逐字节相同 ⇒ 精确回到「4 变量」态，不伤及其他变量）：

```
$ head -c 233 /tmp/cms.env.bak.withcors > /tmp/cms.env.stripped
$ cmp /tmp/cms.env.stripped /tmp/cms.env.bak.pre-cors     → 相同
$ cp /tmp/cms.env.stripped apps/cms/.env
DATABASE_URI / PAYLOAD_SECRET / NEXT_PUBLIC_SERVER_URL / CHATWOOT_WEBHOOK_SECRET   ← 4 个仍在
PUBLIC_CORS_ORIGINS present? -> 0
$ powershell -NoProfile -Command "Stop-Process -Id <旧监听PID> -Force"   → 端口 3000 释放
$ pnpm --filter cms dev > /tmp/cms-dev-nocors.log &
✓ Ready in 719ms
$ curl -w "%{http_code}" http://127.0.0.1:3000/api/v2/health      → HTTP=500
$ curl -w "%{http_code}" -H 'origin: https://juece.cloud' '…/api/v2/content/articles?site=juece' → HTTP=500
```

报错原文（`/tmp/cms-dev-nocors.log:20`，逐行摘录）：

```
⨯ Error: PUBLIC_CORS_ORIGINS 未配置或为空：CORS 白名单无内置默认，须以逗号分隔注入公开站 origin（如 https://juece.cloud,https://erp.juece.cloud,https://yunque.juece.cloud）
    at allowedOrigin (src\lib\envelope.ts:14:11)
    at corsHeaders (src\lib\envelope.ts:27:17)
    at ok (src\lib\envelope.ts:42:64)
    at GET (src\app\api\v2\health\route.ts:4:12)
  14 |     throw new Error(
     |           ^
GET /api/v2/health 500 in 532ms
```

**精确结论（与任务书预期有一处需澄清，已据此收紧文档）**：错误文本确已点名 `PUBLIC_CORS_ORIGINS` 且无任何兜底放行；
但抛出错的确切时机是**进程内首个 `/api/v2/*` 请求**（Next dev 进程本身会先打印 `Ready`），
而非 Node 进程启动瞬间——因为 `payload.config.ts` 本轮约定不改，无法在其内做启动期校验。
效果上 CMS 仍完全不可用（健康检查恒 500，永远过不了就绪门禁），且容器入口 `scripts/cms-run.sh` 的
`${PUBLIC_CORS_ORIGINS:?}` 会在 `docker run` **之前**终止，生产侧仍是真·启动失败。
据此把 `docs/08-deployment.md` 的措辞从「启动即抛错」改写为上述两层精确语义，避免文档夸大。

### 5.5 还原与收尾

```
$ powershell -NoProfile -Command "Stop-Process -Id <PID> -Force"
$ cp /tmp/cms.env.bak.withcors apps/cms/.env
$ cmp /tmp/cms.env.bak.withcors apps/cms/.env      → RESTORED byte-identical
$ md5sum apps/cms/.env                             → 6bcb1ee12fd5c42feed643dd80053567（与备份一致）
$ grep -v '^#' apps/cms/.env | grep -v '^$' | cut -d= -f1
DATABASE_URI / PAYLOAD_SECRET / NEXT_PUBLIC_SERVER_URL / CHATWOOT_WEBHOOK_SECRET / PUBLIC_CORS_ORIGINS
$ for v in 上述5个; do grep -c "^$v=." apps/cms/.env; done → 1 1 1 1 1（五个变量均存在且值非空）
$ pnpm --filter cms dev &                          → READY: {"success":true,"data":{"status":"ok"}}（恢复健康）
$ pnpm --filter e2e exec playwright test tests/security.spec.ts → 23 passed / 3 skipped（含 C5 五例）
```

停止自启进程，不留孤儿：

```
$ powershell -NoProfile -Command "Stop-Process -Id 57484 -Force"
$ netstat -ano | grep ':3000' | grep -i listening  → 无（仅 TIME_WAIT 套接字，内核自动回收）
$ curl http://127.0.0.1:3000/api/v2/health         → curl_exit=7（拒绝连接）
$ Get-CimInstance Win32_Process | ?{ CommandLine -like '*next dev*' -or '*cross-env*' -or '*juece-grow*' }
  → 仅剩本次查询自身的 bash/powershell 与一个 2026-09-18 既有 cmd.exe；无任何 node/next/pnpm 残留
```

- 结论：dev 已停、3000 端口已释放、`.env` 五变量齐全且与追加后状态逐字节一致。

## 步骤 6 · T6 e2e 补齐（提醒扫描 / leads assign / sites clone）— 已完成

### 6.1 缺口与前置事实（只读核对）

三条**仅全局管理员可用**的后端写能力此前零 e2e 覆盖；`apps/e2e/tests/` 仅 `lead.spec.ts` + `security.spec.ts`：

| 能力 | 实现位置 | 鉴权 |
| --- | --- | --- |
| 提醒扫描（REQ-0002 判重内核） | `apps/cms/src/lib/reminderCron.ts`，手动入口 `POST /api/v2/reminders/run` | `requireAdmin` |
| 线索分配 | `apps/cms/src/collections/Leads.ts:131` `endpoints` → `path:'/assign'`（`:133`） | `req.user` + `isProjectMemberOf` |
| 站点复制 | `apps/cms/src/collections/Sites.ts:27` `endpoints` → `path:'/clone'`（`:29`） | `projectManage` |

- `security.spec.ts` 的 C6 块一直 `test.skip(!adminUser || !adminPass, '未设置 CMS_ADMIN_USERNAME / CMS_ADMIN_PASSWORD，跳过 C6')`（`:258`）：仓库里从未存在过可用的后台账号，`apps/cms/.env` 也不含凭据 —— 即「缺凭据」是真实原因，不是用例偷懒。
- 结论：要真断言必须先有一个**明确命名的 e2e 管理员**（用户已授权「你自己建账户测试」），并让 `pnpm --filter e2e test` 零参数可复现。

### 6.2 建 e2e 全局管理员：官方 local API，幂等

新增 `apps/cms/scripts/create-e2e-admin.ts`（142 行）：`payload run` + `getPayload({config})` + `payload.create/update({collection:'users', overrideAccess:true})`。**未**手算 salt/bcrypt、**未**向 `users` 表 INSERT。要点：

- 只按 `username='e2e-admin'` upsert（`find` 命中 >1 直接抛错），口令随机 `E2e!<base64url(18B)>`，但**优先复用 secrets 里的既有口令** → 重跑既不改密也不产生第二份凭据。
- 脚本内置 `process.env.PAYLOAD_MIGRATING='true'`，只为跳过 dev 启动时的 `pushSchema`（本库是 push 出来的、无迁移基线），不触碰调度与鉴权逻辑。
- 凭据写 `.aiws/secrets/test-accounts.json`（`git check-ignore -v` → `.gitignore:4:.aiws/secrets/`），形状按 `test-accounts.example.json`；显示名里带重建出处。

```
$ REMINDER_CRON_EXPRESSION="0 0 1 1 *" pnpm --filter cms exec payload run scripts/create-e2e-admin.ts   # 第 1 次
[e2e-admin] created users/8 role=admin passwordSource=freshly-generated credentials=<见 .aiws/secrets/test-accounts.json>
$ 同上                                                                                                    # 第 2/3 次
[e2e-admin] updated users/8 role=admin passwordSource=reused-from-secrets credentials=<见 .aiws/secrets/test-accounts.json>
$ echo $?  → 0
```

- 一行重建命令（唯一种子来源）：`REMINDER_CRON_EXPRESSION="0 0 1 1 *" pnpm --filter cms exec payload run scripts/create-e2e-admin.ts`
- 未改 `apps/cms/.env`（T6 全程无需追加变量；回读仍为 5 个变量）。
- `payload run` 走 `dist/bin/index.js`，末尾自身 `process.exit(0)`，`onInit → startReminderCron` 的 node-cron 定时器不会吊住脚本；实测 9 秒内退出，无挂起。
- 库面核对（REST `?limit=50`，官方鉴权）：`users totalDocs=3 → [(8,'e2e-admin','admin'), (3,'viewer1','operator'), (2,'admin','admin')]`；既有 2 个用户未删未改；`where[username][equals]=e2e-admin` 命中数 = 1（幂等无重复）。

### 6.3 凭据注入：`globalSetup` + 缺文件保持 skip

```
$ pnpm --filter e2e exec playwright test tests/security.spec.ts   # 无 CMS_ADMIN_* 环境变量，仅靠 globalSetup
[e2e] 已注入管理员凭据 CMS_ADMIN_USERNAME=e2e-admin（口令值不外泄）
  24 passed / 2 skipped
```

- `apps/e2e/playwright.config.ts`：+`globalSetup: './setup/global-setup.ts'`；`apps/e2e/setup/global-setup.ts`（47 行）读 secrets → 设 `process.env.CMS_ADMIN_USERNAME/CMS_ADMIN_PASSWORD`，日志只打用户名不打口令。
- **文件缺失/无该账号时只 `console.log` 后 `return`**：不抛错、不填默认值。实测临时移走 secrets 后整跑 `35 passed / 23 skipped`（`-` 全为 skip，非 fail），运行结束 `sha256sum -c` 还原 secrets 一致。
- 新用例的 skip 条件由用例自己声明（`test.skip(!adminCredentials(), '未提供 CMS 管理员凭据…')`），helper 不发散出「抛错型 skip」。

### 6.4 `apps/e2e/tests/reminders.spec.ts`（236 行，4 例全绿）

造数（专属项目 + `RUN_TAG=e2e提醒<ts>`）：线索 A `status:'new'`、`createdAt` 回填 30 天前；线索 B `status:'contacted'`、`nextFollowUpAt` 2 小时前；规则 1 条 `sla`（`applyStatuses:['new']`, `graceHours:24`, `target=adminId`）+ 1 条 `due`。

- `createdAt` 回填走 Payload 官方能力：`createdAt/updatedAt` 在 `payload/dist/collections/config/sanitize.js:121` 被注册为**可写 date 字段**，drizzle `upsertRow` 尊重传入值 → 无需裸 SQL、无需改产品代码（否则 `graceHours` 有 `min:1` 无法表达「30 天前」）。
- 快照先于造数：`beforeAll` 第一步取 `reminder-notices`/`lead-activities` 全量 id（并断言 `totalDocs ≤ 900`，防差集静默漏删）。
- 断言链（真断言，非 smoke）：`success:true` 且 `data.created ≥ 2` → 本项目恰 2 条 `status:'open'` 通知、`receiver=adminId`、`sla.dueAt === 线索createdAt+24h`、`due.dueAt === nextFollowUpAt` → 2 条 `lead-activities(type='reminder', actor=null, meta{ruleId,kind})`。
- **判重（REQ-0002 核心）第二次扫描 `created === 0` 实测通过**，通知/动态条数不翻倍。
- 扫描只读：`status/createdAt/nextFollowUpAt/updatedAt/owner` 与扫描前逐项全等（另含前置自检，防「快照等于空所以恒真」的假绿）。
- 未登录手动触发 → `expectErr(403,'FORBIDDEN')` 统一信封。
- `afterAll`：`DELETE /api/projects/:id`（级联）+ 按快照差集删本轮新增的通知/动态（本轮那条**既有全局 `due` 规则**会扫到 12 条真实线索，必须靠差集清理，绝不做全局清理语句），最后断言 id 集合与快照排序后逐等、项目内线索/规则为 0。

```
  ok 命中落账：due 与 sla 各建一条 open 通知 + reminder 动态 (189ms)
  ok 判重：紧接着第二次扫描 created 为 0，通知与动态不翻倍 (69ms)
  ok 扫描对线索只读：状态与时间字段与扫描前逐项一致 (37ms)
  ok 未登录不能手动触发扫描（403 FORBIDDEN 统一信封） (13ms)
```

### 6.5 `apps/e2e/tests/leads-assign.spec.ts`（212 行，9 例绿，含 2 个已知缺陷例）

- 正向：分配给同项目成员 → `expectOk`；`relId(data.owner) === memberUser`（端点回的是 `payload.update` 的默认 depth 结果，owner 是**已填充对象**，故取 id 而非 `Number()`），并断言该对象不含 `hash/salt/token/password`；`depth=0` 复读确认 `owner` 真落库；`lead-activities(type='assigned')` 恰 1 条且 `project/meta.owner` 正确；另加**正向对照**：REST 建线索产生的 `created` 动态 `actor === adminId`（证明 actor 语义本身可用，见 6.9 缺陷 2）。
- 负向逐条按统一信封 `expectErr(status, code)`：`401 UNAUTHORIZED`、`400 INVALID_JSON`（`text/plain` 原始体）、`MISSING_LEAD`×3、`INVALID_ASSIGNEE`×3、`ASSIGNEE_NOT_IN_PROJECT`（并确认无副作用）、外项目成员发起人 `403 FORBIDDEN`（并确认 owner 未被改）。
- 2 个 `test.fail(true, '已知缺陷…')`：断言**应有行为**（当前红、按预期计入失败=套件仍绿，输出 `x`），不 skip、不放宽、不改产品代码，详见 6.9。
- `afterAll` 删两个测试项目 + 两个一次性账号，并断言线索/成员关系/项目零残留。一次性账号口令是随进程生成的 `E2emem!<ts>` 形式模板，用例结束即删，非持久凭据。

### 6.6 `apps/e2e/tests/sites-clone.spec.ts`（209 行，7 例全绿）

- 正向：克隆体为新 id、落指定项目、`COPIED_FIELDS`（`subdomain/pathSlug/themeColor/metaTitle/metaDescription`）逐字段等于**当场重读**的源站（不用 Map 缓存，避免掩盖源站被改）；`status==='draft'`、`isTemplate===false` 被重置；源站逐字段 `before/after` 全等（不串台）；删克隆体后 `GET /api/sites/:id` → 404。
- 未显式命名 → `<源站名> 副本`；连做两次克隆互不干扰，项目 A 恰 1 站。跨项目克隆显式 `projectId` → 落 B、源站仍在 A。
- 负向：`401 UNAUTHORIZED`、`MISSING_SOURCE`×4（`{}`/0/`'x'`/-1）、`INVALID_PROJECT`、仅 `viewer` 成员 → `403 FORBIDDEN` 且站点数不变。

### 6.7 全量真跑与并行登录缺陷（重要发现）

```
$ REMINDER_CRON_EXPRESSION="0 0 1 1 *" pnpm --filter cms dev &      # 等到 /api/v2/health → {"success":true,"data":{"status":"ok"}}
$ pnpm --filter astro dev &                                          # 等到 :4321 LISTENING（lead.spec.ts UI 用例需要）
$ pnpm --filter e2e test                                             # 任务书指定的零参数命令
  56 passed / 2 skipped (24.7s)      # 2 个 skip = C7 Chatwoot（原因见 6.9 末尾），C6 已是真跑通过
```

首次默认参数（多 worker）跑出现 2 例 fail，根因不是我的用例，也不是产品鉴权写错，而是 **Payload 3 默认 `useSessions:true`（`payload/dist/collections/config/defaults.js:128,142`）下的登录竞争**：`auth/sessions.js:16-40` 把 `user.sessions` 数组整体**读-改-写**回用户行（`payload.db.updateOne({data:user})`，无锁），同一账号并发登录时后提交者覆盖前者写入的 session，先前 token 在 `auth/strategies/jwt.js:73-79` 查不到 `sid` → `catch` 降级为匿名 → 表现为 **403（而非 401）**。最小复现（8 并发登录 + 每线程 6 次受 access 控制的请求，跑 3 轮）：

```
$ python .aiws/tmp/.../probe_parallel.py
w0 login=200 list=403 ×6 … w5 login=200 list=200 ×6 … w7 login=200 list=403 ×6
after-run single list: 200        # 单独重登一次立刻可用：排除口令/角色问题，纯并发丢 session
```

处置：`apps/e2e/playwright.config.ts` 增 `fullyParallel:false` + `workers:1`（测试编排收敛为串行，注释写明两条理由：同账号并发登录竞争、快照差集式自清不能并行）。**未**改产品鉴权/作用域/fail-fast，**未**放宽任何断言。串行后 56/2 稳定复现。

### 6.8 造数回收与库面守恒

- 我的三个文件均 `afterAll` 自清 + 零残留断言，跑完为 `users 3 | leads 12 | lead_activities 12 | reminder_notices 0 | reminder_rules 1 | projects 3 | sites 0 | memberships 0 | articles 5`（与 T6 开始前逐项相同）。
- 但**既有 `lead.spec.ts` 无任何清理**，每跑一次全量留 4 条烟测线索（`烟测用户/API 烟测/微信烟测/去重烟测`）：12 → 16 → 20 → 24 → 28。本轮 4 次全量共 16 条，已按「本轮时间窗 + 烟测名」逐条 `DELETE /api/leads/:id`（**非**全局语句，2026-08-30 的既有 12 条不在窗内）回滚到 `leads 12 / lead_activities 12`。
- 该泄漏登记为后续独立项（不在 T6 内改既有用例）。
- 凭据泄漏自检：`git grep -I -c "<口令>"` → 无命中（rc=1）；全工作区明文扫描（排除 `.aiws/secrets`、`.aiws/tmp`、`node_modules`）→ 仅 `.aiws/secrets/test-accounts.json` 一处。dev-log/代码注释/报告内均写作 `<见 .aiws/secrets/test-accounts.json>`。

### 6.9 发现的真实缺陷（只报告，未改产品代码）

1. **不存在的 id → 500 而非 404**：`Leads.ts:166`（`findByID` 线索）与 `:187`（用户）对不存在 id 直接抛 `NotFound`，被 `:229` 的 catch-all 包成 `500 LEAD_ASSIGN_FAILED`，于是 `:173`/`:193` 的 404 分支不可达。同型问题在 `Sites.ts:72`（→ `500 SITE_CLONE_FAILED`）。用 `test.fail(true, …)` 断言应有行为（期望 `404 LEAD_NOT_FOUND`），当前红、套件仍绿。
2. **端点驱动的分配丢了 actor**：`Leads.ts:221` 的 `req.payload.update({...})` 未透传 `req`，`afterChange` 拿不到 `req.user` → 写出的 `lead_activities.actor = null`；REST 直改 `owner` 的路径 actor 正常（见 6.5 正向对照）。同样以 `test.fail` 断言应为 `adminId`。
3. **判重注释与实现不符**：`ReminderNotices.ts:7` 称「同一 lead + rule + kind 存在 `status=open` 时不再重复提醒」，而 `reminderCron.ts:33` 的 `alreadyNotified` 对**任意状态**（含 `done`）都跳过。行为更保守（不会重复骚扰），但文档口径需修正。
4. 遗留 2 个 skip（`security.spec.ts:380/396`，C7 Chatwoot 正签放行/重放）原因仍是**缺 `CHATWOOT_WEBHOOK_SECRET`**：与管理员凭据无关，需另一条注入通道（读 `apps/cms/.env` 超出 globalSetup 既定范围），登记为后续独立项。

### 6.10 AGENTS.md §9 自检（T6 增量）

- [x] TypeScript + camelCase：7 个新文件均 `.ts`，字段/变量 camelCase；未新增依赖（`package.json`/`pnpm-lock.yaml` 零改动）。
- [x] 自研文件行数：142 / 184 / 47 / 19 / 236 / 212 / 209 行，全部 ≪1000。
- [x] 无兼容/双写/兜底：helper 不吞错（`adminSession()` 失败即抛）、缺凭据即 skip 而非「默认凭据」；断言只用统一信封 `{success,data}` / `{success,error:{code,message}}` 与 camelCase 字段。
- [x] API 面：仅**消费** `/api/v2/reminders/run`、`/api/leads/assign`、`/api/sites/clone`，未新增/改端点。
- [x] 数据面安全：无 migrate/reset、无 `drop schema`、无 `docker compose down -v`、无 TRUNCATE、无任何全局清理语句；既有 2 个用户与 12 条线索逐字节未变；造数全带 `e2e` 标记并 `afterAll` 自清（6.8 另把既有 `lead.spec.ts` 的遗留也回滚到基线）。
- [x] 产品代码零改动：`apps/cms/src/**` 本轮只读；`apps/cms/.env` 未追加未改（5 变量回读一致）。dev 调度不确定性用**进程环境** `REMINDER_CRON_EXPRESSION="0 0 1 1 *"` 消除，不写进 `.env`、不改代码。
- [x] 未 commit / 未 push / 未切分支（仍在 `change/cleanup-batch-20260919`）。
- 收尾：两个自启 dev 进程已停，3000/4321 无监听（见 6.11）。

### 6.11 收尾：停进程与端口复核

```
$ powershell -NoProfile -Command "Stop-Process -Id <cmsDevPid>,<astroPid> -Force"
$ netstat -ano | grep -E 'TCP.*:(3000|4321).*LISTENING'  → 无
$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/v2/health → 000（拒绝连接）
```

## AGENTS.md §9 自检（本轮变更）

- [x] 命名 camelCase：未新增/改名字段；`PUBLIC_CORS_ORIGINS` 为环境变量（SCREAMING_SNAKE 属环境层约定），业务字段无 snake_case 泄漏。
- [x] 未引入外部 CMS / 新依赖（`package.json`、`pnpm-lock.yaml` 零改动）。
- [x] API 响应格式：仍 `/api/v2/*` + `{success,data}` / `{success,error:{code,message}}` 信封，`ok/err/OPTIONS` 未改。
- [x] SEO 字段：本轮不触碰前台渲染，无影响面。
- [x] 线索主数据仍在自有 Postgres（`leads` 12 行、`lead_activities` 12 行未变；Chatwoot 仍只作收件箱）。
- [x] 文件行数：`envelope.ts` 51 行、`Leads.ts` 379 行、迁移 24 行，全部 ≪1000 行；**删掉了 CORS 兜底与 `activity` 双写死模型各一处**，无新增兜底/双写/兼容分支。
- [x] 影响范围：后端 CMS（schema + 配置 + 文档 + 部署脚本）；数据面 = 本地库删除空表 `leads_activity`（0 行）+ 生产待执行迁移；前端 Astro 零改动（全仓 grep 无 `activity` 读写）。
- [x] 未执行任何破坏性动作：无 `migrate:fresh`、无 `drop schema`、无 `down -v`、无删容器、无 TRUNCATE、无非 `leads_activity` 表的 ALTER/DROP。
- [x] `payload.config.ts` 的 `DATABASE_URI || ''` 兜底按约定**未动**（登记为后续独立 change）。

## 独立重跑配方（按序）

```bash
# 0. 前置：容器 juece-grow-postgres 在 5434；apps/cms/.env 含 5 个变量（含 PUBLIC_CORS_ORIGINS）
docker ps --filter "name=juece-grow-postgres"
grep -v '^#' apps/cms/.env | grep -v '^$' | cut -d= -f1

# 1. CORS 配置面（步骤 1）
grep -n "PUBLIC_CORS_ORIGINS" apps/cms/.env.example scripts/cms-run.sh docs/08-deployment.md
bash -n scripts/cms-run.sh

# 2. CORS 无兜底（步骤 2）
grep -n "DEFAULT_CORS" apps/cms/src/lib/envelope.ts   # 期望：无命中

# 3. 死模型与迁移（步骤 3）
docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc \
  "select count(*) from information_schema.tables where table_name='leads_activity'"   # 期望 0
grep -n "name: 'activity'" apps/cms/src/collections/Leads.ts                          # 期望：无命中
grep -rn "leadActivity" apps/cms/src                                                  # 期望：无命中
cat apps/cms/src/migrations/20260919_093340_drop_lead_activity.ts                     # up 仅 2 条 DROP

# 4. 空目录（步骤 4）
for d in apps/cms/src/components apps/cms/src/app/api/dev-seed \
         apps/cms/src/app/api/v2/sites/clone apps/cms/src/app/dashboard apps/cms/scripts src; \
  do [ -e "$d" ] && echo "EXISTS(应无): $d"; done; echo "六目录应全部无输出"
ls apps/cms/components/   # 有内容的 admin 组件目录，必须仍在

# 5. 验证（步骤 5）
pnpm --filter cms build
pnpm --filter cms dev &                                # 等到 health 返回 {"success":true,...}
pnpm --filter e2e exec playwright test tests/security.spec.ts     # 期望 23 passed / 3 skipped
# 负向：临时移除 PUBLIC_CORS_ORIGINS → 重启 dev → /api/v2/health 应 500 且日志点名该变量 → 还原后恢复 200

# 6. T6 e2e 补齐（步骤 6）
#    凭据只存 gitignored .aiws/secrets/test-accounts.json（丢失就重建，勿手写）：
REMINDER_CRON_EXPRESSION="0 0 1 1 *" pnpm --filter cms exec payload run scripts/create-e2e-admin.ts
REMINDER_CRON_EXPRESSION="0 0 1 1 *" pnpm --filter cms dev &       # 3000：cron 推到不可达，保证扫描只由用例触发
pnpm --filter astro dev &                                          # 4321：lead.spec.ts 的 UI 用例需要
curl -f http://127.0.0.1:3000/api/v2/health
curl -fsS -o /dev/null -w 'astro=%{http_code}\n' http://127.0.0.1:4321/   # astro 冷启动慢于 CMS，必须单独等
# 预热：next dev 首次请求才编译路由，冷编译实测 ~48s > playwright 30s 用例预算 ⇒ 不预热会假红。
# 自 PROB-012 起该预热已内置于 apps/e2e/setup/global-setup.ts，下面两条 curl 只是可选诊断（跳过不影响绿灯）
curl -s -o /dev/null -w 'articles=%{http_code}\n' --max-time 180 'http://127.0.0.1:3000/api/v2/content/articles?site=juece'
curl -s -o /dev/null -w 'leads(GET)=%{http_code}\n' --max-time 180 http://127.0.0.1:3000/api/v2/leads   # 期望 405：编译该路由但不写数据
pnpm --filter e2e test                                  # 期望 56 passed / 2 skipped（skip=C7 Chatwoot 缺 secret）
# 无凭据时（移走 secrets 文件）应退化为 35 passed / 23 skipped 且 exit 0，不得抛错
```

- 迁移登记：`apps/cms/src/migrations/index.ts` 由 `payload migrate:create` 自动重写（新增本迁移的 up/down 登记），未手工编辑。
- 本文件为 dev 阶段证据，追加顺序即执行顺序（步骤 0→5→§9→步骤 6（T6）→其 §9 增量与重跑配方），未做事后补写。

## 步骤 7 · spec-review 后的口径统一与第二处兜底收敛（追加）

### 7.1 「何时失败」唯一口径（修正 spec-review M1：语义修正此前只落了一半文档）

本轮以 `apps/cms/src/lib/envelope.ts` 的实际行为为唯一真值，把散落在 7 处文档/脚本/台账里的「缺失即启动抛错」全部改写。任何后续文档按此措辞，不要再写「启动失败/CMS 起不来」：

> `PUBLIC_CORS_ORIGINS` 无内置默认。
> - **部署期**：`scripts/cms-run.sh` 的 `${PUBLIC_CORS_ORIGINS:?}` 在 `docker run` 之前终止容器创建——这是运维应当看到的第一个失败信号。
> - **进程内**：容器照常启动并 Ready（`/api/v2/health` 亦不触发 CORS 分支）；失败发生在**首个带跨域判断的 `/api/v2/*` 请求**，`allowedOrigin()` 抛错 ⇒ 响应 `500` 且无信封、无堆栈。
> - 因此症状是「接口 500」而不是「服务起不来」；排查方向应在环境变量注入，而不是容器启动日志。

已改写的 7 处。复核方式与结果：

```
grep -rn "启动即抛错\|启动立即抛错\|启动即崩\|缺失即启动失败" --include='*.md' --include='*.jsonl' --include='*.sh' --include='*.ts' --include='*.example' .
```
命中 4 类，均非「规范性断言」：① 两份 review 报告原文（记录问题用，不改写）；② `verify-before-complete.md` §E-2 与 `tasks.md` 3.4 中「**不是**进程启动即崩」这类否定式更正句；③ 本节表格的「原文（错）」列；④ `dev-log.md` 历史行（下表最后一条）。即：所有仍在**规定**行为的文档（`.env.example:7`、`proposal.md:50/99/107/127`、`plan:63/66`、`goals:16/44`、`tasks.jsonl:27`、`cms-run.sh:10`）已全部是新口径，逐个 `grep -n` 核对过。

| 位置 | 原文（错） | 现文（对） |
|---|---|---|
| `scripts/cms-run.sh:10` | 「CMS 启动也会因缺该变量抛错」 | 「未注入即在 `docker run` 之前终止（进程内是首个 `/api/v2/*` 请求抛错，不是启动期）」 |
| `proposal.md` 验证计划 | 「负向启动立即抛错」 | 「负向：首个 `/api/v2/*` 请求 500」 |
| `.aiws/plan/2026-09-19-cleanup-batch.md` | 「期望启动即抛错」「负向启动失败点明确」 | 同上口径 |
| `.aiws/goals/G-001-cleanup-batch.md` 目标+判据 3 | 「缺失即启动抛错」「CMS 启动即抛错」 | 同上口径（原判据按现实现不可能满足） |
| `tasks/tasks.jsonl` task-27 | 「启动抛错」 | 同上口径 |
| `.aiws/issues/problem-issues.jsonl` PROB-002 Notes | 「缺 env 即启动抛错」 | 「`cms-run.sh` 部署前拦截；进程内首个 `/api/v2/*` 请求抛错」 |
| `evidence/dev-log.md` 历史行 | 保留原文（见本节的 §123/§176） | **不回改历史**，以本节为唯一口径 |

注：本表最后一条是对「文档必须与实测一致」的诚实例外——dev-log 是时间序证据，历史条目按当时认知书写，修正追加在末尾而非覆写；读者以本节为准。`verify-before-complete.md`、`release-prerequisites.md`、`.env.example`、`docs/08-deployment.md` 已是新口径。

### 7.2 第二处兜底收敛：`scripts/backup.mjs`（spec-review [S5] 的真实内核）

审查者指的「凭据入 git」文件不存在，但其指向的实质缺陷成立：`DEFAULT_URI` 是内置连接串（含明文口令）。本批把它删掉并改为 fail-closed，同时停止在报错里回显口令（cron 邮件/日志会带出）：

- 连接串来源收敛为唯一一条路径：`--uri` 或 `DATABASE_URI`，二者必给其一，否则 `exit=1` 并点名缺失变量。无内置默认 ⇒ 不会在错配的机器上备份到非预期的库。
- 失败消息只回显 `protocol//username@host:port/pathname`，口令不入输出。

实测（`.aiws/tmp/cleanup-batch-20260919/backup-failclosed.log`）：

```
=== 用例 1：无连接串 ===
[backup] 缺少数据库连接串：传 --uri 'postgres://...' 或设置环境变量 DATABASE_URI。不提供内置默认，以免在错配的机器上备份到非预期的库。
exit=1
=== 用例 2：带哨兵口令 SECRETpw999 的连接串 ===
[backup] pg_dump 失败。确认连接串正确且本机已安装 pg_dump：postgres://juece@127.0.0.1:5434/juece_grow（口令已隐去）
exit=1
grep -c SECRETpw999 backup-failclosed.log → 0
```

未验证项（诚实列出）：本机 `which pg_dump` 无输出 ⇒ **备份成功路径在本地无法实测**，只验证了「缺参数即失败」「失败不回显口令」两条负向路径。成功路径须在线上（装了 pg_dump 的服务器）首跑时人工确认。

旧口令轮换问题不因本改动消失：`DEFAULT_URI` 里的 `juece` 口令已进入 git 历史（`4a7d807`），工作树删除不等于历史抹除 → 登记 PROB-010 并曾在 `evidence/release-prerequisites.md` 列为待 owner 拍板项。**2026-09-20 owner 裁决：不轮换**，该项闭环，后续会话不再重复追问。

## 步骤 8 · 机器可核验验证台账（追加）

`aiws verify-bc cleanup-batch-20260919` 在 tier=strict 下已通过，但带一条 warn：
`warn: no evidence/verification.jsonl — legacy evidence assumed (not machine-verifiable)`。
即 §A 全是人写的表，工具无法独立复核。本轮把它变成机器台账：`evidence/verification.jsonl`，21 条记录，字段
`command / exit_code / status / started_at / finished_at / artifact`（负向用例加 `expected_exit_code`，因为它们的通过条件是**非零**退出）。

生成器：`.aiws/tmp/cleanup-batch-20260919/run-verification.mjs`（每跑完一条就增量落一行，中途挂掉也保留已完成部分）。
两条补记另起脚本，避免污染主流程：`rerun-scope-gate.mjs`（§A-13 第三轮）、`probe-db-after-e2e.mjs`（§A-6 末轮 e2e 之后的库侧读数）。

### 8.1 本轮我自己的两个缺陷（先记自己，再记工具）

1. **仓库根算少一层**。`ROOT = resolve(import.meta.dirname, '../..')` 从 `.aiws/tmp/<id>/` 只回到 `.aiws/`，
   于是 4 条命令在错的 cwd 下跑，报出**假失败**：
   `cd apps/cms && npx tsc` → `系统找不到指定的路径`；`aiws plan-verify .` → `No .aiws/plan/ directory found`；
   `aiws validate . --stamp` → `Missing .aiws/manifest.json`。
   副作用更坏：台账和工件被写到 `.aiws/.aiws/**`（未跟踪、不在 gitignore 内），下一轮 `--check-scope`
   把这 3 个文件当成"本批改动的文件"报越界。修法：`'../../..'` + 删 `.aiws/.aiws/` + 复跑门禁 → 越界清单只剩 memory-bank 两条。
   教训固化成 PROB-011 第 (4) 条：**scratch 必须落在 gitignore 覆盖的路径里**；出现幽灵越界项先 `git status --porcelain`，别急着改 plan Scope。
2. **e2e 首轮 3 例超时被误当成候选回归**。`lead.spec.ts` 前 3 例 `page.goto`/`request.post` 超时。
   根因：`next dev`(Turbopack) 的路由只在**首次请求**时编译，实测同一路由
   `/api/v2/content/articles` 一次冷编译 **48.3s**（当场观测；其 scratch 文件被后续干净轮次覆盖），
   而 `apps/e2e/playwright.config.ts:7` 的 `timeout: 30_000` 是用例级预算 ⇒ 冷编译吃掉预算，报成超时（该路由现由 §8.3 的 `globalSetup` 预热覆盖）。
   修法：跑测前 (a) 预检 `:3000`/`:4321` 空闲（否则响应请求的是上一轮遗留进程，台账不成立），
   (b) 分别轮询两个 origin 就绪（astro 比 CMS 慢），(c) 预热各路由——`/api/v2/leads` 用 **GET** 触发同一模块编译（期望 405），不写任何数据。
   结果：加入后两轮 `56 passed / 2 skipped`——`e2e-final.log`（19:16）**29.3s**、`e2e-final-2.log`（20:17）**19.1s**。已把三步写进「独立重跑配方」。
   配方里的 curl 行按语法就地校验过（对已关闭端口跑 `-w 'astro=%{http_code}\n'`，输出 `astro=000` 且 `exit=7`）；
   200/405 的语义由台账内等价的 node fetch 记录证明。

### 8.2 台账终态（32 条，全 success）

| 段 | 条数 | 内容 |
|---|---|---|
| A 无需服务端 | 10 | `cms build`、`apps/cms tsc`、backup 负向 ×2（`exit=1` 为通过）、库侧合并探针、`plan-verify`、`validate . --stamp`、`change validate --strict`、`--strict --check-evidence --check-scope`（`exit=2` 为通过）、`tasks validate` |
| B e2e 前置 + 全量 | 5 | 端口空闲预检、CMS 就绪、Astro 就绪、路由预热、`pnpm --filter e2e test` |
| C 归档运行补记 | 4 | `astro:build`、CORS fail-fast 负向、凭据泄漏扫描、`create-e2e-admin` 幂等（时间戳取自在盘工件 mtime，注明"归档运行"） |
| D 补记 | 2 | scratch 清理后的 `--check-scope` 复跑、末轮 e2e 之后的两组库侧探针 |
| E 冷启动复跑 | 2 | 「只等 TCP listen、不预取路由」的冷启动前置、缓存真空下的全量 e2e（§8.3 证明） |
| F 收口轮 | 1 | 所有编辑定格后的 `pnpm --filter e2e test` 复跑（§8.4） |
| G 提交后审查修复轮 | 5 | backup 三条（无 uri / 无库名 / 带库名回显，全部 `exit=1` 为通过）、修复轮全量 e2e、该轮之后的库侧残留探针（§8.5） |
| H 修复轮门禁 | 3 | 修复轮收口序列（`change sync` + `validate . --stamp` + `--strict` + `tasks validate`）、`aiws verify-bc`、修复轮的 `--strict --check-evidence --check-scope`（`exit=2` 为通过，越界项仍只有 memory-bank 两条）（§8.5） |

32 行对应 **31 个不同命令**：唯一重复的 `--strict --check-evidence --check-scope` 是我在 scratch 清理前后各跑过一次（#9/#20，两条工件不同），保留是有意的。
**自指限制（不藏）**：H 段这 3 条要写进台账，写完又把整套门禁复跑了一遍——四条全绿、`verify-bc` `exit=0` 且 `legacy evidence assumed` 计数 `0`、加强门禁 `exit=2` 且越界项不变 ⇒ 追加记录不改变门禁结论。严格讲，台账里最后一条记录必然早于最后一次门禁运行，这是「用台账证明门禁」这件事本身的自指，不是遗漏。工件：`37-gates-postfix.log`、`38-verify-bc-postfix.log` 与追加后的第二遍 `39-gates-after-ledger.log`。
`started_at/finished_at` 的 C/D/G 段取工件 mtime（补记口径），A/B/E/F 段是脚本当场记的真实起止。

负向用例的"通过"= 期望的非零退出码；三条 backup 记录带 `expected_exit_code: 1`，加强门禁两条带 `2`。
唯一**本地不可验证**项仍是备份成功路径（无 `pg_dump`），在台账里以缺记体现，并在 §A「—」行与 §F-6 说明——不写成 success。

### 8.3 §8.1(2) 的产品侧收口：预热从我的 scratch 脚本搬进用例自身（PROB-012，追加）

§8.1(2) 的三步修在**我的验证脚本**里（`.aiws/tmp/.../run-verification.mjs`），那只能证明"我这轮跑绿了"。
真正的缺陷在仓库里：任何人 `pnpm --filter e2e test` 首跑仍会因冷编译假红。所以本批把同一处理挪到产品侧：

1. `apps/e2e/setup/global-setup.ts` 重写为两段：`warmUpRoutes()`（先用 **TCP 连接**判 `:3000`/`:4321` 是否在监听，在监听才逐个 GET 预热 4 个端点；任一没起则打一行提示并跳过预热）→ `injectAdminCredentials()`（原有凭据注入，行为不变）。
   就绪判定只认 TCP 不认 HTTP：冷编译会让 HTTP 探活自己超时，把"服务在跑"错判成"服务没起"。
   预热请求失败不抛错（只打一行 `ERROR …`）——预热是加速器，不是新的硬依赖，缺服务时用例仍按原语义失败/skip。
2. `apps/e2e/helpers/origins.ts` 新建为 dev origin 唯一来源，`playwright.config.ts` 的 `baseURL`、`security.spec.ts`、`lead.spec.ts`、`cmsRest.ts` 改为 import。收敛前的字面量共 5 处（HEAD 4 处：`playwright.config.ts:7` baseURL、`security.spec.ts:16` CMS、`lead.spec.ts:3-4` CMS+WEB；本批新增的 `cmsRest.ts` 内 1 处），收敛后全 `apps/e2e` 只剩 `helpers/origins.ts:8-9` 两行（`grep -rn "127.0.0.1:\(3000\|4321\)" apps/e2e` 实测）——改端口不再要漏改。
3. **明确不做**：不给 playwright 配 `webServer`。它会接管 dev 进程生命周期（自己启、跑完杀），与本批既有的"服务由外部启动、`globalSetup` 只做预热与注入"约定冲突，且会把 `REMINDER_CRON_EXPRESSION` 这类启动期环境变量从配方里藏起来。已在 `playwright.config.ts:6` 的 `timeout` 上方留 WHY 注释指回本条。

冷启动证明（台账 #22/#23）：`rm -rf apps/cms/.next` 制造真空缓存 → 启 dev 后**只等 TCP listen、不预取任何路由** → `pnpm --filter e2e test` → astro `/` 的 41.7s 编译费全部落在 `globalSetup` 内，用例仍 `56 passed (1.2m) / 2 skipped`、`exit=0`。
即：验收命令在没有我的 scratch 脚本、零手填参数的情况下自足复现绿灯。`.aiws/tmp/.../run-cold-e2e.mjs` 是这一步的驱动器。

### 8.4 收口轮：最终树复跑 + 门禁盖章 + 第三个工具缺陷（PROB-013）

所有编辑（含 `playwright.config.ts` 的注释同步与 §8.3/计划/提案改写）定格后重跑：

- `pnpm --filter e2e test` → `56 passed (58.8s) / 2 skipped`、`exit=0`，作为台账第 24 条追加（工件 `25-e2e-final-tree.log`）。跑前只等 TCP `:3000`/`:4321` 在监听（`final-tree-rerun.mjs`），跑后按 PID `taskkill /T /F` 回收两棵进程树，`netstat` 复查监听数 `0`。
- 门禁序列（`26-scope-gate-final.log`、`27-verify-bc-final.log`）：`change sync` → `No changes detected vs baseline.`（`20260919-141603Z`）、`validate . --stamp` 绿（`20260919-141605231Z`）、`change validate --strict` `exit=0`、`tasks validate` 绿、`--strict --check-evidence --check-scope` `exit=2`（越界项仍只有 `.aiws/memory-bank/` 两条）。
- **`aiws verify-bc cleanup-batch-20260919`**：`ok: all gates passed (tier=strict)`、`exit=0`，且 `warn: no evidence/verification.jsonl — legacy evidence assumed (not machine-verifiable)` **不再出现**（对该输出 grep 计数 `0`）。这是 §8 整轮的验收目标：验证从"人写的表"变成工具可独立复核。

新发现（PROB-013，登记 OPEN 不随本批改工具）：为核对「手工追加 `verification.jsonl` 到 `Evidence_Path` 会不会被工具覆盖」而**第二次**跑 `aiws change evidence`，结果它每次都用本次 UTC 时间戳新建一套工件（`change-status` / `change-validate-strict` / `aiws-validate-stamp` / `change-sync-stamp` / `collaboration-summary` / `delivery-summary`）并**追加**进 `proposal.md` 与 plan 的 `Evidence_Path`，不去重不回收 ⇒ 字段从 10 项涨到 16 项。处置：删第二次的 6 个盖戳工件，`Evidence_Path` 重写为「人工三件 + 首轮机器六件 + `verification.jsonl`」共 10 项，再用 `check-evidence-path.mjs` 逐项核对在盘存在（两文件各 `条目=10 死链=无`）。操作规则写进 `follow-ups.md`：**收口阶段该命令只跑一次**。

### 8.5 提交后独立审查（针对 `e14c684`）抓到的 6 件事与本轮修复

审查对象是**已提交的树**（记忆条目「提交后默认追一轮独立审查」）。它抓到 6 件事，全部本轮处置：

1. **台账被我自己的脚本写重复（最严重）**：`final-tree-rerun.mjs` 的追加分支把「读到的整表 + 新行」整体 `appendFileSync` 回去 ⇒ 一次运行让 23 行变 47 行，且 `前23行 === 第24–46行` 逐字相等（可复现）。更糟的是这条重复**已经随 `e14c684` 进了 git**。处置：`dedupe-ledger.mjs` 逐行 `JSON.parse`（解析失败即抛，不静默丢行）→ 保序去重 → 写回后断言 `status=success` 且 `exit_code===expected_exit_code`，实测 `before=47 after=24 重复=0 非success或期望码不符=0`；并把 append 逻辑改成**只写新行 + 回读核对增量恰为 +1**。
2. **两处无工件支撑的数字**：`51.5s` 与「21:38 那一轮」在盘上不存在。已按 mtime/台账时间戳重排为完整时间线（见 `verify-before-complete.md` §A-4）。
3. **两处范围口径写错**：plan 的 `apps/e2e/` 行残留「删 3 个空目录」（本批在 e2e 里没删过任何目录，已删该句）；proposal「结构」条只写「删 6 个空目录」而没写净效果（`apps/cms/scripts` 被本批的 `create-e2e-admin.ts` 重建 ⇒ 净减 5，已与「目标」条对齐）。
4. **`scripts/backup.mjs` 的库名内置默认**（原 `:39` `new URL(uri).pathname.replace(...) || 'juece_grow'`）：违反本仓「禁止兜底」红线，真触发时会把备份文件名与旧备份清理前缀一起写错。改为解析一次 URL、库名缺失即 `exit=1`，并去掉 pg_dump 失败分支里的第二次 `new URL(uri)` ⇒ 全文件只剩一条解析路径。三条负向实测：无 uri / 无库名 / 带库名回显（`30/31/32-*.log`，均 `exit=1` 为通过），口令仍不外泄（三份日志 `grep -c SECRETpw999` = `0`）。
5. **`apps/e2e/helpers/cmsRest.ts` 的两处 `??`**：`adminSession()` 的 `relId(...) ?? 0`（0 会把"登录响应形状不对"伪装成一条难定位的断言失败）→ 改显式抛错；`createRequired()` 的 `res.body.doc ?? res.body`（调用方全是 Payload 原生集合的 POST 创建，响应只有 `{doc}` 一种形状）→ 只认 `doc`。本轮全量复跑 `56 passed (1.3m) / 2 skipped`、`exit=0` 就是"被删的那条分支从未被走过"的证明（死兜底，不是我在换行为）。
6. **预热的两个真实缺口**：(a) 原实现任一端口没监听就**整体跳过**预热 ⇒「CMS 起了、astro 没起」这种常见情形下 CMS 仍白付冷编译；改为两个 origin 分别判定、只预热在监听那个名下的目标。(b) 清单漏了本批 spec 自己首请求的路由：`/api/v2/reminders/run` 与 Payload 捕获路由 `src/app/(payload)/api/[...slug]/route.ts`（`/api/leads`、`/api/leads/assign`、`/api/sites/clone` 共用它）。补上后实测 `reminders/run -> 405 (318ms)`、`/api/leads -> 403 (6476ms)`（GET 不写数据、不触发扫描），astro `/` 的 **41.9s** 编译费仍落在 `globalSetup` 内。
7. **修复轮我自己又踩两次同一类坑（写共享文件的脚本没有回读核对）**：跑 `sync-postfix-docs.mjs` 做文档同步时，(a) 幂等判定先问「旧串是否出现 1 次」——但追加型替换的新串把旧串当前缀，于是第二遍运行又追加了一次 ③ 条款；(b) 我手工去重时切片写错（`s.slice(0,i)+s.slice(j+len)`），把**两份**一起删了。两处都由「写回后重新读入并数出现次数」这一步抓出来，最终态 ③ 恰 1 次、`§A-17` 恰 1 次。脚本已改为**先认新串判幂等**，并复跑证明第二遍 `skip=11 / 替换=0`。这与第 1 条同源：往共享文件写东西，必须「只写增量 + 回读核对增量」，不看脚本自述。

**残留（记账，不粉饰）**
- 证据工件全部在 gitignore 的 `.aiws/tmp/` 下 ⇒ "在盘可核"只对**这台机器**成立；随提交进仓的可核对物是台账 JSONL 本身与代码。
- `apps/e2e` 没有 `tsconfig.json` 也没有 typecheck 入口 ⇒ 本轮的类型收窄（`doc`/`id`）只由 e2e 运行时证明，**未经编译器证明**。作为观察项记账，不在本批新开门禁。
- 预热搬走的是"谁付编译费"，不是编译费本身：修复轮全量 1.3m（含 41.9s 冷编译）。

### 8.6 2026-09-20 裁决回填：口令不轮换 · 线上迁移不单独开窗口 · #7 出库 · #3 另立项

用户对本批移交的待决项一次性裁决，台账同步为「已裁决」，防止后续会话重复追问：

1. **口令不轮换**（git 历史里 `4a7d807` 起的备份连接串字面量）⇒ `PROB-010` 由「DONE + 残留待拍板」变为「DONE 无残留」（同步处：问题账 Notes、`release-prerequisites.md` §5 末条打勾、`follow-ups.md` PROB-010 段、`verify-before-complete.md` §E 的 [S5] 段、`dev-log.md` 步骤 7.2）。
2. **线上 `payload migrate` 不单独开维护窗口**：那张死表在线上留着不影响功能、不丢数据，攒到下次真实功能上线一并执行；发布前置清单留在 `release-prerequisites.md` 不删（下批仍要用），本批继续不声称线上已清理。
3. **#7 `reference/` 旧 Vue 站出库 ⇒ 并入本批 T5 结构清理**（见 §8.6.1）。
4. **#3 Astro 文案入 CMS ⇒ 批准，但另立 change**：属新增内容模型 + 站点取数（产品功能），不混进清理批。
5. **PROB-005/006 ⇒ 不各自立项，合并为一个改动做掉**（结果与实测见 §8.7）。

#### 8.6.1 #7 出库的实测与一次门禁自撞

- `git rm -r reference/` 删 **16 个已入库文件**；残留目录 `rmdir` 掉 **7 个**（`reference`、`reference/juecesass-marketing-20260825` 及 `public`/`src`/`src/router`/`src/styles`/`src/views`）⇒ 本批目录净减从 5 变 **12**。核对：`git ls-files reference/ | wc -l` = `0`、`ls -d reference` → No such file、`git grep reference/juecesass` 只剩台账里的记述（无代码/构建依赖）。全部输出落 `64-refdrop-probe.txt`，目录计数出自 `count-dirs.mjs`。
- 删除不丢信息：`git log --oneline -- reference/` 证明该路径历史上**只被 `41a258c`（初始提交）动过**，`git ls-tree 41a258c reference/` 显示 tree 对象仍在 ⇒ 取回命令 `git checkout 41a258c -- reference/` 已写进 `docs/07-design-theme.md` §2.1（原标题把在盘路径当回溯依据，出库后会指空）。
- **自撞的门禁（值得记）**：我把 #7 写成 Plan 的第 9 步，`aiws validate . --stamp` 与 `aiws change validate --strict` 同时 `exit=2`：`Plan section is too long (9 steps > 8)`（`61-sync-after-refdrop.log`）。处置不是删内容而是按语义归位——#7 与 T5「删不参与构建/运行的死内容」同类 ⇒ 并入 T5，Plan 回到 8 步，两扇门禁复跑 `exit=0`（`62-gates-refdrop.log`）。
- **allow-list 上限的连带代价**：In Scope 原本正好 12 条（= 上限），要加 `reference/` 就必须把 `scripts/cms-run.sh`+`scripts/backup.mjs` 折成 `scripts/`、`docs/08`+`docs/07` 折成 `docs/` ⇒ 精度再降一档（PROB-011 第 (2) 条在这里第二次应验）。折叠后 `--strict --check-evidence --check-scope` 的越界清单**仍只剩用户在先的两条 memory-bank 文件**（`63-scope-gate-refdrop.log`，`exit=2` 即预期），证明 `reference/` 的删除确实被 Scope 覆盖而不是靠运气。

### 8.7 2026-09-20 · PROB-005/006 合并修复轮（裁决 5 的落地）与两处当场带出的新问题

改动（4 处产品代码 + 3 个 spec）：

| 位置 | 改动 | 治的是 |
|------|------|--------|
| `Leads.ts` 两条 `findByID` | `disableErrors: true` + null 分流回 404 | PROB-005 |
| `Leads.ts` 端点 `catch` | `catch {` → `catch (err)` + `logger.error({ err }, '[lead-assign] 分配失败')` | 「异常既不外泄也不留痕」 |
| `Leads.ts` 端点 `payload.update` | 透传 `req`；补 `depth: 0` | PROB-006；PROB-015 |
| `Sites.ts` `/clone` | `disableErrors` + null → `404 SOURCE_NOT_FOUND`；`catch` 记日志 | PROB-016（同 PROB-005 类） |
| `leads-assign.spec.ts` | 摘掉两条 `test.fail`，改为真实断言；新增 `ASSIGNEE_NOT_FOUND` 与 actor 用例；正向响应面断言由「不含 hash/salt/token/password」改为「键集恰为 `['id','owner']` 且 `typeof owner==='number'`」 | 固化 + 把黑名单换成白名单 |
| `sites-clone.spec.ts` | 新增 404 用例（前后计数不变断言无副本）；正向补 `['id','name']` 键集断言 | PROB-016/015 |

**主 session 独立复核（子代理自述不作数）**：编辑由子代理完成第一轮，复核与 PROB-015/016 由主 session 动手。逐条自己跑：

- `cd apps/cms && npx tsc --noEmit -p tsconfig.json` → `exit=0`（`67-tsc-verify-main.log`、`70-tsc-after-depth.log` 各一次，后者含 `depth: 0` 与 Sites 改动）。
- 直连本地 CMS 探针（`probe-response-shape.mjs` → `71-response-shape-probe.log`）：`assign_body={"success":true,"data":{"id":200,"owner":8}}`、`body_has_sessions=false`、`assigned_rows=id=219 actor=8`、`clone_nonexistent_http=404`、`clone_data_keys=["id","name"]`；探针自清 `residual_leads=0`。
- 全量 e2e `pnpm --filter e2e test` → `Running 60 tests`、`58 passed / 2 skipped`、`exit=0`（`72-e2e-final.log`；两条 skip 是 Chatwoot 未配的 C7 用例，与本批既有口径一致）。
- 库侧 `73-db-after-final-fix.txt`：`assigned_null_actor=0`、`assigned_total=0`、`e2e_sites_left=0`、`e2e_projects_left=0`、`e2e_users_left=0`、`leads_activity_table=0`。

**收口门禁（台账第 42–44 条，`74-gates-fixround.log`）**：`plan-verify` → `change sync`（`No changes detected vs baseline.`）→ `validate . --stamp` → `--strict` → `tasks validate` 全 `exit=0`，`verify-bc` → `ok: all gates passed (tier=strict)` 且 `legacy evidence assumed` 计数 `0`，加强门禁 `--check-evidence --check-scope` `exit=2` 且越界项仍只有你在先的两条 memory-bank 文件。追加这 3 条台账后再整套复跑一遍（`75-gates-after-ledger.log`）⇒ 结论逐条不变；按 §8.2 的自指限制，最后这一遍自身的输出不再写进台账。两个 dev 进程树（`:3000`/`:4321`）用 `taskkill /T /F` 回收后 `netstat` 监听计数 `0`。

**本轮的一次测量自纠错（不藏）**：`75` 首版把 `$?` 取在 `aiws … | grep -v "LF will be replaced"` 之后，拿到的是 grep 的退出码，于是把加强门禁真实的 `exit=2` 记成 `scopegate_exit=0`——一个假绿。处置是删掉首版、改为不过管道直接取 `aiws` 退出码后重跑（得 `exit=2`），而不是在错日志上打补丁。教训与前一轮的「仓库根少一层」同类：**证据生成方式本身也要被核**，尤其当命令过了管道。

**为什么这两条不是「顺手扩大范围」**：PROB-016 与已批准修复的 PROB-005 是同一行代码模式的另一个实例（扫同类时命中）；PROB-015 是修复 PROB-006 时必须看响应体才看到的——它是那次审查的直接产物，不是新需求。两条都在台账单独立行（含「当时为何没被测试拦住」），没有混进 005/006 的叙述里。

**诚实边界**：
1. `/assign` 与 `/clone` 的「读后删」竞态仍回 500（不是逻辑死分支，是并发窗口）；改事务属另一量级，未做，记在 `follow-ups.md` PROB-016 段末。
2. `leads` 计数 51 → 55 → 59：本批新增的三个 spec 自清零残留，增量全部来自 PROB-007（`lead.spec.ts` 提交类用例每轮净增 4），该问题仍 OPEN，未被本轮修掉。
3. 未连接、未改动任何线上资源；生产侧仍只有 `release-prerequisites.md` 那份人工清单。

