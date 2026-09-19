> **勾选态唯一真值 = 本文件**（`aiws change status/validate` 读的也是它）。同目录 `tasks/tasks.jsonl` 是 `aiws change start` 在计划期生成的**派发台账**（条目数与本文不逐一对应，供 `change tasks execute/complete` 调度），其 status 只用 `aiws change tasks complete` 推进、不手工伪造，也不作为完成判定的第二套账。

# Tasks: cleanup-batch-20260919

> Title: 清理批次：真值漂移+死模型+兜底+空目录+e2e缺口
>
> Created: 2026-09-19T09:11:18Z

## 0. Preflight

- [x] 0.1 阅读并遵守 `AI_PROJECT.md` / `AI_WORKSPACE.md` / `REQUIREMENTS.md`
- [x] 0.2 运行门禁校验：`aiws validate .`（批次起点跑一次基线，交付前再跑）
- [x] 0.3 若真值文件发生变化（例如你更新了 REQUIREMENTS.md），同步基线：`aiws change sync cleanup-batch-20260919`
- [x] 0.4 在 `.aiws/changes/cleanup-batch-20260919/proposal.md` 填写主索引绑定：`Change_ID` / (`Req_ID` or `Problem_ID`) / `Contract_Row` / `Plan_File` / `Evidence_Path`
- [x] 0.5 生成 `.aiws/plan/...` 后，确认计划文件中的绑定字段与 proposal 一致
- [x] 0.6 执行计划质检：`aiws plan-verify .` → 实测：`ok: plan verification passed`
- [x] 0.7 严格校验：`aiws change validate cleanup-batch-20260919 --strict` → 实测：`ok: change validated`（`exit=0`）；加跑默认未启的 `--check-evidence --check-scope` → 本批全部改动文件均在 allow-list 内，唯一残留为 `.aiws/memory-bank/` 两条（用户在先产物、本批不 stage），详见 evidence §A-13 与 PROB-011

## 1. 需求/问题合同（如适用）

- [x] 1.1 需求交付：补齐/更新 `REQUIREMENTS.md` 验收条款（REQ-0001/0002 移入「已完成」并按实测勾选；不新增需求）
- [x] 1.2 同步 `.aiws/requirements/requirements-issues.jsonl` 与 `.aiws/issues/problem-issues.jsonl`（问题台账现为 PROB-001..014：001..004 与 010、012 `DONE`（010 在本批内修掉并实测）、005..009 与 011、013、014 `OPEN` 另案处置不随本批静默修；需求合同两行刷新 `Tests`/`Evidence`/`Notes`/`Updated_At`）
- [x] 1.3 记录到 `.aiws/requirements/CHANGELOG.md`（删 `| YYYY-MM-DD |` 模板行 + 追加真值同步记录）
- [x] 1.4 删除 `.aiws/issues/problem-issues.jsonl` 遗留的模板种子行 `PROB-000`（`示例问题（模板种子）`，`Status=OPEN`）：它会让台账恒报一条不存在的开放问题，与 c9cbc2d 对 `requirements-issues.jsonl` 示例行的清理同源；删后台账全为真实问题（现为 PROB-001..014，本批新增 005..014）

## 2. 实现

- [x] 2.1 真值收敛：`REQUIREMENTS.md` 合并重复 `## Backlog`、REQ-0001/0002 连同验收条目移入「已完成」区；`CHANGELOG.md` 清理并追加
- [x] 2.2 CORS 配置先行：`apps/cms/.env.example` 增 `PUBLIC_CORS_ORIGINS`（三站 + localhost:4321 + 127.0.0.1:4321）；`scripts/cms-run.sh` 增 `: "${PUBLIC_CORS_ORIGINS:?}"` 并写入 `/opt/juece-grow/cms.env`；`docs/08-deployment.md` 生产关键项补齐
- [x] 2.3 CORS 去兜底：`apps/cms/src/lib/envelope.ts` 删 `DEFAULT_CORS_ORIGINS`，读不到 env（或解析后为空）即抛错；单一路径，无 dev 例外分支
- [x] 2.4 死模型删除：`apps/cms/src/collections/Leads.ts` 删 `activity` array 字段块；`payload generate:types` 再生成 `payload-types.ts`；以 dev 库生成并核对 drop 迁移（`leads_activity`）
- [x] 2.5 注释修正：`Leads.ts` 中指向不存在的 `lib/leadActivity` 的注释改指实际实现（`afterChange` 钩子内联）
- [x] 2.6 结构清理：删 `apps/cms/src/components`、`src/app/api/dev-seed`、`src/app/api/v2/sites/clone`、`src/app/dashboard`、`apps/cms/scripts`、根 `src/` 六个空目录（删前确认 `apps/cms/components/*` admin 组件解析仍可用）
- [x] 2.7 e2e 提醒扫描：`apps/e2e/tests/reminders.spec.ts` — admin 直调 Payload REST 造数（`createdAt` 30 天前的 new 线索、`nextFollowUpAt` 已过的 contacted 线索）+ 建 due/sla 规则 → `POST /api/v2/reminders/run` 断言 `created>0`、`reminder-notices` 落库、`LeadActivities` 出 `reminder`、重复调用 `created=0`、线索 status 未变（实测：due/sla 各命中 1 条，第二次扫描 `created=0`，通知与动态不翻倍）
- [x] 2.8 e2e 线索分配：`apps/e2e/tests/leads-assign.spec.ts` — `/api/leads/assign` 正常分配与越权/非法入参负向；另以 2 条 `test.fail` 用例固化实测到的真实缺陷（不存在 leadId 落 500 而非 404；端点分配丢审计 actor）→ 登记 PROB-005/PROB-006，本批不静默修
- [x] 2.9 e2e 站点复制：`apps/e2e/tests/sites-clone.spec.ts` — `/api/sites/clone` 产出可查站点、字段复制白名单、status/isTemplate 重置、跨项目落盘与负向信封；测试自清理（afterAll 删项目级联 + 断言零残留）
- [x] 2.10 本地 `.env` 补齐 `PUBLIC_CORS_ORIGINS`（否则 2.3 会让 dev 与 C5 用例失败）
- [x] 2.11 e2e 端点常量收敛：新增 `apps/e2e/helpers/origins.ts` 作为 CMS/公开站 origin 的**唯一**来源；原先 `helpers/cmsRest.ts:14`、`tests/lead.spec.ts:3-4`、`tests/security.spec.ts:16`、`playwright.config.ts` 的 `baseURL` 各写一遍字面量（改端口要动 5 处），现全部改为 import
- [x] 2.12 e2e 自带路由预热（PROB-012）：`apps/e2e/setup/global-setup.ts` 先按 TCP 判定 :3000/:4321 是否在监听，在则逐个命中用例要打的端点（`/api/v2/leads` 用 GET 触发同模块编译、405 不写数据），使 Turbopack 冷缓存下的首跑不再把 ~48s 的编译报成 30s 用例超时；不在监听则静默跳过，由用例自身的连接错误说明"服务没起"

## 2A. 协同（可选）

- [x] 2A.1 委托分析产物：INTAKE 决策树与实测事实已落盘 `.aiws/plan/2026-09-19-cleanup-batch.intake.md`（等效 analysis）
- [x] 2A.2 不使用 patch 草案（实现由 subagent 在工作树直接产出），本项记录决定
- [x] 2A.3 双审查落盘：`.aiws/changes/cleanup-batch-20260919/review/quality-review.md`、`review/spec-review.md`（schema 迁移属高风险，须双审查）

## 3. 验证（必须可复现）

> 命令均为零手填参数可复现；`CMS_ADMIN_*` 由 `apps/e2e/setup/global-setup.ts` 从 gitignored 的 `.aiws/secrets/test-accounts.json` 注入，无需导出环境变量。

- [x] 3.1 `pnpm --filter cms build` → 实测：`exit=0`，`✓ Compiled successfully in 11.8s`、`Running TypeScript` 无错误、`✓ Generating static pages (10/10)`；构建日志仅出现路由 `ƒ /api/v2/reminders/run`，无扫描/cron 输出 ⇒ 构建期未启动定时器。（首轮曾失败：`scripts/create-e2e-admin.ts` 的 `role: string` 过不了 users 联合类型，已改 `role: 'admin' as const` 后转绿）
- [x] 3.2 `pnpm db:up` → `pnpm --filter cms dev`（:3000）+ `pnpm astro:dev`（:4321）→ `pnpm --filter e2e test` → 实测：`Running 58 tests using 1 worker` / `2 skipped` / `56 passed (29.3s)`，连跑两次结果一致；2 个 skipped 为 C7 Chatwoot 缺 `CHATWOOT_WEBHOOK_SECRET`（既有约定）；2 个 `x`（expected-fail）为 PROB-005/006 的真实缺陷，符合预期失败
- [x] 3.3 `docker exec juece-grow-postgres psql -U juece -d juece_grow -tAc "select count(*) from information_schema.tables where table_name='leads_activity'"` → 实测：`0`（表已删）；同时 `users=3`（含 e2e-admin）、`projects=3`、`memberships=0`、`reminder_notices=0`，三个新 spec 造出的 `e2e提醒*`/`e2e分配*`/`e2e站点*` 记录计数均为 `0` ⇒ 零残留
- [x] 3.4 负向：`PUBLIC_CORS_ORIGINS= pnpm --filter cms dev` 后带任意 Origin 请求 `/api/v2/content/articles?site=juece` → 实测：客户端 `http_status=500` 且响应体为空（不外泄堆栈）；服务端日志 `.aiws/tmp/cleanup-batch-20260919/cors-failfast-dev.log:29` 打印 `Error: PUBLIC_CORS_ORIGINS 未配置或为空：CORS 白名单无内置默认…`。注意语义修正：抛错发生在**首个请求**（`allowedOrigin()` 在 handler 内被调用），不是进程启动即崩；因此部署门禁前移到 `scripts/cms-run.sh` 的 `:?` 检查（2.2）
- [x] 3.5 收口门禁（所有编辑定格后依次执行）：`aiws change sync cleanup-batch-20260919` → `aiws validate . --stamp` → `aiws change validate cleanup-batch-20260919 --strict` → 实测：`✓ aiws change sync`（`Changed files: REQUIREMENTS.md`）/ `✓ aiws validate: F:\juece-grow` / `ok: change validated` `exit=0`；三份工件见 evidence §A-8。**范围由工具校验过**：另跑 `--strict --check-evidence --check-scope` 后，本批改动文件全部落在 plan 的机读 allow-list 内，唯一被报越界的是 `.aiws/memory-bank/` 两条（你在先产物，本批不 stage）——注意默认 `--strict` 并**不**含 scope/evidence 校验，故旧写法「期望：均通过，无 scope 越界」属空签，已按实测改写（见 evidence §G·H2 与 PROB-011）
- [x] 3.6 AGENTS.md §9 自检清单逐条过（camelCase 三层映射、无兜底/双写、自研文件 ≤1000 行、SEO 无回归、影响范围已说明、线索仍在自有 Postgres）
- [x] 3.7 验证本身可机器复核：`evidence/verification.jsonl`（32 条，全 `status=success`；负向用例带 `expected_exit_code`，逐条指向 `.aiws/tmp/cleanup-batch-20260919/` 工件）⇒ `aiws verify-bc` 不再报 `legacy evidence assumed`。含三条专项复跑：① 缓存真空（`rm -rf apps/cms/.next`、脚本层不预取）下 e2e 仍 `56 passed / 2 skipped`，证明 PROB-012 的预热已内置于 `global-setup.ts`；② 所有编辑定格后的最终树复跑（见 evidence §A-16、dev-log §8.3/§8.4）；③ 提交后独立审查修复轮（去 `backup.mjs` 库名兜底、去 `cmsRest.ts` 两条 `??` 死兜底、预热按 origin 分流并回补 2 个目标）后全量复跑 `56 passed (1.3m) / 2 skipped`（见 evidence §A-17、dev-log §8.5）

## 4. 交付与归档

- [x] 4.1 证据落盘到 `.aiws/tmp/cleanup-batch-20260919/`（build/e2e 日志、负向报错、psql 计数）
- [x] 4.2 生成持久证据：`aiws change evidence cleanup-batch-20260919`
- [x] 4.3 交叉审计：`ws-quality-review` + `ws-spec-review` 双审查，HIGH blocker triage 后收敛
- [ ] 4.4 收尾：`aiws verify-bc` → `aiws commit` → `aiws change finish cleanup-batch-20260919`（归档并生成 handoff）

## 5. 移交（不计入本批完成判定的开放项）

- [x] 5.1 生产侧发布前置（迁移在生产不会自动生效、执行前行数与账本核实、`PUBLIC_CORS_ORIGINS` 注入、部署后回归、运维核对清单）已移交 `evidence/release-prerequisites.md`。本批全程只连本地容器库 `127.0.0.1:5434`，未触碰线上资源。
- [x] 5.2 本批新发现且**不随批静默修**的 10 项（PROB-005..014）与本地迁移账本 R5 事实已移交 `evidence/follow-ups.md`；台账真值在 `.aiws/issues/problem-issues.jsonl`（PROB-005..009、011、013、014 = OPEN；PROB-010、012 在本批内修掉并实测）。
