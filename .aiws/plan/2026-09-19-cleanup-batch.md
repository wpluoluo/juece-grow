# Plan: cleanup-batch-20260919

> Generated: 2026-09-19 · Change: cleanup-batch-20260919 · Req: REQ-0001/REQ-0002 · Problems: PROB-001..004

## Bindings

- `Change_ID` = cleanup-batch-20260919
- `Req_ID` = REQ-0001
- `Problem_ID` = PROB-001
- `Contract_Row` = Req_ID=REQ-0001,Problem_ID=PROB-001
- 次要合同行（同一批次连带）：REQ-0002 / PROB-002 / PROB-003 / PROB-004
- `Plan_File` = .aiws/plan/2026-09-19-cleanup-batch.md
- `Intake_File` = .aiws/plan/2026-09-19-cleanup-batch.intake.md
- `Goal_File` = .aiws/goals/G-001-cleanup-batch.md
- `Evidence_Path` = .aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md, .aiws/changes/cleanup-batch-20260919/review/quality-review.md, .aiws/changes/cleanup-batch-20260919/review/spec-review.md, .aiws/changes/cleanup-batch-20260919/evidence/change-status-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/change-validate-strict-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/aiws-validate-stamp-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/change-sync-stamp-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/collaboration-summary-20260919-141641Z.json, .aiws/changes/cleanup-batch-20260919/evidence/delivery-summary-20260919-141641Z.md, .aiws/changes/cleanup-batch-20260919/evidence/verification.jsonl
- `ChangeType` = full-stack（含 Payload schema 迁移 → 高风险，须双审查）

## Goal

三阶段交付后一次收敛：真值漂移（REQ-0001/0002 已 DONE 却仍挂 Backlog、验收框未勾、CHANGELOG 残留模板行）、Payload 死模型（`Leads.activity`）、CORS 兜底、空目录与失效注释、e2e 覆盖缺口、`reference/` 旧 Vue 站快照出库（2026-09-20 追加）。全程本地 dev/test 自证，线上零操作。

## Non-goals

- #3 Astro 文案入 CMS —— **owner 2026-09-20 批准**，但属新增内容模型与站点取数（产品功能，非清理），另立 change 交付，不并入本批。
- ~~#7 `reference/` 旧 Vue 站出库~~ —— owner 2026-09-20 裁决「删掉」，**已移入本批范围**（见下方 Scope 与 Plan 第 5 项 T5）。
- 后台 Lexical 文章编辑 e2e（成本高收益低）。
- 新增 `dev-seed` 公开端点（扩大攻击面）。
- 任何生产服务器操作（SSH / 改面板环境变量 / 跑线上 SQL）。
- `payload.config.ts:242` `DATABASE_URI || ''` 兜底：与 PROB-002 同类，但 Payload 构建期也读该配置，抛错可能打断 `next build`，须单独设计验证口径，不随本批静默扩范围。

## Scope

> 机读口径：`### In Scope` 下每条 bullet **只写一个路径**（`aiws change validate --check-scope` 的解析器把整条 bullet 当作一个路径前缀/glob，句后附带说明会让该条匹配失效——本批曾因此把已声明的文件报成越界），且**条目数上限 12**（超过即判 `scope is too broad`）。两条规则合起来迫使 allow-list 只能到目录粒度，因此下表 `apps/cms/` 是本批实际改动文件的**上界**而非许可证：本批在 `apps/cms/` 内只改了 `src/collections/Leads.ts`、`src/lib/envelope.ts`、`src/migrations/`（新增迁移 + `index.ts` 登记）、`src/payload-types.ts`、`scripts/create-e2e-admin.ts`、`.env.example` 六处，`src/payload.config.ts` 与三个提醒集合**未动**（反证：`git status --porcelain` 不含这些路径，spec-review 的 Out-of-Scope 表逐条核实过）。人类说明见下方表格。
> 2026-09-20 追加 `reference/` 出库时，为守住 12 条上限把 `scripts/cms-run.sh`+`scripts/backup.mjs` 折叠为 `scripts/`、`docs/08-deployment.md`+`docs/07-design-theme.md` 折叠为 `docs/`。allow-list 精度因此再降一档（`scripts/` 下本批只动 `backup.mjs`、`cms-run.sh`，`docs/` 下只动 07/08 两篇），精确性仍由 `git status --porcelain` + spec-review 的 Out-of-Scope 表承担（PROB-011）。

### In Scope

- `REQUIREMENTS.md`
- `AI_WORKSPACE.md`
- `.aiws/requirements/`
- `.aiws/issues/`
- `.aiws/goals/`
- `.aiws/plan/`
- `.aiws/changes/cleanup-batch-20260919/`
- `apps/cms/`
- `apps/e2e/`
- `scripts/`
- `docs/`
- `reference/`

### 范围说明（人读，不参与机读 allow-list）

| 路径 | 本批改动 |
|---|---|
| `REQUIREMENTS.md` | 合并重复 `## Backlog`；REQ-0001/0002 连同验收条目移入「已完成」，并按证据类型标注（真跑 / 代码核实 / 沿用 8-26 归档） |
| `.aiws/requirements/CHANGELOG.md` | 删 `| YYYY-MM-DD |` 模板行 + 追加本轮真值同步记录 |
| 两份 jsonl 台账 | 问题台账 PROB-001..014（删 `PROB-000` 模板种子行）；需求合同行刷新 `Tests`/`Evidence`/`Notes`/`Updated_At` |
| `AI_WORKSPACE.md` | 补齐本仓可复现的验证入口（build / e2e / gate / 前置），并点名 `PUBLIC_CORS_ORIGINS` |
| `apps/cms/src/collections/Leads.ts` | 删 `activity` array 字段块；修正指向不存在的 `lib/leadActivity` 的注释 |
| `apps/cms/src/migrations/` + `payload-types.ts` | 新增 `20260919_093340_drop_lead_activity` 迁移并登记；类型再生成 |
| `apps/cms/src/lib/envelope.ts` | 删 `DEFAULT_CORS_ORIGINS`；未配置时**首个 `/api/v2/*` 请求**抛错（500，无堆栈外泄），无 dev 分支 |
| `apps/cms/.env.example`、`scripts/cms-run.sh`、`docs/08-deployment.md` | CORS 配置先行；`cms-run.sh` 用 `${VAR:?}` 把漏配前移到 `docker run` 之前终止；部署文档补生产迁移不自动执行的前置说明 |
| `apps/cms/scripts/` | `create-e2e-admin.ts`（e2e 管理员账号，幂等 + 原子写凭据文件） |
| `apps/e2e/` | 新增 reminders / leads-assign / sites-clone 三个 spec 及其 helpers/setup 与 config 接线；`helpers/origins.ts` 收为 dev origin 唯一来源；`setup/global-setup.ts` 增跑测前路由预热（PROB-012） |
| `scripts/backup.mjs` | 删内置 `DEFAULT_URI` 兜底（含明文口令），改为连接串必给其一；失败输出不回显口令（PROB-010） |
| `reference/`（2026-09-20 出库） | owner 裁决删除 `reference/juecesass-marketing-20260825/` 旧 Vue 站快照（实测 `git rm -r` 删 **16 个已入库文件**、清 **7 个目录**，含 `SHA256SUMS.txt`；计数出自 `.aiws/tmp/cleanup-batch-20260919/64-refdrop-probe.txt`）；历史上该路径只被 `41a258c` 一个提交动过 ⇒ 取回命令 `git checkout 41a258c -- reference/`。删除理由：与本仓「juecesass 独立、不混用模块与字段」红线相邻，留在树里易被当现成组件抄用 |
| `docs/07-design-theme.md` | §2.1 品牌色小节原标题把旧站写成在盘回溯路径，出库后会指空 ⇒ 改为版本化的 `git checkout` 取回命令（同上一行） |
| `.aiws/goals/`、`.aiws/plan/`、`.aiws/changes/<id>/` | 本 change 的 goal / intake / plan / proposal / tasks / review / evidence 产物 |

明确**不在**本批范围：`apps/astro/**`、`AI_PROJECT.md`（托管块内，见 PROB-009）、`apps/cms/src/payload.config.ts`（`DATABASE_URI || ''` 留 PROB-008）、`collections/{LeadActivities,ReminderRules,ReminderNotices}.ts`、`infra/**` 与容器编排文件、`.aiws/memory-bank/**`（用户在先产物，本批不 stage）。

## Plan

1. **T1 真值与合同（#1）**：改写 `REQUIREMENTS.md`（单一 Backlog 区 + 已完成区承接 REQ-0001/0002 及其勾选状态）；`CHANGELOG.md` 删模板行并追加记录；`aiws change sync cleanup-batch-20260919` 刷新真值基线。
2. **T2 配置先行（#4 前半）**：`.env.example` 增 `PUBLIC_CORS_ORIGINS`（三站 + `http://localhost:4321` + `http://127.0.0.1:4321`）；`scripts/cms-run.sh` 增必需变量校验并写进 `cms.env`；`docs/08-deployment.md:99` 生产关键项补该变量说明。**本地 `.env` 同步补齐，否则 C5 与新增 e2e 会因缺变量而红**。
3. **T3 去兜底（#4 后半）**：`envelope.ts` 删默认数组：`allowedOrigin()` 内读 `PUBLIC_CORS_ORIGINS`，解析后为空即 `throw`（不静默放行）；保持单一路径，无 dev 分支。实测失败时点=**首个 `/api/v2/*` 请求**（该函数在 handler 里被调用），不是进程启动期。
4. **T4 死模型删除（#2）**：删 `Leads.ts` 的 `activity` 字段块；`payload generate:types` 再生成；以 dev 库生成 drop 迁移（`DROP TABLE "leads_activity" CASCADE` + `DROP TYPE enum_leads_activity_type`；无 `IF EXISTS`，非幂等）；修 `lib/leadActivity` 失效注释。
5. **T5 结构清理（#5 + #7）**：删 6 个空目录；确认 Payload `components` 实际解析路径仍为 `apps/cms/components/*`（importMap 已验证），避免删 `src/components` 后 admin 组件断链。**#7 于 2026-09-20 owner 裁决后并入本步**：`git rm -r reference/` 删旧 Vue 站快照的 16 个已入库文件、清 7 个目录（⇒ 本批累计净减 12 个目录），并连带把 `docs/07-design-theme.md` §2.1 的在盘回溯指针改成版本化取回命令。不另立 change 的理由：纯删除不参与构建/运行的已入库快照 + 一处文档指针，无代码、无 schema、无对外行为变更，单提交可 `git revert`；其"待决策"状态本就登记在本批 intake/plan，另立案会把同一决策拆成两处真值。
6. **T6 e2e 补齐（#6）**：`apps/e2e/tests/reminders.spec.ts`（造 `createdAt` 30 天前的 new 线索与 `nextFollowUpAt` 已过的 contacted 线索 → 建 due/sla 规则 → admin 调 `/api/v2/reminders/run` → 断言 `created>0`、notice 落库、`LeadActivities` 出 `reminder`、重复调用 `created=0`、线索状态未被改）；`apps/e2e/tests/leads-assign.spec.ts`；`apps/e2e/tests/sites-clone.spec.ts`。造数以 admin 会话直调 Payload REST，测试自清理。
7. **T6b e2e origin 收敛与路由预热（新增，PROB-012）**：`apps/e2e/helpers/origins.ts` 作为两个 dev origin（CMS `:3000` / Astro `:4321`）的唯一来源，`playwright.config.ts` 与三个 spec、`cmsRest.ts` 全部改为 import（HEAD 4 处 + 本批 `cmsRest.ts` 1 处共 5 处字面量 → 2 行）；`setup/global-setup.ts` 在注入管理员凭据前用 **TCP** 探测两个端口（冷编译会让 HTTP 探活自身超时），在监听则逐个 GET 把路由预编译。原因（实测根因）：Next 16 dev（Turbopack）按首次请求编译路由，单条冷编译 41.7–48.3s > Playwright 每例 `timeout: 30_000`，会在**功能正常**时产出假超时红灯；预热放进 `globalSetup` 使 `pnpm --filter e2e test` 保持零手填参数即可复现绿灯。**不**改用 playwright `webServer`（会接管生命周期并与本批既有的"服务由外部启动"约定冲突）。
8. **T7 验证与审查**：本地跑全套验证 → `ws-quality-review` + `ws-spec-review` 双审查（schema 迁移属高风险）→ `aiws verify-bc` → commit → finish。

## Risks & Rollback

- **R1（主要，已核实更正）删表迁移不会在下次生产部署自动执行**：`@payloadcms/db-postgres/dist/connect.js:116` 要求 `NODE_ENV=production && prodMigrations` 才 migrate，而 `payload.config.ts` 只传 `pool`。缓解：发布前置条件写入 evidence——线上执行前核实 `select count(*) from leads_activity` 为 0 且已有 `scripts/backup.mjs` 备份；若非 0 则本迁移回退为重命名留观。**不声称已上线**。
- **R2 删默认 CORS 后新环境漏配即宕**：属有意设计（硬失败优于静默损坏）。缓解：`cms-run.sh` 的 `${PUBLIC_CORS_ORIGINS:?}` 使漏配在部署阶段终止并给出可复制的变量值；文档同步。
- **R3 删 `apps/cms/src/components` 影响 admin 组件解析**：缓解 T5.5 显式验证 admin 可加载 Dashboard 组件。
- 回滚：`git revert` 本 change 提交；schema 侧提供反向迁移（重建 `activity` 字段与 `leads_activity` 表，数据为空）；配置侧回滚不丢数据。

## Verify

- 命令：
  - `pnpm --filter cms build`
  - `pnpm db:up` → `pnpm --filter cms dev`（`.env` 含 `PUBLIC_CORS_ORIGINS`）→ `pnpm --filter e2e test`
  - 负向：去掉 `PUBLIC_CORS_ORIGINS` 后请求 `/api/v2/*` → 首个请求 500（错误在 `allowedOrigin()` 内抛出并点名该变量，进程已 Ready，非启动期崩溃），响应体不含堆栈
  - `docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc "select count(*) from information_schema.tables where table_name='leads_activity'"` 期望 `0`
  - 冷启动复现（PROB-012）：`rm -rf apps/cms/.next` → 启 cms dev / astro dev 后**只等 TCP 端口 listen**（不用 HTTP 探活：冷编译会让探活请求自身超时）→ `pnpm --filter e2e test`。期望路由编译费全部落在 `globalSetup` 预热内，用例仍 `56 passed / 2 skipped`、`exit=0`
  - `aiws validate .`；`aiws change validate cleanup-batch-20260919 --strict`
- 期望：build 无 TS 错误；e2e 全绿（含新增 3 场景）；**验收命令零手填参数即可复现绿灯**（凭据由 `global-setup.ts` 从 gitignored secrets 注入，路由预热由用例自带）；负向失败点明确（首个 `/api/v2/*` 请求 500，非启动期）；`leads_activity` 表已消失；validate 与 change validate 均通过；AGENTS.md §9 清单逐条过。

## Evidence

- 持久：`.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md`（含各命令实际输出摘要 + R1 发布前置）
- 机读台账：`.aiws/changes/cleanup-batch-20260919/evidence/verification.jsonl`（每条验证一行 JSON：`command/exit_code/status/started_at/finished_at/artifact`，负向探针带 `expected_exit_code`），供 `aiws verify-bc` 判定
- 审查：`.aiws/changes/cleanup-batch-20260919/review/{quality-review,spec-review}.md`
- 临时：`.aiws/tmp/cleanup-batch-20260919/`（build/e2e 日志、负向启动报错文本）
