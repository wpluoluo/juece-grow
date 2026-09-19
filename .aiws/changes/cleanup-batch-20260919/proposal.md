# Change Proposal: cleanup-batch-20260919

> Title: 清理批次：真值漂移+死模型+兜底+空目录+e2e缺口
>
> Created: 2026-09-19T09:11:18Z

## 目标与非目标

**目标：**
- 消除 `REQUIREMENTS.md` 与执行合同的漂移：REQ-0001/REQ-0002 已 `Impl_Status=DONE` 却仍留在重复的 `## Backlog` 段、验收框全未勾、`已完成` 区仅有注释示例。
- 删除 Payload 死模型 `Leads.activity` 及其 `leads_activity` 表（AGENTS.md §4 禁止双写）。
- 收敛 `envelope.ts` 的 CORS 内置默认白名单为 fail-fast（AGENTS.md §4 禁止兜底），并做到「配置先行」，使漏配在部署阶段显式失败而非静默损坏线上留资。
- 清理 6 个空目录（其中 `apps/cms/scripts` 随后为本批的 `create-e2e-admin.ts` 重建 ⇒ 净减 5 个目录）与指向不存在的 `lib/leadActivity` 的失效注释。
- 补齐 e2e 对提醒扫描、`/api/leads/assign`、`/api/sites/clone` 的覆盖（当前零覆盖）。

**非目标：**
- Astro 首页/功能/方案/价格文案入 CMS（产品范围决策，待用户立项）。
- `reference/juecesass-marketing-20260825/` 旧 Vue 站出库（涉及删除已入库内容，待用户决策）。
- 后台 Lexical 文章编辑 e2e（成本高收益低）。
- 新增 `dev-seed` 公开端点（扩大攻击面，属新功能）。
- 任何生产服务器操作（SSH、面板环境变量、线上 SQL）——本批全部本地自证。
- `payload.config.ts:242` `DATABASE_URI || ''` 兜底（同类问题，但构建期也读该配置，须单独设计，不随本批扩范围）。

## 主索引绑定（强制）

- `Change_ID` = cleanup-batch-20260919
- 需求交付：`Req_ID` = REQ-0001
- 问题修复：`Problem_ID` = PROB-001
- `Contract_Row` = Req_ID=REQ-0001,Problem_ID=PROB-001
- 次要合同行（同一批次连带，见 Notes 交叉引用）：`REQ-0002` / `PROB-002` / `PROB-003` / `PROB-004`
- `Plan_File` = .aiws/plan/2026-09-19-cleanup-batch.md
- `Evidence_Path` = .aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md, .aiws/changes/cleanup-batch-20260919/review/quality-review.md, .aiws/changes/cleanup-batch-20260919/review/spec-review.md, .aiws/changes/cleanup-batch-20260919/evidence/change-status-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/change-validate-strict-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/aiws-validate-stamp-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/change-sync-stamp-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/collaboration-summary-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/delivery-summary-20260919-141641Z.md, .aiws/changes/cleanup-batch-20260919/evidence/verification.jsonl

## 依赖关系（可选）

- `Depends_On` = （无；前置 change 均已归档：phase1-skeleton、lead-followup-reminders、security-hardening）
- `Blocks` = （无）

## 现状与问题

- `REQUIREMENTS.md` 有两个 `## Backlog` 标题（L27、L54），REQ-0001/0002 共 13 条验收框全为 `- [ ]`，而 `.aiws/requirements/requirements-issues.jsonl` 两行均为 `Impl_Status=DONE`；`## 已完成` 区只有注释掉的示例行。`CHANGELOG.md` 末尾残留 `| YYYY-MM-DD | | | | | |` 模板行。
- `apps/cms/src/collections/Leads.ts:379` 定义 `activity` array 字段；全仓 grep `activity` 仅命中该定义本身，零读零写；事件实际只写 `lead-activities`（`Leads.afterChange`）。dev 库 `select count(*) from leads_activity` 实测 0 行（容器 `juece-grow-postgres`）。
- `apps/cms/src/lib/envelope.ts:7` `DEFAULT_CORS_ORIGINS`；`PUBLIC_CORS_ORIGINS` 在 `apps/cms/.env.example`（仅 3 变量）、`docker-compose.prod.yml`（只编排 Chatwoot）、`Dockerfile.cms` runner 段、`docs/08-deployment.md:99` 生产关键项中**均不存在**——即线上跨域当前完全依赖代码默认值。
- 空目录 6 个：`apps/cms/src/components`、`apps/cms/src/app/api/dev-seed`、`apps/cms/src/app/api/v2/sites/clone`、`apps/cms/src/app/dashboard`、`apps/cms/scripts`、根 `src/`。
- `apps/e2e` 仅 `lead.spec.ts` + `security.spec.ts`；提醒扫描（REQ-0002 核心判重逻辑）、`/api/leads/assign`、`/api/sites/clone` 零覆盖。`playwright.config.ts` 无 `webServer`，CMS/Astro 需人工预启。

## 方案概述（What changes）

- 真值：`REQUIREMENTS.md` 收敛为单一 Backlog 区，REQ-0001/0002 连同已实测的验收条目移入「已完成」；`CHANGELOG.md` 删模板行并追加本轮记录；`aiws change sync` 刷新基线。
- **BREAKING（部署契约）**：`PUBLIC_CORS_ORIGINS` 从「可选、缺省走内置默认」改为「必需、缺失即请求期抛错（500），且部署脚本先行终止」。同时以 `.env.example` / `scripts/cms-run.sh`（`${VAR:?}`）/ `docs/08-deployment.md` 三处配置先行，使漏配表现为部署脚本终止而非线上静默故障。
- **BREAKING（schema）**：删 `Leads.activity` 字段并新增迁移 `20260919_093340_drop_lead_activity`：up 为 `DROP TABLE "leads_activity" CASCADE; DROP TYPE "public"."enum_leads_activity_type";`（**无 `IF EXISTS` ⇒ 非幂等，重复执行会报错**，重跑前须先核表是否还在）；`payload-types.ts` 再生成。经查适配器源码（`@payloadcms/db-postgres/dist/connect.js:116`）：生产仅在传 `prodMigrations` 时才启动 migrate，而 `payload.config.ts` 未传 ⇒ **该迁移不会在下次部署自动执行**，线上清理需维护窗口显式跑 `payload migrate`，发布前置写入证据。
- 结构：删 6 个空目录（`apps/cms/scripts` 随后被本批的 `create-e2e-admin.ts` 重建 ⇒ 净减 5 个）；`Leads.ts` 失效注释改指实际实现（`afterChange` 钩子内联）。
- 测试：新增 `reminders.spec.ts`、`leads-assign.spec.ts`、`sites-clone.spec.ts`；造数以 admin 会话直调 Payload REST 并自清理，不新增产品代码。
- 测试自足性（PROB-012，验证过程中实测发现并在本批内修掉）：dev origin 收敛到 `apps/e2e/helpers/origins.ts` 单一来源（HEAD 4 处 + 本批 `cmsRest.ts` 1 处共 5 处字面量 → 2 行），并在 `setup/global-setup.ts` 注入凭据前用 TCP 探测 CMS/Astro 端口（冷编译会让 HTTP 探活自身超时），在监听则逐个 GET 预编译路由。根因：Next 16 dev（Turbopack）按首次请求编译路由，单条冷编译实测 41.7–48.3s，大于 Playwright 用例级 `timeout: 30_000` ⇒ **功能正常也会首跑假红**。不引入 playwright `webServer`（会接管服务生命周期，与本批「服务由外部启动」约定冲突）。

## 协同与委托（可选）

- `analysis/`：
  - 委托分析已在 INTAKE 阶段落盘为 `.aiws/plan/2026-09-19-cleanup-batch.intake.md`（决策树 A/B/C/D 与实测事实），不再单列 analysis 产物。
- `patches/`：
  - 不使用外部 patch 草案；实现由 subagent 在工作树直接产出。
- `review/`：
  - `review/quality-review.md`（实现质量与覆盖）、`review/spec-review.md`（流程与真值归因）双审查并行产出，HIGH blocker 须经 triage 后方可 finish。

## 影响范围（Scope）

### In Scope（本次改动范围）

- `REQUIREMENTS.md` - 需求状态与验收勾选同步
- `.aiws/requirements/CHANGELOG.md` - 删模板行 + 追加记录
- `.aiws/issues/problem-issues.jsonl` - PROB-001..004 状态流转
- `apps/cms/src/collections/Leads.ts` - 删 activity 字段、修失效注释
- `apps/cms/src/migrations/**` - 新增 drop 迁移
- `apps/cms/src/payload-types.ts` - 再生成
- `apps/cms/src/lib/envelope.ts` - 删默认白名单，改 fail-fast
- `apps/cms/.env.example` - 增 PUBLIC_CORS_ORIGINS
- `scripts/cms-run.sh` - 增必需变量校验与写入 cms.env
- `docs/08-deployment.md` - 生产关键项补 PUBLIC_CORS_ORIGINS 与发布前置说明
- `AI_WORKSPACE.md` - 补齐验证入口（build_cmd / server_test_cmd / astro_build_cmd / gate_cmd / e2e_prerequisites），并把 `playwright_test_cmd` 从跑不通的 `cd {web_dir} && pnpm playwright test` 改为真实的 `pnpm --filter e2e test`（e2e 属独立包 apps/e2e）
- `apps/cms/src/components/`、`apps/cms/src/app/api/dev-seed/`、`apps/cms/src/app/api/v2/sites/clone/`、`apps/cms/src/app/dashboard/`、`apps/cms/scripts/`、`src/` - 删除空目录
- `apps/e2e/tests/**` - 新增 3 个场景
- `apps/cms/scripts/create-e2e-admin.ts` - 空目录 `apps/cms/scripts/` 删除后，因 e2e 需可复现管理员账号而重建为一次性幂等脚本（口令只写 gitignored 文件，不打印）
- `apps/e2e/helpers/cmsRest.ts`、`apps/e2e/helpers/origins.ts`、`apps/e2e/setup/global-setup.ts` - 3 个场景共用的后台 REST 客户端、dev origin 唯一来源、凭据注入与跑测前路由预热（PROB-012）
- `apps/e2e/playwright.config.ts` - `workers: 1` + `fullyParallel: false` + `globalSetup`（用例共库，会话与快照差集清理不可并行）

> 越界说明：后三项是 2.7–2.9 落地的必要支撑（无凭据入口与共用客户端则新用例无法零参数复现），非顺手重构。`apps/cms/.env` 与 `.aiws/secrets/test-accounts.json` 均为 gitignored 运行时副作用，不入库。

### Out of Scope（明确不改动）

- `apps/astro/**` - 不动公开站（#3 待立项）
- `reference/**` - 不动旧 Vue 站（#7 待决策）
- `apps/cms/src/collections/{LeadActivities,ReminderRules,ReminderNotices}.ts` - 提醒业务逻辑不改，仅补测试
- `apps/cms/src/payload.config.ts` - 不动 `DATABASE_URI || ''`（另案）
- `AI_PROJECT.md` - **不改**：第 20/21/33/58/101 行指向本仓不存在的 `requirements-issues.csv` / `issues/*.csv`（归因链断裂），但这些行全部落在 `AIWS_MANAGED_BEGIN:ai-project:core` 托管块（第 3–103 行）内，手改会触发 `block sha256 mismatch` 门禁 ⇒ 本批已回退改动，登记 PROB-009 走 `aiws update` 正途修正。
- `infra/**`、`docker-compose*.yml`、`Dockerfile.cms` - 不改编排与镜像

### 外部影响

- 可能影响的外部接口/使用方：
  - 公开站留资与内容拉取：若 `PUBLIC_CORS_ORIGINS` 未注入，进程仍能起来，但首个 `/api/v2/*` 请求即 500（`allowedOrigin()` 抛错，文本点名该变量），属设计意图的 fail-closed；部署期由 `scripts/cms-run.sh` 的 `${VAR:?}` 前移到启动前拦截。
  - Payload admin：`leads` 集合表单不再出现「跟进历史」区块（该区块此前无数据通路）。
  - e2e 运行前提：`apps/cms/.env` 必须含 `PUBLIC_CORS_ORIGINS`，否则 C5 与新增用例红。

## 风险与回滚

- 风险：
  - R1 删表迁移**不会**在下次部署自动执行（`postgresAdapter` 未传 `prodMigrations`，见 design R1）：线上 `leads_activity` 因此继续存在、行数未核实（本批不触生产）；清理须显式 `payload migrate`。
  - R2 部署契约变更：漏配 `PUBLIC_CORS_ORIGINS` 时 CMS 仍能启动，但首个 `/api/v2/*` 请求即 500（错误文本点名变量）；`cms-run.sh` 的 `:?` 把失败前移到部署阶段。
  - R3 删 `apps/cms/src/components` 若实际被 Payload `components` 解析路径依赖，会断 admin 组件。
- 回滚方案（必须可执行）：
  - 代码/文档：`git revert` 本 change 合入提交（分支 `change/cleanup-batch-20260919`）。
  - schema：执行反向迁移——重建 `leads_activity` 表与 `Leads.activity` 字段（该表 0 行，重建无数据损失）。
  - 配置：恢复 `envelope.ts` 的默认白名单即回到旧行为；`cms-run.sh` 去掉 `${VAR:?}` 即恢复可选语义。

## 验证计划（必须可复现）

> 命令取自 `AI_WORKSPACE.md` 的项目配置段：`start_cmd`（`pnpm --filter cms dev`）、`health_check`、`playwright_test_cmd`、`test_db_url`（容器 Postgres 5434，禁内存库）。

- 命令：
  - `pnpm --filter cms build`
  - `pnpm db:up` → `pnpm --filter cms dev` → `pnpm --filter e2e test`
  - `docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc "select count(*) from information_schema.tables where table_name='leads_activity'"`
  - 负向：去掉 `PUBLIC_CORS_ORIGINS` 后 `pnpm --filter cms dev`
  - 冷启动复现（PROB-012）：`rm -rf apps/cms/.next` → 重启 dev 后只等 TCP 端口 listen（不用 HTTP 探活）→ `pnpm --filter e2e test`
  - `aiws validate .`；`aiws change validate cleanup-batch-20260919 --strict`
- 期望结果：
  - build 无 TS 错误且构建期不启定时器；e2e 全绿并包含新增 3 场景（提醒判重两次调用 `created` 由 >0 变 0，线索状态不变）。
  - 冷启动：清 `.next` 后首跑仍 `56 passed / 2 skipped`、`exit=0`，路由编译耗时全部落在 `globalSetup` 预热内 ⇒ 验收命令零手填参数可复现绿灯。
  - `leads_activity` 计数为 `0`（表已删）。
  - 负向：去掉 `PUBLIC_CORS_ORIGINS` 后请求 `/api/v2/*` → 首个请求 500（错误在 `allowedOrigin()` 内抛出并点名该变量，进程已 Ready，非启动期崩溃）。
  - `aiws validate .` 与 `change validate --strict` 通过；AGENTS.md §9 自检清单逐条满足。

## 真值文件/合同更新清单

- `REQUIREMENTS.md`：需要——REQ-0001/0002 移入「已完成」并按本轮实测勾选验收条目；不新增需求。
- `.aiws/requirements/CHANGELOG.md`：需要——删模板行 + 追加真值同步记录。
- `.aiws/requirements/requirements-issues.jsonl`：已回填——两行 `Notes` 追加 2026-09-19 复验指针并刷新 `Updated_At`；`REQ-0001.Evidence` 由未归档的 `.aiws/changes/phase1-skeleton/…`（死链）改指 `archive/2026-08-26-phase1-skeleton/…`；两行 `Tests` 里不可跑的 `pnpm --filter @juece/e2e exec playwright test` 改为 `pnpm --filter e2e test`；Spec/Impl 状态不变。
- `.aiws/issues/problem-issues.jsonl`：已回填——PROB-001..004 置 DONE（附实测说明）；删模板种子行 PROB-000；双审查新增 PROB-005..009 为 OPEN（另案处置）；PROB-010（`scripts/backup.mjs` 内置默认连接串兜底 + 失败回显口令）与 PROB-012（e2e 冷缓存首跑假红：路由冷编译吃掉用例级超时预算）在本批内修掉并实测；PROB-011（`aiws --check-scope` 的四处静默失效点）与 PROB-013（`aiws change evidence` 非幂等：重复运行把新盖戳工件累加进 `Evidence_Path`）为工具侧缺陷，本批只记录正确用法与复现口径，不改工具；提交后独立审查轮再新增 PROB-014（`apps/e2e` 无 `tsconfig.json` 与 typecheck 入口 ⇒ 本轮 `cmsRest.ts` 的类型收窄只由运行时绿灯证明，未经编译器证明）为 OPEN 另案。
- 证据落盘（双层）：
  - 持久：`.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md`、`review/quality-review.md`、`review/spec-review.md`
  - 临时：`.aiws/tmp/cleanup-batch-20260919/`（build/e2e 日志、负向启动报错文本、psql 计数输出）
  - 协同：`.aiws/plan/2026-09-19-cleanup-batch.intake.md`、`.aiws/goals/G-001-cleanup-batch.md`
