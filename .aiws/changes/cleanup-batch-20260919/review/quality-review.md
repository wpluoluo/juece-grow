# Quality Review · change/cleanup-batch-20260919

**判定：PASS_WITH_CONCERNS** — HIGH blocker **2** / MEDIUM **6** / LOW **7**
（代码本体类型与测试自证通过，可合入本地分支；但 2 条 HIGH 属发布门禁项，未 triage 前不得 `aiws verify-bc` / 不得让本批进入生产部署。）

审查方式：只读复核（git diff / grep / `SELECT` 查询本机 `juece-grow-postgres` / `npx tsc --noEmit`）。未启动任何 dev/build 服务，未改业务代码，未连任何外部库，未读取 `apps/cms/.env`、`.aiws/secrets/**`。

## 0. 对我收到的「已声称验证结果」的独立复核

| 声称 | 复核结论 | 证据 |
|---|---|---|
| `pnpm --filter cms build` exit=0 | **未见复跑，但可采信**（约束禁写 `.next`）；我独立跑 `npx tsc --noEmit -p tsconfig.json` → **exit=0** | `.aiws/tmp/cleanup-batch-20260919/cms-build.log`（`✓ Compiled successfully in 11.8s` / `Finished TypeScript` / 路由表已无 `/api/dev-seed`、`/dashboard`）；tsc 实测输出 `TSC_EXIT=0` |
| e2e `58/56 passed/2 skipped/2 expected-fail`，跑了两遍 | **为真** | `.aiws/tmp/cleanup-batch-20260919/e2e-final.log:68` `2 skipped` + 末行 `56 passed (29.3s)`；`:28-29` 两条 `x`（leads-assign 已知缺陷）；`:30-33` reminders 四例 `ok`；`:52-58` sites-clone 七例 `ok`。dev-log:584 另记一次 `56 passed / 2 skipped (24.7s)` ⇒ 两遍成立 |
| `leads_activity` 计数 0 | **为真（表已消失）** | 实测 `information_schema.tables` 21 张，`%activ%` 只剩 `lead_activities`；`pg_type` 无 `enum_leads_activity_type` |
| 三个新 spec 零残留 | **为真** | 实测 `leads/projects/sites/memberships/reminder_notices` 中 `e2e%` 记录 = 0；`users` 仅剩设计内常驻 `e2e-admin`（`admin`,`viewer1`,`e2e-admin`）；`reminder_rules=1` 为既有全局规则 |
| `aiws validate .` 与 `aiws change validate --strict` 均通过 | **半真**：只有 change 级 strict 有工件；仓库级 `aiws validate .` 无本批 stamp | `.aiws/changes/cleanup-batch-20260919/metrics.json:137-150`（`ok:true, strict:true`，但 `check_evidence:false`/`check_scope:false`）；`.aiws/tmp/aiws-validate/` 唯一文件日期 2026-08-25；`tasks.md:52-53`（3.5/3.6）仍为未勾 |

红线机械项复核（全部通过）：新文件行数 `create-e2e-admin.ts` 142 / `cmsRest.ts` 184 / `global-setup.ts` 47 / 三 spec 236·212·209 / 迁移 24 —— 均 ≪1000；无新依赖（`package.json`/`pnpm-lock.yaml` 不在改动集）；业务字段无 snake_case 泄漏；线索主数据仍在自有 Postgres；`activity` 全仓零残留引用（唯一命中是 `Leads.ts:126` 日志前缀字符串与 `reminders.spec.ts:153` 循环变量）。

---

## 1. HIGH

### [HIGH] H1 破坏性 DROP 的前置条件只在本地自证，线上「零行 + 有备份」两项均未核实

- 证据
  - 迁移体：`apps/cms/src/migrations/20260919_093340_drop_lead_activity.ts:5-6` = `DROP TABLE "leads_activity" CASCADE; DROP TYPE "public"."enum_leads_activity_type";`（无 `IF EXISTS`，非幂等）。
  - 被删字段自 2026-08-25 基线起就在后台**可见且可编辑**：建表见 `apps/cms/src/migrations/20260830_122948.ts:19-27`；被删的 array 字段带 `label 跟进历史` + `initCollapsed` + 4 个方式选项（`git diff apps/cms/src/collections/Leads.ts`），无任何 readOnly/access 限制 ⇒ 运营在生产手工录过跟进历史是完全可能的。
  - 本批自己列的发布前置至今未做：`tasks.md:64`（5.1 线上 `select count(*) from leads_activity` 为 0 + 需有 `node scripts/backup.mjs` 备份）未勾；`tasks.md:67`（5.4 线上 `payload_migrations` 记账核实）未勾。
  - 唯一的「0 行」实证是本地：`backups/juece_grow-2026-08-26T10-07-56-929Z.sql:1083-1084`（`COPY public.leads_activity ... FROM stdin;` 紧跟 `\.` ⇒ 当时 0 行），且 `backups/` 只有这一份 8-26 本机 dump，不含生产。
  - 回滚路径只恢复结构、不恢复数据：`20260919_093340_drop_lead_activity.ts:9-24`（down 重建 TYPE/TABLE/FK/两个索引，与基线 up 逐对象镜像 —— 这一点是对的），且 **down 从未被执行验证**。
- 影响：一旦该 up 在生产落地而线上有历史录入，数据**不可逆丢失**，且没有经验证的含该表备份；红线 7「禁止破坏性改表丢数据」的豁免条件（走「新增列→回填→独立发布后删旧列」+ 回滚路径）只满足了「独立发布期后删旧列」的形态，不满足「已核实无数据」。
- 处置建议：**本批必修（放行前置，不需改代码）** —— 在生产库跑一次只读 `select count(*) from leads_activity;` 并做一次含该表的 `pg_dump`，把两条结果写进 `evidence/`；若行数 >0，先做「导出该表→归档→再删」的独立小迁移窗口。任一未做即视为 HIGH 未清。

### [HIGH] H2 迁移的真实执行通道与风险登记相反：生产不会自动执行、本地未记账，「下次部署自动落地」是错的

- 证据
  - 适配器只传了 `pool`：`apps/cms/src/payload.config.ts:240-244`（**无 `prodMigrations`、无 `migration`**）。
  - 生产分支要求显式传参才迁移：`@payloadcms/db-postgres@3.88.0 dist/connect.js:110`（`NODE_ENV!=='production' && push!=='false'` ⇒ dev 自动 push）、`:117-119`（`if (NODE_ENV==='production' && this.prodMigrations) await this.migrate(...)`）；`dist/index.js:81` 表明 `prodMigrations` 只能来自 args。
  - 全仓 `src/migrations` 无任何 import（Grep `from '...migrations'` → 0 命中）；`apps/cms/package.json` 只有 `payload` / `generate:importmap` / `generate:types`，**无 migrate 脚本**；`Dockerfile.cms:31,40` 为 `NODE_ENV=production` + `next start`，无迁移步骤。⇒ `Dockerfile.cms` 起的生产进程既不会 push 也不会 migrate。
  - payload 3.88 里 `autoRun` 只存在于 jobs（`payload/dist/index.js:239-242`），**没有** migrations.autoRun 这个东西。
  - 本地事实即反证：`payload_migrations` 只有 `1|20260825_131753|1` 与 `2|dev|-1`（实测 SELECT），盘上 `migrations/index.ts` 的两个名字都未记账；`payload migrate` 在该库被 Payload 自身数据丢失门禁拦停（`dev-log.md` §3.5 实录：`? It looks like you've run Payload in dev mode … data loss will occur … exit 143`），最终 `up` 是人工 `psql` 落的（同节）。
  - 与之冲突的本批陈述：`design.md:34`「R1 …（Payload 未关 `migrations.autoRun`）→ 将在下次生产部署自动执行」、`dev-log.md:307`「生产库将经 Payload 官方 migrate / prodMigrations 自动通道执行同一 up」。`docs/08-deployment.md:148` 只有一句「迁移（若有）+ 启动」，无可复制命令。
- 影响：(a) 生产库会继续保留 `leads_activity` ⇒ PROB-001「删死表」在生产侧**未交付**，schema 漂移长存；(b) 将来真要落地时，因基线未记账会先撞 `CREATE TABLE`（已存在）/ 门禁，落地方式仍然只能是人工 DDL —— 与本批风险登记的理由是错的，审查与发布判断被误导；(c) 任何 dev 机下次 `pnpm cms:dev` 由 push 静默删表（`connect.js:110-112`），无记账、无确认，这正是红线 7 想挡的形态，本批未给缓解。
- 处置建议：**本批必修（文档/门禁层，不必改业务代码）** —— 改正 `design.md` R1 与 `dev-log.md:307`；在 `docs/08-deployment.md` §7 第 4 步写明本迁移的**确切**执行方式（要么先接线 `prodMigrations`+`payload migrate` 并处理基线记账，要么显式「人工执行 up + 手工插 `payload_migrations` 行」）；否则把「删表」降级为另案 change（本批只删代码字段，迁移随接线窗口发布），并把 R1 的表述改为「未交付」。

---

## 2. MEDIUM

### [MEDIUM] M1 CORS fail-fast 的抛错点使 `err()` 自身可抛：缺 env 时 `/api/v2/*` 全线退化为框架级 500、空响应体、无统一信封（红线 4）

- 证据：`apps/cms/src/lib/envelope.ts:8-22` —— env 解析与抛错发生在 **`if (!origin) return null` 之前**，且在 handler 内每次请求执行；`corsHeaders` 被 `ok/err/OPTIONS` 三处调用（`:42`、`:47`、`:51`）。于是 `apps/cms/src/app/api/v2/leads/route.ts` 中 try 之外的 `err(...)`（`:39,43,52,53,54,57`）与 catch 内的 `err(...)`（`:123`）一旦执行即抛出 ⇒ Next 兜底 500。实测响应体 0 字节：`.aiws/tmp/cleanup-batch-20260919/cors-failfast-response.txt`（0 B），`tasks.md:51`（3.4）同记「500 且响应体为空」。`docs/08-deployment.md:101` 已承认 `/api/v2/health` 恒 500。附带影响：无 Origin 的服务端调用（Astro 构建期取内容、curl 探针）同样 500，不只是"跨端被拒"。
- 影响：不泄露堆栈（这点合规），但错误契约不统一 —— `VALIDATION/MISSING_PROJECT/LEAD_CREATE_FAILED` 等码在缺配置时全部不可达；REQ-0001「DB 异常返回 `LEAD_CREATE_FAILED`(500)」这条验收在该状态下不可能成立。
- 处置建议：本批最低要求 —— 在 `docs/08-deployment.md:101` 与 `tasks.md` 3.4 补一句「缺 env 时失败响应也不带信封」的已知后果（现在只写了 health 500）。把校验前移到模块加载/`payload.config` 启动期（使 `err()` 不被污染、且真·启动失败）属行为变更 → **另案**。

### [MEDIUM] M2 运行入口真值 `AI_WORKSPACE.md` 未同步：`health_check` 现在间接依赖新增的必需变量

- 证据：`AI_WORKSPACE.md:32-33`（`start_cmd: pnpm --filter cms dev`、`health_check: curl -f http://127.0.0.1:3000/api/v2/health`）；`apps/cms/src/app/api/v2/health/route.ts:3-4` → `ok()` → `corsHeaders` → throw。本批改动集不含 `AI_WORKSPACE.md`（`git status --porcelain` 12 改 + 未跟踪列表中无该文件），`AI_PROJECT.md` 同。
- 影响：新机器/新同事按 AI_WORKSPACE 起服务（`.env` 里没有该变量，因为它不在 git 里）→ 就绪探针永不转绿，`ws-dev`/`ws-bugfix` 的验证环节整体卡住或被人用假绿绕过；这与「配置先行」的初衷相反（配置先行的落点少了一处真值文件）。
- 处置建议：**本批必修（一行）** —— 在 `AI_WORKSPACE.md` 的 CMS 启动前置里点名 `PUBLIC_CORS_ORIGINS`（与 `.env.example:8` 同值）。

### [MEDIUM] M3 `leads-assign.spec.ts` 的级联删除断言是恒真断言

- 证据：造的 slug 为 `e2e-assign-a-${TS}` / `e2e-assign-b-${TS}`（`apps/e2e/tests/leads-assign.spec.ts:60-61`），而清理断言查询 `['slug','like', \`e2e-assign-${TS}\`]`（`:99`）—— 该串不是任一已造 slug 的子串，条件永假 ⇒ `toHaveLength(0)` 与「项目是否真被级联删净」完全无关。
- 影响：`Projects.beforeDelete` 级联若回归，这条不会发现（同 afterAll 的 `:97/:98` 只覆盖 leads 与 memberships，覆盖不到 projects 自身）。属于「看着有断言、实为空跑」。
- 处置建议：**本批必修（一行）** —— 改成两次 `equals` 或 `in` 枚举实际 slug；删掉即可，别留恒真式。

### [MEDIUM] M4 真值收敛把「漂移」修成了「过度声明」：13 条验收全勾，但被勾选内容有一部分无证据支撑，且证据指针文件不存在

- 证据：`REQUIREMENTS.md`（REQ-0001 6 条 + REQ-0002 7 条全部 `[x]`）两处结尾均写「复验证据：见 `.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md`」；实测 `ls .aiws/changes/cleanup-batch-20260919/evidence/` → 只有 `dev-log.md`（`tasks.md:58` 4.2 生成持久证据仍未勾）。不被本批任何用例支撑的条款示例：REQ-0002「字段均有中英双语 label」（无断言）、「看板展示待办提醒数量/清单」（Dashboard 零覆盖）、REQ-0001「DB 异常返回 `LEAD_CREATE_FAILED`(500)」/「`MISSING_PROJECT`」（新 spec 未造 DB 异常，且见 M1）。`.aiws/requirements/CHANGELOG.md:13` 同一指针。
- 影响：真值文件的可信度是这套流程的唯一货币；把「未验证」写成「已完成 + 已复验」会在下一次门禁（`check_evidence:false`，见 L4）中被当成既成事实。文档已 hedge（「不代表复验已完成」）这点是加分的，但路径本身失效。
- 处置建议：**本批必修（二选一）** —— 生成 `evidence/verify-before-complete.md` 并逐条写「沿用 2026-08-26 归档证据」vs「本批复跑」；或把指针改成真实存在的 `evidence/dev-log.md` 并把无证据条款退回 `[ ]`。

### [MEDIUM] M5 快照差集清理越界：可能删掉 cron 为**真实线索**生成的提醒，同时与 cron 存在 flaky 竞态

- 证据：`apps/e2e/tests/reminders.spec.ts:112-113`（`removeNew('reminder-notices'|'lead-activities', before)` 按「当前集合 − 快照」逐条 DELETE）；spec 自陈 `:29-32`「库里已存在一条全局 due 规则，扫描会顺带命中真实线索」；`apps/cms/src/lib/reminderCron.ts:23`（`*/30 * * * *`）+ `apps/cms/src/payload.config.ts:236-239`（`onInit` 常驻）。
- 影响
  1. cron 若恰落在 beforeAll 快照与 afterAll 之间，为真实线索新建的 notice/activity 会被当成本轮造数删掉 —— 共享 dev 库的静默数据损失（不涉生产，e2e 只打 `127.0.0.1:3000`）。
  2. 同一竞态的反向后果：`:125` `created>=2` 与 `:164` 第二次 `created===0` 依赖「规则创建到首次手动扫描之间 cron 不触发」，窗口约 1–2s / 1800s，低概率假红。
- 亮点（同一处的正向结论）：`SNAPSHOT_LIMIT=900` + `:222` `totalDocs <= SNAPSHOT_LIMIT` 断言确实防住了「快照被截断→差集漏删」；实测 payload 3.88 dist 无 `maxLimit` 钳制，`limit=900` 真实生效，此守卫有效。
- 处置建议：**另案（测试隔离）** —— 造数打 `RUN_TAG` 可按 where 精确过滤的记录就用 where 删，全局差集只用于本项目名下记录；或在测试窗口以 env 关闭 cron。本批可接受并记录。

### [MEDIUM] M6 缺凭据时整块静默 skip 且 exit 0 —— 本批 3 项交付（判重/只读/权限）在他人机器上可能一条都不跑

- 证据：`apps/e2e/setup/global-setup.ts:34-43`（缺文件或无 `e2e-admin` 只 `console.info` 后 return，明确「不抛错、不填默认值」）；describe 级 skip：`reminders.spec.ts:55`、`leads-assign.spec.ts:53`、`sites-clone.spec.ts:53`。`dev-log.md:543,682` 实测：移走 secrets → `35 passed / 23 skipped` 且 **exit 0** 被写成期望行为。
- 影响：`.aiws/secrets/` 不入库 ⇒ 换机器/换人默认就是 23 条 skip 的「绿」；PROB-004 声称补的覆盖在多数环境下不存在。
- 处置建议：**另案** —— 验证通道（`aiws verify-bc` / 任何 CI）以「skipped>0 ⇒ 不通过」为准，或把「凭据缺失」升为 verify 阻断；本批至少在 `tasks.md:46` 的命令注释里显式写明「23 skip 即为未覆盖」。

---

## 3. LOW

### [LOW] L1 凭据文件被整体重写：`writeSecrets()` 从硬编码字面量重建顶层结构（只追加不改写的教训未完全落实）

- 证据：`apps/cms/scripts/create-e2e-admin.ts:79-97` —— 新 JSON 的 `base_url/services/auth` 来自代码字面量，盘上唯一被继承的是 `accounts`（`:62-66` 仅 filter 掉 `e2e-admin`）。既有账号条目本身按引用保留（多余键也保留），但**任何不在该 interface 里的顶层键会被静默丢弃**。
- 正向：不打口令（`:136-140` 只打 `passwordSource=reused-from-secrets|freshly-generated` 与 `<见 .aiws/secrets/test-accounts.json>`）；口令优先复用不轮换（`:101-102`）；`git check-ignore -v` → `.aiws/secrets/`(`.gitignore:4`) 与 `apps/cms/.env`(`.gitignore:6`) 均不入库，且 `git ls-files` 无 `*secret*/*cookies*` 被跟踪。
- 残留卫生问题：`.aiws/tmp/cleanup-batch-20260919/secrets-before-rerun.json`（568 B 明文口令副本，虽 gitignored 但未随收尾清理）。
- 处置建议：本批顺手删该 tmp 快照（保留同目录 `secrets.sha` 即可）；重写语义改为读盘后仅替换 `accounts` 数组（另案亦可）。

### [LOW] L2 同一批内三份文案对 fail-fast 语义不一致

- `apps/cms/.env.example:7` 写「缺失即启动失败」，而 `tasks.md:51`(3.4) 与 `docs/08-deployment.md:101` 已修正为「首个 `/api/v2/*` 请求抛错，部署侧靠 `cms-run.sh` 的 `:?` 前移」。`apps/cms/src/lib/envelope.ts:5` 措辞中性。一行改 `.env.example`。

### [LOW] L3 台账缺口：`DATABASE_URI || ''` 兜底仍活着，D-5 声称的「登记」没落文件

- 证据：`apps/cms/src/payload.config.ts:242`（`connectionString: process.env.DATABASE_URI || ''` —— 与 PROB-002 同类的缺省兜底）；`design.md:30` 称「登记为后续独立 change」；但 `.aiws/issues/problem-issues.jsonl` 只有 PROB-000..007，`grep DATABASE_URI` → 0 命中。
- 处置建议：补一行 PROB-008（本批只登记，不改代码，范围纪律是对的）。

### [LOW] L4 范围外改动混入 + 门禁未覆盖

- 证据：`.aiws/memory-bank/.index.yaml`（+11 行）新增 `decision://analysis/chatwoot-offline`，正文文件 `.aiws/memory-bank/decision/analysis/chatwoot-offline.md` mtime **2026-08-31 12:46**，与本清理批无关；`metrics.json:28-135` 显示历次 strict validate 均 `check_evidence:false`、`check_scope:false` ⇒ 这类漂移与空证据路径都不会被 `aiws change validate --strict` 发现（与 H2/M4 互相放大）。
- 处置建议：提交时把 memory-bank 变更拆成独立 chore 提交，或在 handoff 说明其无关性；`verify-bc` 前打开 `--check-evidence/--check-scope` 复跑一次。

### [LOW] L5 站点复制的同类「404 不可达」缺陷未被任何用例暴露（PROB-005 只登记了一半）

- 证据：`apps/cms/src/collections/Sites.ts:72-75` 与 `Leads.ts:166-174` 完全同形（`findByID` + `overrideAccess` + 外层 `catch` → `Sites.ts:119-122` `SITE_CLONE_FAILED` 500）；而 `apps/e2e/tests/sites-clone.spec.ts:179` 的负例只覆盖 `{}`/`0`/`'x'`/`-1`，全部被 `:58` 的 `Number.isInteger` 早退挡掉，**没有「合法但不存在的 sourceId」**。
- 处置建议：本批补一条 expected-fail（与 `leads-assign.spec.ts:182` 同法），或在 PROB-005 的 Notes 里注明 sites/clone 同源。

### [LOW] L6 e2e 一次性账号口令与用户名同源（`Date.now()` 可推）

- 证据：`leads-assign.spec.ts:33-39`（`MEMBER_PASSWORD = \`E2emem!${TS}\``，同 `TS` 即用户名后缀）、`sites-clone.spec.ts:33-38` 同形。afterAll 删号（实测 `users` 无残留）；但 beforeAll 与 afterAll 之间用例中断即留下「用户名推得出口令」的 `operator` 账号在共享 dev 库。
- 处置建议：改 `randomBytes(12).toString('base64url')`；一行成本，本批顺手做更好。

### [LOW] L7 `test.fail(true, …)` 用法正确，且**不会**出现「缺陷修好后假绿」

- 证据：实测安装的 runner 含该语义串：`node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/lib/runner/index.js`（`"Expected to fail, but passed"`）⇒ 若 PROB-005/006 被修好，本批这两条会以「意外通过」变红，方向安全；代价是该套件与两个已知缺陷耦合成"红墙"，修缺陷时必须同步摘标记。
- 处置建议：接受并记录（在 PROB-005/006 的 Notes 里写明「修复时须同时移除 `leads-assign.spec.ts:182/194` 的 `test.fail`」）。

### 关于红线 2「禁止双写」的一处表述偏差（并入 L 级，不另计）

`problem-issues.jsonl` 的 PROB-001 把它定性为「双写残留」，但 `activity` 字段自始至终零读写（`afterChange` 唯一写入路径是 `lead-activities`，实测 `lead_activities` 20 行全为 `type=created`；`grep '\bactivity\b' apps` 无生产引用）—— 准确定性应是「死模型/无写入路径的可见字段」。删得对，标签偏一点。另：`Leads.ts:131-235` 与 `Sites.ts:26-124` 两个自定义端点手写 `{success,error}` 字面量、不复用 `lib/envelope.ts`，是同源的重复实现（先于本批，属另案）。

---

## 4. 正向确认（避免只报坏消息）

1. 删表爆炸半径预核是真的：实测 `information_schema` 中无任何他表外键引用 `leads_activity`，`pg_class` 中 `leads_activity%` 只有表 + 2 索引 + pkey；DROP 后其余 21 张表与业务行数未变（我复核 `leads=20`、`lead_activities=20` 均为跑测累积）。
2. `down` 与基线 up 逐对象镜像（`20260830_122948.ts:5,19-27,294,334-335` vs `20260919_093340_drop_lead_activity.ts:11-23`），结构层面可回滚。
3. 迁移文件名/顺序与 `migrations/index.ts` 一致（`import * as migration_20260919_093340_drop_lead_activity` + `name:'20260919_093340_drop_lead_activity'`，`.ts`/`.json` 同名成对，基线条目未被改写）。
4. `payload-types.ts` 再生成是纯减法（只删 `Lead.activity` 与 `LeadsSelect.activity`，无附带漂移）。
5. 三个新 spec 的断言强度总体是高的：判重（第二次 `created===0` + 两表 `toHaveLength(2)`）、扫描只读（5 字段逐项与扫描前快照比对 + 前置成立性自检 `:189-193`）、越权与副作用（负向后回读 owner 未变、`sites` 项目内恰 1 站）、`expectErr` 还断言「失败信封不得带 data」与「message 不含 `at (file:line:col)` 堆栈」。
6. `playwright.config.ts` 的 `fullyParallel:false / workers:1` 给出了可核查的根因注释（Payload `useSessions` 对 sessions 数组整体读-改-写回，并发登录互相顶掉 ⇒ 403），不是随手关并行。
7. 造数零残留已由我在库侧独立证实（见 §0 表）。

---

## 5. 未验证 / 存疑（只读约束下无法确认，不做猜测）

1. **生产库状态全部未验证**：`leads_activity` 行数、是否含历史录入、`payload_migrations` 记账内容、是否存在含该表的可用备份、线上 `PUBLIC_CORS_ORIGINS` 是否已注入 —— 均不可查（约束只允许连 `127.0.0.1:5434/juece_grow`）。H1/H2 因此只能按「未核实即 HIGH」定级。
2. **`.aiws/secrets/test-accounts.json` 内容未读**：L1 的「顶层键是否真的丢过」无法证实。间接线索：`secrets-before-rerun.json` 与 `test-accounts.json` 同为 568 B（仅说明两次跑测之间未变化），`.aiws/secrets/test-accounts.example.json` mtime 2026-08-21（早于本批）。
3. **`apps/cms/.env` 未读**（凭据约束）。推断依据：C5 五例（`security.spec.ts:193-216`）与三新 spec 需管理员/白名单同时成立才可能全绿；`dev-log.md` §5.4 的负向对照显示该值来自 `.env`。
4. **`down` 未在任何库执行过**：只核对过 SQL 文本与基线一致性，未验证真实重建（不允许 DDL）。
5. **`pnpm --filter cms build` 未由我复跑**（会写 `.next`）；`aiws validate .`（仓库级）本批无工件（见 §0 末行），两者均以「日志/间接证据可采信但未独立复现」记录。
6. **Astro 侧受影响的实际调用面未逐一验证**：`apps/astro` 用 `PUBLIC_CMS_ORIGIN` 服务端取内容（无 Origin 头 ⇒ 配置齐全时 `allowedOrigin` 返 null 仍 200，符合预期），但三站生产留资链路（M1 的「缺配置即 500」）只在 `tasks.md:66`(5.3) 列为发布后人工回归项，本批未执行。
7. **两个 expected-fail 用例在真实库里是否"永远为真"式失败**：我已确认 `x` 状态与 `Leads.ts:166/221/229` 源码形态一致，也确认 Playwright 语义不会假绿（L7），但未实跑「人为修好」的正向对照。

---

## 6. 放行建议（给主 session 的 triage 清单）

- 合入前必须收口的本批必修项：**H1（线上行数+备份两项实证）→ H2（更正 R1/dev-log 的执行通道表述并给出可复制落地方式）→ M2（AI_WORKSPACE 一行）→ M3（一行断言修正）→ M4（证据文件或退回未勾）→ L2/L3/L5/L6 顺手项**。
- 可另案：M1 的校验前移、M5 的测试隔离、M6 的 CI/skip 门禁、L1 的凭据文件读改写、L4 的 validate 开关、`sites/clone` 与 `leads/assign` 的错误映射（PROB-005 独立门禁 + 双审查）。
- 本批不需要为此改代码的部分：H1/H2 的实质是「发布前置 + 风险陈述诚实性」，M2/M3/M4 是文档与断言一行级修正 —— 全部落在 quality-review 之后的同一轮 dev-lite 修补即可清 HIGH。

---

## 主 agent 处置（triage）

本报告的逐条处置（含已修 / 另案 / 驳回及反证）见 `../evidence/verify-before-complete.md` §E；已核实的事实性更正：生产不会自动跑迁移（`connect.js:116` 要求 `prodMigrations`）已写入 design R1 与 tasks §5.5。

---

## 7. 2026-09-20 追加审查轮（GATE-005 修复轮：PROB-005/006 合并落地）

> 本节由提交后独立审查（`735bc09`）产出，主 session 逐条自己回码核实后落盘。
> **上一节的判定不覆盖本轮**：本文件与 `spec-review.md` 最后一次改动停在 `e14c684`，全文对 `PROB-015` / `PROB-016` / `2026-09-20` 零命中，而 `proposal.md` 一直把这两份 review 当本 change 的持久证据 ⇒ 「审计写路径变更（P1）需独立门禁 + 双审查」当时是空签。本轮补：门禁 `docs/gates/GATE-005-assign-clone-error-and-audit-fix.md` + 本节 + `spec-review.md` §6。
> 方式：只读审查 + 主 session 自己复跑（`npx tsc --noEmit` `78-tsc-reviewfix.log` exit=0；全量 e2e `79-e2e-reviewfix.log`；库侧残留 `80-db-after-reviewfix.txt`）。未连线上、未改数据。

### 7.1 判定

**PASS（本轮必修项已收口）** — 本轮处置：**代码 3 处**（`Memberships.ts:42-49`、`Users.ts:41-49` 级联透传 `req`；`Leads.ts:183-189` 删恒真二次校验含其 import）、**测试/注释 3 处**（`leads-assign.spec.ts` 新增级联审计用例、actor 用例改自足、正向注释按实际钉法改写）、**工件 4 处**（`docs/gates/GATE-005-*`、本文件 §7、`spec-review.md` §6、`evidence/` 四件）、**文字级 1 处**（`dev-log.md §8.7` 计数笔误）；**登记另案 6 条**（PROB-017..022）；**驳回 0 条**（审查者每条主张都在码上找到落点，其中 2 条我核出更精确的边界，见 7.2 的 #4/#7）。

### 7.2 逐条与处置

| # | 发现（审查者提出 → 主 session 核实） | 处置 | 证据 |
|---|---|---|---|
| 1 | **HIGH：P1 审计写路径变更没有任何审查/门禁工件覆盖**（review 两份停在 `e14c684`；`docs/gates/` 只有 001..004；`verify-bc` 只查文件在盘 ⇒ 报 `ok` 属空签） | **本轮修**：立 GATE-005 + 补本节 + `spec-review.md` §6；PROB-005/006 台账 Notes 指向 GATE-005 并去掉重复归因 | 本文件、`docs/gates/GATE-005-*.md`、`.aiws/issues/problem-issues.jsonl` |
| 2 | `access.ts:112/118/141-142/152` 三处 `findByID` 未关默认抛错却写 null 分支 ⇒ 恒不可达死兜底（§4），越权探测状态码失真为 500；fail-closed 未破（抛错即拒绝） | **另案 PROB-020**（权限语义改动需独立门禁，不与清理批混做）。核实补正：审查者列的 4 个定位中 `:118-119` 是 `users` 查询、`:141-142` 与 `:152` 同属一个函数，条数应为「三处调用、四行分支」 | `apps/cms/src/access.ts:112,118,141,152`、`payload/dist/collections/operations/findByID.js:105-109` |
| 3 | 「本地 API 写未透传 `req` 丢审计」还有第三、四实例：`Memberships.ts:42`、`Users.ts:42` 级联清主 | **本轮修**：两处透传 `req`；新增 e2e 用例钉住「成员被移除 → 清主动态 actor=发起人」 | `79-e2e-reviewfix.log`（61 tests / 59 passed / 2 skipped / exit=0）、`80-db-after-reviewfix.txt`（`lead_activities` 中 `type=assigned AND actor_id IS NULL` = 0） |
| 4 | 级联清主被记成 `type=assigned`、`detail=已分配跟进人` | **另案 PROB-018**：`LeadActivities.type` 无 `unassigned` 档（`LeadActivities.ts:50-56`），加档位＝改 Postgres enum ⇒ 按 §7 另批。本轮测试按 `meta.owner===null` 选行并注释写明不为该标记背书。**核实补正**：审查者称「误标 + 丢审计」是一体，实际可分开——审计本轮已修，标记需迁移 | `apps/cms/src/collections/Leads.ts:92-100`、`LeadActivities.ts:50-56` |
| 5 | `Leads.ts:184` `!memberCanWriteProject(...) \|\| !isProjectMember(...)` 第二项恒真（写角色 ⊆ 成员）且多打一次 memberships 查询 | **本轮修**：删第二项与 `isProjectMember` import，留一行「写角色 ⊆ 成员」说明。语义核对：assignee 是否本成员由 `:206-225` 单独校验，未放宽；`leadScopedWrite` 走的是另一个函数 `isProjectMemberOf`，未受影响 | `apps/cms/src/access.ts:49-58`、`apps/cms/src/collections/Leads.ts:183-189,206-225` |
| 6 | 超 int4 的 `leadId`（`2147483648`）仍回 500，却被本轮当作「500 分支未死」的证据 | **另案 PROB-017**（P3）。该探针作为「500 分支活着」的证据成立（确实进了 catch 且日志留痕），但作为语义它暴露的是缺上界校验——文档不再把它当正向证据引用 | `61-assign-500-branch-probe.log`、`Leads.ts:152` |
| 7 | 「catch 不留痕」只在这两个端点治，`/api/v2/*` 另有 6 处静默 500 | **另案 PROB-021**：留半套口径比统一缺失更难查，须一次扫全。核实：`grep -rn logger.error apps/cms/src` 仅 `Leads.ts:248`、`Sites.ts:130` 两处命中，审查者列的 6 处行号逐条存在 | `apps/cms/src/app/api/v2/{content/articles/route.ts:124,reminders/run/route.ts:21,webhooks/chatwoot/route.ts:83,117,stats/leads/route.ts:213,leads/route.ts:122}` |
| 8 | 两端口点手写信封约 22 处、未复用 `lib/envelope.ts` 的 `ok/err`（§4 双写），且这两条路径不在 `/api/v2/*` 下 | **另案 PROB-022**：复用 envelope 会同时改这两个端点的全部响应头与状态码语义，需独立验证；是否迁 v2 也要先定 | `apps/cms/src/lib/envelope.ts:39-49`、`Leads.ts:138-252`、`Sites.ts:34-134` |
| 9 | `dev-log.md §8.7` 首行「4 处产品代码 + 3 个 spec」与 `git show --stat` 不符 | **本轮修**（文字级）：产品代码本轮实为 4 处 + 另 2 处级联（#3）、spec 2 个 | `git show --stat 735bc09`、`evidence/dev-log.md §8.7/§8.8` |
| 10 | 「钉不住」的三个口子：`depth: 0` 的键集断言其实钉不住（只有 `typeof owner` 钉得住）、actor 用例复用前一个用例的副作用、500 分支无自动化用例 | **本轮修前两项**：注释按实际钉法改写；actor 用例改为自足（自己建线索、自己调端点）。第三项**接受不做**——注入真实库异常需要破坏库，改由 `61` 手工探针 + PROB-017/019 台账守住，并在 `verify-before-complete.md` 明说这是人工证据 | `apps/e2e/tests/leads-assign.spec.ts`（正向注释 + 「审计：端点分配写出的动态带发起人 actor」用例）、`evidence/verify-before-complete.md §A-20/§A-22` |

### 7.3 回归保护实测（本轮复跑，不采信自述）

* `npx tsc --noEmit -p tsconfig.json` → `exit=0`（`78`），覆盖 `Memberships.ts`/`Users.ts`/`Leads.ts` 三处改动。编辑定格后复跑 `81-tsc-reviewfix2.log` 同 `exit=0`。
* 全量 `pnpm --filter e2e test` → `Running 61 tests using 1 worker` → **`59 passed (1.1m)` / `2 skipped`、`exit=0`**（`79`）。较上轮 +1 用例（级联审计），两条 skip 仍是 C7 缺 `CHATWOOT_WEBHOOK_SECRET`。定格后复跑 `82-e2e-reviewfix2.log`：`59 passed (20.1s) / 2 skipped / e2e_exit=0`（同结论）。
* 库侧（首版 `80`，定格后改为带列名单行探针 `83`）：`e2e_leads=e2e_sites=e2e_projects=e2e_users_nonadmin=memberships=reminder_notices=0`、`assigned_actor_null=0`（本轮修的审计留痕）、`leads_activity_table=0`；`leads_total` 63→67，增量全部来自仍 OPEN 的 PROB-007，本批三个新 spec 零残留。
* 退出码一律由命令本身直接写入日志末行（`tsc_exit=` / `e2e_exit=` / `psql_exit=`），**不过管道**——上一轮的 `$?`-after-pipe 假绿教训（dev-log §8.7）已固化为本轮做法。
* 收尾回收两个 dev 进程树，`netstat` 对 `:3000`/`:4321` 监听计数 0。
