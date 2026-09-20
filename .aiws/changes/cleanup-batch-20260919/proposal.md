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
- 出库 `reference/juecesass-marketing-20260825/` 旧 Vue 站快照（`git rm -r` 删 16 个已入库文件、清 7 个目录），并把 `docs/07-design-theme.md` §2.1 的在盘回溯指针改为版本化取回命令。**2026-09-20 owner 裁决「删掉」后追加**。
- 修掉 e2e 补齐时登记的两个已核实缺陷：`/api/leads/assign` 对不存在 id 落 500（PROB-005）与端点分配丢失审计操作人（PROB-006）。**2026-09-20 owner 裁决「不各自立项，合并为一个改动」**；该修复轮按同类模式复查端点，当场带出并一并修掉 PROB-015（成功响应直出整份用户文档、含他人 `sessions[]`）与 PROB-016（`/api/sites/clone` 对不存在源站落 500 且 catch 无日志）。
- **`735bc09` 提交后的独立审查轮（2026-09-20 追加）**：① 把「本地 API 写未透传 `req` ⇒ 审计丢发起人」这一类缺陷外延查到底——`Memberships.ts` / `Users.ts` 两处级联清主同样命中，本轮补透传并新增 e2e 用例钉住；② 删 `/api/leads/assign` 里恒真的 `isProjectMember(...)` 判断（写权限已蕴含成员身份 ⇒ §4 禁止的死兜底，且每次分配多打一次 `memberships` 查询）；③ 补立本轮的高风险门禁 `docs/gates/GATE-005-assign-clone-error-and-audit-fix.md` 并给两份 review 加日期化小节（审查工件停在上一提交、`verify-bc` 只查在盘不查覆盖 ⇒ 当时的「双审查」是空签）；④ 审查者另报的 6 条不在本批可批准范围的发现当场登记 PROB-017..022。

**非目标：**
- Astro 首页/功能/方案/价格文案入 CMS —— **2026-09-20 owner 已批准**，但属新增内容模型 + 站点取数（产品功能，非清理），另立 change 交付。
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
- 结构：删 6 个空目录（`apps/cms/scripts` 随后被本批的 `create-e2e-admin.ts` 重建 ⇒ 净减 5 个），2026-09-20 追加 `reference/` 出库再净减 7 个 ⇒ **本批累计净减 12 个目录**；`Leads.ts` 失效注释改指实际实现（`afterChange` 钩子内联）。
- **对外行为（响应契约，随裁决并入本批）**：`/api/leads/assign` 与 `/api/sites/clone` 两个自定义端点——① 「记录不存在」由 `500` 改回 `404`，错误码 `LEAD_NOT_FOUND` / `ASSIGNEE_NOT_FOUND` / `SOURCE_NOT_FOUND`（`findByID` 加 `disableErrors: true` 走 null 分流，不把 `catch` 拓宽成万能兜底，库异常仍回 500 且 `logger.error` 留痕）；② `/assign` 成功响应的 `data.owner` 由**填充后的用户对象**改为**裸 id**（`payload.update` 加 `depth: 0`），消除他人 `sessions[]`（会话 uuid + 有效期）外泄；③ 端点写库透传 `req`，使 `afterChange` 能记发起人；④（2.15 审查轮延伸）同一透传口径补到两处级联清主——移除项目成员与删除用户时写出的「负责人置空」动态不再丢 `actor`；`/assign` 的权限判断删去恒真的 `isProjectMember(...)` 二次校验（写权限已蕴含成员身份 ⇒ 每次分配少一次 `memberships` 查询，鉴权语义未放宽，assignee 是否本项目成员仍由后续单独校验）。仓内 `grep -rn --exclude-dir=.next --exclude-dir=node_modules "leads/assign" apps/ docs/ scripts/` 的命中**只有注释与 e2e 用例本身**（`Sites.ts:77`、`global-setup.ts:47`、`leads-assign.spec.ts`），即无产品侧消费方（admin UI 走 Payload 原生 REST，不经这两个端点），故不另计 BREAKING 版本号；e2e 断言已由「敏感键黑名单」升级为「键集白名单 + 类型」以防回归。
- 测试：新增 `reminders.spec.ts`、`leads-assign.spec.ts`、`sites-clone.spec.ts`；造数以 admin 会话直调 Payload REST 并自清理，不新增产品代码。
- 测试自足性（PROB-012，验证过程中实测发现并在本批内修掉）：dev origin 收敛到 `apps/e2e/helpers/origins.ts` 单一来源（HEAD 4 处 + 本批 `cmsRest.ts` 1 处共 5 处字面量 → 2 行），并在 `setup/global-setup.ts` 注入凭据前用 TCP 探测 CMS/Astro 端口（冷编译会让 HTTP 探活自身超时），在监听则逐个 GET 预编译路由。根因：Next 16 dev（Turbopack）按首次请求编译路由，单条冷编译实测 41.7–48.3s，大于 Playwright 用例级 `timeout: 30_000` ⇒ **功能正常也会首跑假红**。不引入 playwright `webServer`（会接管服务生命周期，与本批「服务由外部启动」约定冲突）。

## 协同与委托（可选）

- `analysis/`：
  - 委托分析已在 INTAKE 阶段落盘为 `.aiws/plan/2026-09-19-cleanup-batch.intake.md`（决策树 A/B/C/D 与实测事实），不再单列 analysis 产物。
- `patches/`：
  - 不使用外部 patch 草案；实现由 subagent 在工作树直接产出。
- `review/`：
  - `review/quality-review.md`（实现质量与覆盖）、`review/spec-review.md`（流程与真值归因）双审查并行产出，HIGH blocker 须经 triage 后方可 finish。
  - **`735bc09` 之后的第二轮审查**（提交后独立审查）发现与处置落在 `quality-review.md` §7（10 条逐条核实与处置表）与 `spec-review.md` §6（流程缺口 + 真值同步表），高风险门禁由 `docs/gates/GATE-005-assign-clone-error-and-audit-fix.md` 承接。该轮暴露的口径缺口须记住：`aiws verify-bc` 只检查 `Evidence_Path` 里的文件**是否存在**，不检查是否覆盖本轮改动 ⇒ 「审查工件在盘」≠「本轮已被审查」，每轮实质改动都要显式刷新对应 review 小节。

## 影响范围（Scope）

### In Scope（本次改动范围）

- `REQUIREMENTS.md` - 需求状态与验收勾选同步
- `.aiws/requirements/CHANGELOG.md` - 删模板行 + 追加记录
- `.aiws/issues/problem-issues.jsonl` - PROB-001..004 状态流转；PROB-005/006 由 OPEN 转 DONE（2026-09-20 裁决后随批修）；新增 PROB-015/016 并同批修毕；2.15 审查轮再登记 PROB-017..022（均 OPEN 另案，逐条理由在 `evidence/follow-ups.md`）
- `apps/cms/src/collections/Leads.ts` - 删 activity 字段、修失效注释；2026-09-20 随裁决修 `/api/leads/assign`（404 分流、透传 `req`、`depth: 0`、`catch` 记日志）；2.15 审查轮删该端点恒真的 `isProjectMember(...)` 死权限项与对应 import
- `apps/cms/src/collections/Sites.ts` - 2026-09-20 同一轮：`/api/sites/clone` 对不存在源站回 `404 SOURCE_NOT_FOUND`，`catch` 记日志（PROB-016）
- `apps/cms/src/collections/Memberships.ts` - 2.15 审查轮：`beforeDelete` 级联清主的 `payload.update` 透传 `req`，使清主动态带上发起人（PROB-006 同类第 3 实例）
- `apps/cms/src/collections/Users.ts` - 2.15 审查轮：用户删除时的级联清主同样透传 `req`（第 4 实例）；同函数内 `lead-activities` 的 update 不改（不写受审计事件）
- `apps/cms/src/migrations/**` - 新增 drop 迁移
- `apps/cms/src/payload-types.ts` - 再生成
- `apps/cms/src/lib/envelope.ts` - 删默认白名单，改 fail-fast
- `apps/cms/.env.example` - 增 PUBLIC_CORS_ORIGINS
- `scripts/cms-run.sh` - 增必需变量校验与写入 cms.env
- `docs/08-deployment.md` - 生产关键项补 PUBLIC_CORS_ORIGINS 与发布前置说明
- `docs/gates/GATE-005-assign-clone-error-and-audit-fix.md` - 2.15 审查轮补立：`/assign`·`/clone` 错误分流与审计写路径变更属 §8 高风险，须有独立门禁记录（方案对比、修复清单、显式「不改」清单、回滚）
- `AI_WORKSPACE.md` - 补齐验证入口（build_cmd / server_test_cmd / astro_build_cmd / gate_cmd / e2e_prerequisites），并把 `playwright_test_cmd` 从跑不通的 `cd {web_dir} && pnpm playwright test` 改为真实的 `pnpm --filter e2e test`（e2e 属独立包 apps/e2e）
- `apps/cms/src/components/`、`apps/cms/src/app/api/dev-seed/`、`apps/cms/src/app/api/v2/sites/clone/`、`apps/cms/src/app/dashboard/`、`apps/cms/scripts/`、`src/` - 删除空目录
- `apps/e2e/tests/**` - 新增 3 个场景
- `apps/cms/scripts/create-e2e-admin.ts` - 空目录 `apps/cms/scripts/` 删除后，因 e2e 需可复现管理员账号而重建为一次性幂等脚本（口令只写 gitignored 文件，不打印）
- `apps/e2e/helpers/cmsRest.ts`、`apps/e2e/helpers/origins.ts`、`apps/e2e/setup/global-setup.ts` - 3 个场景共用的后台 REST 客户端、dev origin 唯一来源、凭据注入与跑测前路由预热（PROB-012）
- `apps/e2e/playwright.config.ts` - `workers: 1` + `fullyParallel: false` + `globalSetup`（用例共库，会话与快照差集清理不可并行）

> 越界说明：后三项是 2.7–2.9 落地的必要支撑（无凭据入口与共用客户端则新用例无法零参数复现），非顺手重构。`apps/cms/.env` 与 `.aiws/secrets/test-accounts.json` 均为 gitignored 运行时副作用，不入库。

### Out of Scope（明确不改动）

- `apps/astro/**` - 不动公开站（#3 owner 2026-09-20 已批准入 CMS，属新功能，另立 change）
- `apps/cms/src/collections/{LeadActivities,ReminderRules,ReminderNotices}.ts` - 提醒业务逻辑不改，仅补测试
- `apps/cms/src/payload.config.ts` - 不动 `DATABASE_URI || ''`（另案）
- `AI_PROJECT.md` - **不改**：第 20/21/33/58/101 行指向本仓不存在的 `requirements-issues.csv` / `issues/*.csv`（归因链断裂），但这些行全部落在 `AIWS_MANAGED_BEGIN:ai-project:core` 托管块（第 3–103 行）内，手改会触发 `block sha256 mismatch` 门禁 ⇒ 本批已回退改动，登记 PROB-009 走 `aiws update` 正途修正。
- `infra/**`、`docker-compose*.yml`、`Dockerfile.cms` - 不改编排与镜像
- `.aiws/memory-bank/**` - 本批不改其内容、不认领归属。2026-09-20 为解开 `aiws change finish` 的脏树拒绝，按 owner 裁决把你 8-31 未提交的两条（`.index.yaml` +11 行、`decision/analysis/chatwoot-offline.md`，逐字核实无凭据）以**独立提交 `dae7ae6`** 搭在本分支——这正是 `review/quality-review.md` §L3 的原建议。它既不进本批 `In Scope` 也不进 plan 的机读 allow-list（12 条上限已满），因此 `--check-scope` 恒把这两条报成越界。详见 `../../plan/2026-09-19-cleanup-batch.md` §Scope 与 evidence §A-23

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
  - `cd apps/cms && npx tsc --noEmit -p tsconfig.json`（修复轮的类型入口；`apps/e2e` 自身无 tsconfig，见 PROB-014）
  - `node .aiws/tmp/cleanup-batch-20260919/probe-response-shape.mjs`（直连本地 CMS 断言 `/assign` 响应面与 actor、`/clone` 的 404；造数自清）
  - `aiws validate .`；`aiws change validate cleanup-batch-20260919 --strict`
- 期望结果：
  - build 无 TS 错误且构建期不启定时器；e2e 全绿并包含新增 3 场景（提醒判重两次调用 `created` 由 >0 变 0，线索状态不变）。修复轮后为 `Running 60 tests` → `58 passed / 2 skipped`；2.15 审查轮 +1 用例（级联清主的审计发起人）后为 `Running 61 tests` → **`59 passed / 2 skipped`**，且**不再有任何 expected-fail 用例**（PROB-005/006 的 `test.fail` 已转为真实断言）。
  - 冷启动：清 `.next` 后首跑仍 `56 passed / 2 skipped`、`exit=0`（该轮在 2.14 之前，其后两轮新增用例已使总数增至 61/59，见上一条），路由编译耗时全部落在 `globalSetup` 预热内 ⇒ 验收命令零手填参数可复现绿灯。
  - `leads_activity` 计数为 `0`（表已删）。
  - 负向：去掉 `PUBLIC_CORS_ORIGINS` 后请求 `/api/v2/*` → 首个请求 500（错误在 `allowedOrigin()` 内抛出并点名该变量，进程已 Ready，非启动期崩溃）。
  - `aiws validate .` 与 `change validate --strict` 通过；AGENTS.md §9 自检清单逐条满足。

## 真值文件/合同更新清单

- `REQUIREMENTS.md`：需要——REQ-0001/0002 移入「已完成」并按本轮实测勾选验收条目；不新增需求。
- `.aiws/requirements/CHANGELOG.md`：需要——删模板行 + 追加真值同步记录。
- `.aiws/requirements/requirements-issues.jsonl`：已回填——两行 `Notes` 追加 2026-09-19 复验指针并刷新 `Updated_At`；`REQ-0001.Evidence` 由未归档的 `.aiws/changes/phase1-skeleton/…`（死链）改指 `archive/2026-08-26-phase1-skeleton/…`；两行 `Tests` 里不可跑的 `pnpm --filter @juece/e2e exec playwright test` 改为 `pnpm --filter e2e test`；Spec/Impl 状态不变。
- `.aiws/issues/problem-issues.jsonl`：已回填——PROB-001..004 置 DONE（附实测说明）；删模板种子行 PROB-000；双审查新增 PROB-005..009 为 OPEN（另案处置）；PROB-010（`scripts/backup.mjs` 内置默认连接串兜底 + 失败回显口令）与 PROB-012（e2e 冷缓存首跑假红：路由冷编译吃掉用例级超时预算）在本批内修掉并实测；PROB-011（`aiws --check-scope` 的四处静默失效点）与 PROB-013（`aiws change evidence` 非幂等：重复运行把新盖戳工件累加进 `Evidence_Path`）为工具侧缺陷，本批只记录正确用法与复现口径，不改工具；提交后独立审查轮再新增 PROB-014（`apps/e2e` 无 `tsconfig.json` 与 typecheck 入口 ⇒ 本轮 `cmsRest.ts` 的类型收窄只由运行时绿灯证明，未经编译器证明）为 OPEN 另案。**2026-09-20 两步补充**：owner 裁决「备份口令不轮换」⇒ PROB-010 由「DONE + 残留待拍板」变为 DONE 无残留；owner 裁决「PROB-005/006 不各自立项，合并为一个改动」⇒ 两条同批修毕转 DONE，该修复轮复查同类端点时新增并修毕 PROB-015（`/assign` 响应直出含他人 `sessions[]` 的用户文档）、PROB-016（`/clone` 对不存在源站落 500 且 catch 无日志）。**2.15 审查轮**再登记 PROB-017..022（int4 上界、清主误标 `assigned` 需枚举迁移、读后写竞态、`access.ts` 死分支、6 处静默 500、22 处手写信封），全部 `OPEN` 另案 ⇒ 台账现为 PROB-001..022，`DONE` = 001..006/010/012/015/016。
- 证据落盘（双层）：
  - 持久：`.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md`、`review/quality-review.md`、`review/spec-review.md`
  - 临时：`.aiws/tmp/cleanup-batch-20260919/`（build/e2e 日志、负向启动报错文本、psql 计数输出）
  - 协同：`.aiws/plan/2026-09-19-cleanup-batch.intake.md`、`.aiws/goals/G-001-cleanup-batch.md`
