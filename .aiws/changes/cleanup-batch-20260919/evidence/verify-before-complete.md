# Verify-before-complete 证据：cleanup-batch-20260919

> 收口日期：2026-09-19 ｜ 环境：**仅本地 dev/test**（Docker `juece-grow-postgres` @127.0.0.1:5434，库 `juece_grow`）
> 结论适用范围：本文件只证明**工作树/本地**状态。**线上（juece.cloud 服务器）本批未执行任何操作**，见 §D。

## A. 已实测的验证命令与真实输出

| # | 命令（仓库根，零手填参数） | 实测结果 | 证据文件 |
|---|---|---|---|
| 1 | `pnpm --filter cms build` | `exit=0`；`✓ Compiled successfully in 11.8s`；`Running TypeScript` 无错误；`✓ Generating static pages (10/10)`；路由表含 `ƒ /api/v2/reminders/run`，日志无扫描/cron 输出 ⇒ 构建期不启动定时器。**台账轮复跑（覆盖最终树）**：`exit=0`、`✓ Compiled successfully in 14.7s`、`Finished TypeScript in 3.6s`、`✓ Generating static pages … (10/10) in 5.1s`，路由表同样含 `ƒ /api/v2/reminders/run` | `.aiws/tmp/cleanup-batch-20260919/cms-build.log`、`10-pnpm-filter-cms-build.log` |
| 2 | `cd apps/cms && npx tsc --noEmit -p tsconfig.json` | `exit=0`（含新增 `scripts/create-e2e-admin.ts`）；工件内只有 2 行 npm 配置告警（`Unknown env config "devdir"`），**无任何 TS 诊断** | `.aiws/tmp/cleanup-batch-20260919/11-cd-apps-cms-npx-tsc-noEmit-p-tscon.log` |
| 3 | `pnpm --filter e2e test`（前置 `pnpm db:up` + CMS dev :3000 + `pnpm astro:dev` :4321） | `Running 58 tests using 1 worker` → **`56 passed` / `2 skipped`**；跳过项为 C7 Chatwoot（缺 `CHATWOOT_WEBHOOK_SECRET`，沿用既有凭据条件 skip 约定）；2 个 `x` 为 expected-fail（PROB-005/006），**不是**新增回归。台账轮（21:44，端口预检 + 双服务就绪轮询 + 路由预热后）：`56 passed (29.3s)` / `2 skipped` | `.aiws/tmp/cleanup-batch-20260919/e2e-final-2.log（20:17）`、`20-pnpm-filter-e2e-test.log（21:44，覆盖最终树）`、`00-warmup.txt`、`00-health-probe.txt` |
| 4 | 同一命令在最终树上**连跑多轮** | 绿轮：20:17、21:38（`56 passed (51.5s)`）、21:44 ⇒ 结果一致、无 flaky；第三个 spec 的 `afterAll` 断言（快照差集回滚）每轮通过。**唯一红轮 21:28**：3 例 `lead.spec.ts` 超时（`page.goto(WEB_ORIGIN/)` 与 `request.post(/api/v2/leads)`），定位后判定为 dev 冷编译而非功能回归：`next dev`/Turbopack 只在首次请求时编译路由，同一路由 `/api/v2/content/articles` 的一次冷编译实测耗时 **48.3s**，超过 `playwright.config.ts:7` 的 `timeout: 30_000` 用例预算。加入「就绪轮询 + 预热各路由」后连续两轮 56 绿。⚠️ 48.3s 这个数字是当场观测，其 scratch 文件已被后续干净轮次覆盖；红轮日志与两个绿轮日志在盘可核 | 红轮：`discarded-run1-e2e-coldcompile.log`（保留）；绿轮：`20-pnpm-filter-e2e-test.log` |
| 5 | `psql -tAc "select count(*) from information_schema.tables where table_name='leads_activity'"` | `0` ⇒ 死表在本地已删（台账轮合并探针 `14-docker-exec-juece-grow-postgres-ps.log` 第 4 位亦为 `0`） | 本文 §C、`.aiws/tmp/cleanup-batch-20260919/14-docker-exec-juece-grow-postgres-ps.log` |
| 6 | `psql` 残留核查（`e2e提醒%`/`e2e分配%`/`e2e站点%` 三组造数） | 全部 `0`；`projects=3`、`memberships=0`、`sites=0`、`reminder_notices=0`、`reminder_rules=1`（既有全局规则）、`users=3`（含 `e2e-admin`）⇒ **本批新增的三个 spec 零残留**。合并探针逐位 `0\|0\|0\|0\|3\|3` = e2e 线索残留 / e2e 站点残留 / 通知表总数 / 死表存在数 / users / projects，**两次取数一致**：台账 phase A（该轮 e2e 之前，`14-…ps.log`）与最后一轮 e2e 之后（`22-db-after-final-e2e.txt`）。⚠️ 口径边界：`lead.spec.ts` 的提交类用例造数名是「烟测用户/API 烟测」，`e2e%` 前缀检索**看不到**它们——当场计数 `leads_total=39 / leadspec=19 / activities=39`，即 PROB-007 的不自清仍在扩大，本批不修、已登记，不计入本行的“零残留” | 本文 §C、`14-docker-exec-juece-grow-postgres-ps.log`、`22-db-after-final-e2e.txt` |
| 7 | CORS fail-fast 负向：`PUBLIC_CORS_ORIGINS= pnpm --filter cms dev` + 带 `Origin` 请求 `/api/v2/content/articles?site=juece` | 客户端 `http_status=500` 且**响应体为空**（不外泄堆栈）；服务端日志第 29 行 `Error: PUBLIC_CORS_ORIGINS 未配置或为空：CORS 白名单无内置默认…` | `.aiws/tmp/cleanup-batch-20260919/cors-failfast-dev.log`、`cors-failfast-response.txt` |
| 8 | 收口门禁序列（所有编辑定格后依次执行）：`aiws change sync cleanup-batch-20260919` → `aiws validate . --stamp` → `aiws change validate cleanup-batch-20260919 --strict` | 三条全绿：`✓ aiws change sync`（`Changed files: - REQUIREMENTS.md`，即把本批真值改动纳入基线，stamp `20260919-131507Z`）；`✓ aiws validate: F:\juece-grow`（stamp `20260919-131511855Z`）；`ok: change validated (cleanup-batch-20260919)` `exit=0`。**第二遍（写完 §A-8/§A-13 与 tasks 勾选之后再跑一次，证明门禁覆盖最终树）**：`change sync` → `No changes detected vs baseline.`（stamp `20260919-131922Z`）、`validate . --stamp` 绿（`20260919-131926668Z`）、`--strict` `exit=0`、`change tasks validate` → `✓ tasks.jsonl is valid (no DAG issues)`；并逐文件比对 sha256：`AI_PROJECT.md=41ef47fd…`、`AI_WORKSPACE.md=6cf3bd87…`、`REQUIREMENTS.md=5d3db0a6…` 与 `.ws-change.json` 记录值（`baseline_at=2026-09-19T13:19:22Z`）**全部 MATCH**（无 H2 所指的真值漂移）。**第三遍（PROB-012 计划/提案同步与 §8.4 文档收口之后再跑）**：`change sync` → `No changes detected vs baseline.`（stamp `20260919-141603Z`）、`validate . --stamp` 绿（`20260919-141605231Z`）、`--strict` → `ok: change validated` `exit=0`、`change tasks validate` → `✓ tasks.jsonl is valid (no DAG issues)` | `.aiws/tmp/cleanup-batch-20260919/gates-final.log`、`gates-final-2.log`、`.aiws/tmp/change-sync/20260919-{131507,131922,141603}Z-*.json`、`.aiws/tmp/aiws-validate/20260919-{131511855,131926668,141605231}Z.json` |
| 9 | `pnpm --filter cms exec payload run scripts/create-e2e-admin.ts` 重跑幂等性 | 输出 `updated users/8 ... passwordSource=reused-from-secrets`，口令未轮换、账号未翻倍、口令未打印 | 手工核对前后 secrets 快照 |
| 10 | 凭据泄漏扫描（口令明文在全部 git 可见文件中检索） | `CLEAN: 口令明文未出现在任何 git 可见文件`；`git check-ignore` 确认 `.aiws/secrets/test-accounts.json` 与 `apps/cms/.env` 均不入库 | `.aiws/tmp/cleanup-batch-20260919/scan-cred-leak.mjs` |
| 11 | `node scripts/backup.mjs`（不带任何连接串） | `exit=1` + `[backup] 缺少数据库连接串：传 --uri ... 或设置环境变量 DATABASE_URI。不提供内置默认…` ⇒ 无内置默认、不会备份到非预期的库 | `.aiws/tmp/cleanup-batch-20260919/backup-failclosed.log`、`12-node-scripts-backup-mjs.log`（台账轮逐字重跑一致） |
| 12 | `node scripts/backup.mjs --uri 'postgres://juece:SECRETpw999@127.0.0.1:5434/juece_grow'` | `exit=1`，报错行只回显 `postgres://juece@127.0.0.1:5434/juece_grow（口令已隐去）`；台账轮对**新生成**的 stdout+stderr 合并工件再测一次 `grep -c SECRETpw999` = **0** ⇒ 口令不进 stdout/stderr（cron 邮件与日志不再带出） | 同上、`13-node-scripts-backup-mjs-uri-postgr.log` |
| 13 | `aiws change validate cleanup-batch-20260919 --strict --check-evidence --check-scope`（加强门禁，默认 `--strict` 不含这两项） | 首轮 `error: out-of-scope files detected …`（20 条）+ `scope is too broad (18 items > 12)` ⇒ 根因不是越界改动，而是 plan 的 `## Scope` 写法不被解析（见 PROB-011）。改写为机读 allow-list 后复跑：`exit=2`，残留报告项里除 `.aiws/memory-bank/` 两条外还混入 3 条 `.aiws/.aiws/**`——那是**我自己的 scratch**（脚本把仓库根算少一层，写到了 `.aiws/.aiws/`；未跟踪且不在 gitignore 内 ⇒ 被 scope 检查当成本批改动的文件）。删掉该目录后**第三轮（决定性）**：`exit=2`，越界清单**只剩** `.aiws/memory-bank/.index.yaml` 与 `.aiws/memory-bank/decision/analysis/chatwoot-offline.md`——两者是你在先（8-31）的产物，本批不认领、不 stage（spec-review L3）。⇒ 本批实际改动的每一个文件都在 allow-list 内，范围由工具校验过；scratch 必须写在 gitignore 覆盖的路径下这一条已并入 PROB-011 Notes | `.aiws/tmp/cleanup-batch-20260919/gates-final.log`、`21-check-scope-after-scratch-cleanup.log` |
| 14 | 机器可核验台账本身：`evidence/verification.jsonl`（生成器 `.aiws/tmp/cleanup-batch-20260919/run-verification.mjs`，补记脚本 `rerun-scope-gate.mjs`、`probe-db-after-e2e.mjs`、`run-cold-e2e.mjs`、`final-tree-rerun.mjs`） | **24 条记录，全部 `status=success`**，字段按 verify-bc M5 门禁要求（`command / exit_code / status / started_at / finished_at / artifact`，负向用例另带 `expected_exit_code`）。覆盖：build / 类型 / 两条 backup 负向（`exit=1` 才是通过）/ 两组库侧探针 / `plan-verify` / `validate --stamp` / `--strict` / `--strict --check-evidence --check-scope`（`exit=2` 才是通过）/ `tasks validate` / 端口空闲预检 / 双服务就绪轮询 / 路由预热 / 全量 e2e / 冷启动复跑（§A-15）。逐条时间戳与工件路径一一对应，可离开本文档独立复核。**首版台账作废**：原因见 §A-13 的仓库根少一层，其 4 条“失败”全属该缺陷而非产品缺陷，已修脚本后整体重跑 | `evidence/verification.jsonl`、`.aiws/tmp/cleanup-batch-20260919/{10..24}-*` |
| 15 | **冷启动复跑（PROB-012 的修复证明）**：`rm -rf apps/cms/.next` → 起 CMS/Astro dev → 编排脚本**只等 TCP listen、不预取任何路由** → `pnpm --filter e2e test` | `exit=0`、**`56 passed (1.2m)` / `2 skipped`、0 failed**。预热全部由被测套件自己完成：`globalSetup` 打出 4 行预热，其中 `http://127.0.0.1:4321/ -> 200 (41753ms)` —— 即缓存真空时首路由确有 ~42s 的编译要付，付在 globalSetup 里就不占 30s 用例预算（对照 §A-4 的 21:28 红轮）。跑完 `netstat` 复查 `:3000`/`:4321` **LISTENING 计数 0** ⇒ 进程树已回收，不留幽灵服务 | `.aiws/tmp/cleanup-batch-20260919/23-cold-start-setup.txt`、`24-cold-e2e-selfwarm.log`、`24b-cold-warmup-lines.txt`；台账第 22–23 条 |
| 16 | **收口轮（所有编辑定格后，含 `playwright.config.ts` 注释与文档同步）**：`pnpm --filter e2e test` → `aiws verify-bc cleanup-batch-20260919` → `aiws change validate … --strict --check-evidence --check-scope` → `node check-evidence-path.mjs` | e2e：`Running 58 tests using 1 worker` → **`56 passed (58.8s)` / `2 skipped`、`exit=0`**（台账第 24 条，工件 `25-e2e-final-tree.log`）。verify-bc：`ok: all gates passed (tier=strict)`、`exit=0`，且 **`legacy evidence assumed` 这条 warn 已消失**（grep 计数 `0`，工件 `27-verify-bc-final.log`）⇒ 本批验证脱离"人手写的表"。加强门禁：`exit=2`，越界项仍只有 `.aiws/memory-bank/` 两条（用户在先产物，本批不 stage），工件 `26-scope-gate-final.log`。`Evidence_Path`：重写为 10 项后逐项在盘存在、**死链 0**（PROB-013 的处置核对）。**文档同步后再复跑一遍全套**：`plan-verify` 绿、`validate . --stamp` 绿（`20260919-142542812Z`）、`--strict` `exit=0`、`tasks validate` 绿、加强门禁 `exit=2`（仍只 memory-bank 两条，`28-scope-gate-docsync.log`）、`verify-bc` `exit=0` 且 `legacy evidence assumed` 计数 `0`（`29-verify-bc-docsync.log`） | `.aiws/tmp/cleanup-batch-20260919/{25-e2e-final-tree,26-scope-gate-final,27-verify-bc-final,28-scope-gate-docsync,29-verify-bc-docsync}.log`、台账第 24 条 |
| — | 备份**成功**路径 | **本地不可验证**：`which pg_dump` 无输出（本机未装 pg_dump）。只验了上面两条负向路径；成功路径待线上首跑人工确认（见 §F-6）。台账里**没有**这条记录——缺记即“未验证”，不写成 success | — |

## B. AGENTS.md §9 自检清单

- [x] 命名三层映射：业务/接口 camelCase（`nextFollowUpAt`/`assigneeId`/`sourceId`），Postgres snake_case（`created_at`/`lead_id`）；新增代码 grep 无 snake_case 泄漏进业务层。
- [x] 未引入外部 CMS / 新依赖：`git status --porcelain -- '*package.json' pnpm-lock.yaml` 为空。
- [x] API 统一信封：新增断言全部走 `{success,data}` / `{success,error:{code,message}}`（`expectOk`/`expectErr` 含「失败信封不得带 data」「不泄露堆栈」两条硬断言）。
- [x] SEO 字段无回归：本批未改 `apps/astro/**`（Out of Scope 生效）；C1/C3 公开投影用例仍绿。
- [x] 线索主数据仍在自有 Postgres：仅新增读写自有库，Chatwoot 侧未改（C7 用例行为不变）。
- [x] 自研文件 ≤1000 行：最大 `reminders.spec.ts` 236 行；`Leads.ts` 由 414 降到 380。
- [x] 无兜底/双写/兼容写法：删 `DEFAULT_CORS_ORIGINS`（本批目标）、`Leads.activity`（双写残留）、`scripts/backup.mjs` 的内置 `DEFAULT_URI` 连接串（含明文口令，改为 `--uri`/`DATABASE_URI` 必给其一，否则 `exit=1`，见 §A-11）；剩余同类兜底 `payload.config.ts:242` 已登记 PROB-008 另案，理由见 design D-5。
- [x] 影响范围已说明：见 `proposal.md` §影响范围（含 3 处越界补记与理由）。

## C. 数据侧事实（本地）

- 迁移文件 `apps/cms/src/migrations/20260919_093340_drop_lead_activity.ts`：`up` = `DROP TABLE "leads_activity" CASCADE` + `DROP TYPE enum_leads_activity_type`；`down` 完整重建枚举/表/FK/两个索引（回滚路径存在，**未在本地实测回滚**，见 §F-3）。
- 本地 `leads_activity` 删除前后计数均为 `0`（无数据丢失面）。
- 本地 `payload_migrations` **不含**该迁移行：Payload 自带的迁移命令被其 dev-push 数据丢失门禁拦停（表内是 `batch=-1` 的 `dev` 行，盘上基线 `20260830_122948` 从未记账），未绕过门禁，改为以 `psql -v ON_ERROR_STOP=1` 单事务执行该迁移自身的 `up` DDL。风险与处置见 tasks §6.1（R5）。

## D. 本地 vs 线上：分层结论（勿混淆）

| 事项 | 工作树/本地 | 线上 |
|---|---|---|
| 死字段与死表清理 | 已完成并实测（计数 0、类型再生成、build/tsc 绿） | **未执行**：`leads_activity` 仍在线上 |
| 迁移在生产如何生效 | — | **不会自动生效**：`@payloadcms/db-postgres/dist/connect.js:116` 要求 `NODE_ENV=production && prodMigrations`；`payload.config.ts` 的 `postgresAdapter({ pool })` 未传 `prodMigrations`，全仓亦无 `migrations.autoRun` 配置 ⇒ 需维护窗口显式 `payload migrate`（连带跑所有待执行迁移，先做 tasks §5.1/§5.4 核实与备份） |
| CORS fail-fast | 已实测（缺 env → 首个请求 500，报错点名变量） | **未验证**；`scripts/cms-run.sh` 的 `${PUBLIC_CORS_ORIGINS:?}` 会在部署阶段先挡住漏配 |
| e2e 56 绿 | 本地 dev 库实测 | 未在线上跑（线上不应跑写库用例） |

> 本批把「线上不自动迁移」这一事实**纠正**了 design/proposal/plan 里原先「下次部署自动执行」的错误断言（来源：双审查 H2 → 以适配器源码复核）。风险性质随之改变：从"可能误删线上数据"变为"死表长期残留 + 手工迁移时需先核实"。

## E. 双审查 triage（本批按高风险处理：schema 迁移）

审查报告：`review/quality-review.md`（判定 PASS_WITH_CONCERNS，HIGH 2）、`review/spec-review.md`（判定 BLOCK，HIGH 2 / MED 6 / LOW 4）。逐条处置：

**已在本批修掉（含证据）**
1. [H2·两轴同报] 迁移在生产不会自动执行，而 design/proposal/plan 三处断言相反 → 已按源码证据改写（design R1、proposal BREAKING+R1、plan R1、tasks §3.4 语义）。
2. [S6/H6] `.env.example` 与 R2 把失败说成「启动即崩」→ 改为「首个 `/api/v2/*` 请求 500，客户端无堆栈；部署期由 `cms-run.sh` 的 `:?` 前移拦截」。
3. [S4] `AI_WORKSPACE.md` 缺本仓验证入口、`playwright_test_cmd` 指向错误位置（`cd {web_dir} && pnpm playwright test` 跑不通）→ 补 `build_cmd`/`server_test_cmd`/`astro_build_cmd`/`gate_cmd`/`e2e_prerequisites`，`playwright_test_cmd` 改 `pnpm --filter e2e test`。（`base_url`/`health_check` 已是 3000，非审查者所称 8080——已核对。）
4. [S1] 归因链断裂属实但**不能手改**：`AI_PROJECT.md` 第 20/21/33/58/101 行把归因入口写成 `.csv`，本仓实际只有 `.jsonl`（`ls` 核实无 CSV）。直接改为 `.jsonl` 后 `aiws validate .` 报 `block sha256 mismatch: AI_PROJECT.md (ai-project:core)`——这些行位于 `AIWS_MANAGED_BEGIN:ai-project:core`（第 3–103 行）托管块内。⇒ 已回退该文件并登记 **PROB-009**（正解：`aiws update`/模板升级，或 owner 决定改托管内容）。
5. [Q-H5] `leads-assign.spec.ts` 删项目后的 `slug like` 计数断言恒真 → 改为按 id 实读断言 `404`（不依赖 `like` 包装语义）。
6. [Q-M4 / 复核 H1] `create-e2e-admin.ts` 写凭据文件的缺陷：原实现用硬编码形状整体重写 `test-accounts.json`（未知顶层键会被丢弃）且单步 `writeFileSync` 非原子。**首轮仅落了条目唯一性校验，本条曾被我写成「已修」** ⇒ 现按声明补全并实测：`readSecrets()` 单次读取 → 保留全部既有顶层键、只替换 `accounts` 内本脚本那一条（骨架仅在文件不存在时使用）→ `writeFileSync(tmp, …, { mode: 0o600 })` + `renameSync` 落盘。实测（`cms-build-3.log` exit=0）：注入探针顶层键 `__probe_keepme` 后重跑脚本，探针键存活、口令未轮换、其余内容与跑前深比对 `true`、无 `.tmp` 残留，随后摘除探针键并复核文件与原始内容逐字节一致。
7. [S3 部分] 工程治理项无 REQ 绑定 → 在 `REQUIREMENTS.md` Backlog 下注明此类走问题台账（PROB-001..013），按 §3.1「问题修复」归因，不虚构 REQ。
8. 台账状态：PROB-001..004 → `DONE`（附实测说明）；新增 PROB-005（assign 500/404 死分支）、PROB-006（分配丢审计 actor）、PROB-007（`lead.spec.ts` 无自清）、PROB-008（`DATABASE_URI || ''` 兜底，design D-5 已给不在本批修的理由）、PROB-009（`AI_PROJECT.md`/`REQUIREMENTS.md` 托管块内的 `.csv` 归因漂移，手改会撞 sha256 门禁）、PROB-010（`scripts/backup.mjs` 内置连接串兜底 → **本批内已修并实测**）、PROB-011（`aiws --check-scope` 的四处机读约束，在为 H2 补真跑门禁时发现，第 (4) 条来自本轮把 scratch 写到 gitignore 之外）、PROB-012（e2e 在 dev 冷缓存下首跑必假红 → **本批内已修并实测**：`global-setup.ts` 预热 + origin 收敛）、PROB-013（`aiws change evidence` 非幂等：重复运行把新盖戳工件累加进 `Evidence_Path` ⇒ 重复工件 + 死链；**本批已就地清理并核死链 0**，工具侧正解另案，见 `follow-ups.md`）。
9. `tasks.md` §3.1–3.4 由「期望」改写为「实测输出」，§2.7–2.9 勾选；§5/§6 的开放项（生产前置 + PROB-005..011、013 + R5）已从勾选台账移入 `evidence/release-prerequisites.md` 与 `evidence/follow-ups.md`，勾选态只留一套真值。
10. [Q-M6] 迁移在本地未走 Payload 迁移通道 → 不粉饰：§C 与 tasks §6.1 明确「迁移文件是可复核产物 + 本地账本不含该迁移行」。

**未修，登记为另案（附理由）**
- [Q-H1] 线上 `leads_activity` 行数与备份：用户已定「本地测试，先不管线上」，属发布前置 tasks §5.1/§5.4，须人工在服务器执行。
- [Q-M5] 与 cron 竞态可能误删真实通知（`*/30` 撞窗概率极低但存在；后果仅下轮重建）→ 记为 LOW 观察项，建议 dev 启动用非触发型 `REMINDER_CRON_EXPRESSION`（见 §F-4）。
- [Q-M2/M3] `envelope.ts` 抛错未包进信封、404 死分支 → PROB-008/005 另案（构建期/错误映射属行为变更，需独立门禁）。
- [Q-L2] `security.spec.ts` C1 依赖库内已发布文章（清库即 4 连红）→ 既有测试，本批未动，记为另案。
- [Q-L3] `AI_PROJECT.md` 与 `AGENTS.md` 双审查入口命名不一致 → 规则文件，交用户决定。
- [Q-L6] `apps/cms/.env` 缺 `NODE_ENV` → 本地开发体验项，不入本批。
- [S8] `.qoder/better-loop/` 未纳管 → 属工具产物，非本批交付物。

**驳回的审查结论（附反证）**
- [S5] 「`scripts/deploy.sh` 的凭据入 git」——该文件**不存在**（`ls scripts/` 只有 `deploy-provision.sh`/`deploy-chatwoot.sh`/`cms-run.sh`/`backup.mjs` 等）。但它指向的**实质缺陷成立**：`scripts/backup.mjs` 原有 `DEFAULT_URI` 内置连接串含明文口令。⇒ 本批内已修（不再"不擅动"）：删掉 `DEFAULT_URI`，改为 `--uri`/`DATABASE_URI` 必给其一否则 `exit=1`；失败消息只回显 `user@host:port/db` 并标注「口令已隐去」。实测见 §A-11、§A-12，口径与未验证项见 `dev-log.md` 步骤 7.2。**留给 owner 的只剩一件事**：该口令自 `4a7d807` 起已在 git 历史里，工作树删除≠历史抹除 → 是否轮换线上/本机库口令（PROB-010，见 `evidence/release-prerequisites.md`）。
- [S7] 「`payload-types.d.ts` 未入库且残留旧 `activity?`」——`git ls-files src/payload-types.ts` 有输出（入库类型文件已再生成且无 `activity`）；未跟踪的 `*.d.ts` 是构建产物（`git ls-files --others` 才列出），非真值缺失。
- [Q-H2 的延伸] 「全仓无 `payload migrate` 执行通道」属实，但不属"本批遗漏"：本批只做清理，生产迁移通道应作为独立部署 change 立项。
- [S2] CHANGELOG 分隔符风格：与既有 `2026-08-26` 行一致（该表头本身即含 `/`），不改。

## F. 残留风险与人工核对盲点（务必看）

1. **线上完全未验证**：§D 右列全部为「未执行/未核实」，任何"已解决"的理解都只适用于本地。
2. **本地迁移账本与盘上不一致**（R5）：`payload migrate` 在本地不可用（dev-push 门禁），后续任何人指望 `autoRun` 在本地同步 schema 都会落空。
3. **`down` 回滚未实测**：迁移 `down` 是按 `up` 反推手写的结构重建，未在干净库上演练过。
4. **cron 与提醒用例共享一个库**：跑 reminders spec 时若正好 `*/30` 触发扫描，理论上会把 cron 为真实线索新建的通知当"本轮新增"删掉（下一轮会重建）。建议本地 dev 用 `REMINDER_CRON_EXPRESSION="0 0 1 1 *"` 启动 CMS（20:17 那轮 `e2e-final-2.log` 未设该变量、cron 不注册，扫描只由用例显式 POST 触发，跑测三次均绿；更早的 dev-log:522,581,677-678 几轮曾显式设为 `0 0 1 1 *`）。
5. **`e2e-admin` 是真实 admin 账号**，口令在 gitignored 文件里；不需要时删账号：后台删除 `e2e-admin` 或让运维核 `users` 表。
6. **备份成功路径本机未验证**：本机无 `pg_dump`，只跑通「缺连接串 exit=1」「失败不回显口令」两条负向路径（§A-11/§A-12）。真正导出是否成功，须在装了 pg_dump 的服务器首跑时人工确认，别把负向绿当作备份能力已验证。

## G. spec-review 逐条 triage（第二轴；§E 是 quality 轴）

审查报告：`review/spec-review.md`（判定：有 HIGH blocker 不可进 verify-bc，HIGH 2 / MEDIUM 5 / LOW 5）。逐条处置：

| # | 发现 | 处置 | 证据 |
|---|---|---|---|
| **H1** | `create-e2e-admin.ts` 的「原子写 + 保留顶层键」被写成已修、代码里没有 | **改代码而非改文档**：补 `readSecrets()` 单次读取 → 保留既有顶层键只换本脚本条目 → `writeFileSync(tmp,{mode:0o600})` + `renameSync`；带探针键重跑实测 | §A-9、§E-6；`cms-build-3.log` |
| **H2** | 勾选的 validate 门禁不覆盖当前工作树（真值在末次 sync 后又改）、仓库级 validate 无工件 | **已闭合（改流程不改说辞）**：所有编辑定格后依次跑 `change sync` → `validate . --stamp` → `change validate --strict`，实际 stdout + 两份 stamp 工件入 §A-8；并额外跑默认未启的 `--check-evidence --check-scope`（§A-13），过程中暴露工具对 Scope 写法的两处机读约束 → 新登 **PROB-011** | §A-8、§A-13、`gates-final.log` |
| M1 | 「启动期 vs 请求期」语义修正只落了一半文档（7 处仍写启动抛错，含入库的 `cms-run.sh:10`） | **已扫齐**，并固化唯一口径表 | `dev-log.md` 步骤 7.1；`cms-run.sh:10`；`goals:16,44`；`plan:63,66`；`proposal:50,99,107,127`；PROB-002 Notes |
| M2 | `goals/G-001:38` 仍写「删表迁移将在下次生产部署自动生效，属既有事实」 | **已改写**为与 `design.md:34` 同口径（生产不自动执行、本地账本不含该行），判据 3 同步 | `goals:38`、`goals:44` |
| M3 | 两项 In Scope 子交付未落地：`docs/08` 发布前置说明、`AI_WORKSPACE` 启动前置点名 CORS | **已补**：`docs/08:148-149` 写明生产不自动迁移 + 显式 `payload migrate` 前置（备份/行数/记账）；`AI_WORKSPACE.md:32,39` 点名 `PUBLIC_CORS_ORIGINS` 及其对 health/e2e 的影响；开放项另立 `evidence/release-prerequisites.md` | `docs/08:148`、`AI_WORKSPACE.md:32,39` |
| M4 | 需求合同行未同步（`tasks 1.2` 勾了但文件没动）、`Tests` 指向不存在的包 `@juece/e2e` | **已同步**：两行 `Tests` 改 `pnpm --filter e2e test`、`REQ-0001.Evidence` 死链改指归档、`Notes` 加复验指针、`Updated_At` 刷新；未新增合同键（避免破坏 schema）。旧命令残留另 2 处：`goals:55` 本轮改为可跑命令，`dev-log:384` 是记录「该命令跑不通」的历史，保留 | `requirements-issues.jsonl`、`proposal.md:134` |
| M5 | 双套台账（`tasks.md` 44 项 vs `tasks.jsonl` 36 项全 pending）；3 条勾选的「实测」超出实测范围 | **部分接受**：`tasks.md` 头部声明自己是唯一勾选真值、`tasks.jsonl` 降为派发台账并用 `aiws change tasks complete` 逐条推进（现 **32 completed / 4 pending**，pending 恰为 task-33 收尾与 task-34..36 线上前置，非遗漏；原全 pending 快照留 `.aiws/tmp/cleanup-batch-20260919/tasks.jsonl.bak`）；3 条超范围勾选在 `REQUIREMENTS.md` 标注证据类型（代码核实 / 沿用 8-26 归档证据），与真跑过的 10 条区分 | `tasks.md:1-6`、`REQUIREMENTS.md:58,60,90` |
| L1 | expected-fail 的行号引用漂移（182/194 实为 185/197） | **已改为引用测试标题**，不再用行号；`tasks.md §6` 整体移入 `evidence/follow-ups.md`，漂移引用随之消失 | `problem-issues.jsonl` PROB-005/006 Notes（含用例标题）、`follow-ups.md:16,22` |
| L2 | PROB-009 范围写小：`REQUIREMENTS.md:11` 同源漂移未登记 | **已补**：Notes 增加 `requirements:contract` 块（3–12 行）同源漂移，并说明修 `ai-project:core` 不会连带修它 | `problem-issues.jsonl` PROB-009 |
| L3 | memory-bank 夹带 8-31 无关条目（`.index.yaml` +11 行、`decision/analysis/chatwoot-offline.md`） | **接受并从本批提交中排除**：属你在先的工作流产物，不认领、不打包；提交时只 stage 本批文件 | 提交清单（见 handoff） |
| L4 | 证据指针指向修正前那次跑测（`e2e-final.log`）；§F-4 声称「本轮未设 cron」与 dev-log 记录冲突 | **已改**：指针改指 `e2e-final-2.log`（20:17 覆盖最终树），§F-4 按 run 分别写清（20:17 未设 ⇒ cron 不注册；更早几轮显式设 `0 0 1 1 *`） | §A-3、§F-4 |
| L5 | `proposal`/`plan` 把迁移 SQL 写成 `DROP TABLE IF EXISTS`（实际无 `IF EXISTS`，非幂等）；`resolveCorsOrigins()` 函数名未出现 | **已按实际 SQL 复述**（`DROP TABLE "leads_activity" CASCADE; DROP TYPE …`，并标注不可重复执行）；CORS 逻辑承认内联在 `allowedOrigin()`，删掉未落地的函数名承诺 | `proposal.md:51`、`plan:45-46` |

审查者列的「未能核实之处」9 条中，第 1/2/4/5 条属本评审的只读纪律限制（禁连库、禁跑测、禁读 `.env`/secrets），对应事实已由 §A 的实测行覆盖；第 6/7 条（线上行数与备份、`down` 回滚演练）是**本批明确未做**的发布前置，见 `evidence/release-prerequisites.md` 与 §F-3；第 8/9 条（expected-fail 正向对照、`aiws` 工具内部行为）维持不核实，不做无证据断言。
