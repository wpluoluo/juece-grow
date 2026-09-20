# Goal: G-001 cleanup-batch-20260919

> Created: 2026-09-19 · Change: cleanup-batch-20260919 · Intake: .aiws/plan/2026-09-19-cleanup-batch.intake.md
> 归因：REQ-0001/REQ-0002 真值同步 + TECHDEBT（Problem_ID 见 §归因登记）

## Objective

把 juece-grow 三阶段交付后遗留的"真值漂移 + 死模型 + 兜底 + 空目录 + 测试缺口"一次收敛干净，全程以本地 dev/test 自证，线上零操作，且保证下次生产部署不会因为缺配置而静默损坏。

## Scope（6 项）

| # | 交付 | 落点 |
|---|---|---|
| 1 | REQUIREMENTS.md 合并重复 `## Backlog`、REQ-0001/0002 验收条目按本轮实测证据勾选并移入「已完成」；CHANGELOG.md 删 `\| YYYY-MM-DD \|` 模板行并追加本轮记录 | `REQUIREMENTS.md`、`.aiws/requirements/CHANGELOG.md` |
| 2 | 删除 `Leads.ts:379` 死字段 `activity` 与 `leads_activity` 表（Payload 迁移），同步再生成 `payload-types.ts` | `apps/cms/src/collections/Leads.ts`、`apps/cms/src/migrations/*` |
| 4 | CORS 去兜底：删 `DEFAULT_CORS_ORIGINS`，`PUBLIC_CORS_ORIGINS` 缺失即请求期硬失败（首个 `/api/v2/*` 500；部署侧由 `cms-run.sh` 的 `${VAR:?}` 前移到 `docker run` 之前）；配置先行写入 `.env.example`、`scripts/cms-run.sh`（必需变量 + cms.env）、`docs/08-deployment.md` §生产关键项 | `apps/cms/src/lib/envelope.ts`、`apps/cms/.env.example`、`scripts/cms-run.sh`、`docs/08-deployment.md` |
| 5 | 删 6 个空目录（`apps/cms/src/components`、`src/app/api/dev-seed`、`src/app/api/v2/sites/clone`、`src/app/dashboard`、`apps/cms/scripts`、根 `src/`）+ 修指向不存在的 `lib/leadActivity` 的注释 | 对应路径 |
| 6 | e2e 补 3 个场景：提醒扫描（due/sla 命中 + 判重）、`/api/leads/assign`、`/api/sites/clone`；造数走 admin 直调 Payload REST，不新增 seed 端点 | `apps/e2e/tests/*` |
| 7 | （2026-09-20 owner 裁决后追加）`reference/juecesass-marketing-20260825/` 旧 Vue 站快照出库：`git rm -r` 删 16 个已入库文件、清 7 个目录；`docs/07-design-theme.md` §2.1 的在盘回溯指针改写成版本化取回命令 `git checkout 41a258c -- reference/` | `reference/`（删除）、`docs/07-design-theme.md` |

## Non-goals（明确不做）

- #3 Astro 首页/功能/方案/价格文案入 CMS —— **2026-09-20 已批准**；属新增内容模型（产品功能），另立 change，不在本目标范围。
- ~~#7 `reference/juecesass-marketing-20260825/` 出库~~ —— **2026-09-20 裁决「删掉」，已移入本批执行**（16 文件 / 7 目录）。
- 后台 Lexical 文章编辑的 e2e —— 成本高收益低，移出本批。
- 任何生产服务器操作（SSH、改 1panel 环境变量、跑线上 SQL）—— 本批全部以本地自证。
- 新增 `dev-seed` 公开端点 —— 扩大攻击面，属新功能。

## 冻结的分支决策

- **A1**：#2 现在就出 drop 迁移（dev 库实测 0 行、全库零读写）。发布前置条件写入证据：线上执行前核实行数并留备份。
- **B3 = 硬失败**：`envelope.ts` 读不到 `PUBLIC_CORS_ORIGINS` 即抛错，不静默降级；`cms-run.sh` 用 `${PUBLIC_CORS_ORIGINS:?}` 让漏配在部署阶段即终止。只保留一条路径，不留 dev 例外。
- **C2a**：e2e 造数以 admin 身份直调 Payload REST；`src/app/api/dev-seed` 空目录按删除处理。
- **D2**：线上部分不出具"已上线"结论，仅在 evidence 标发布前置（分层汇报）。

## 顺带发现（本批不擅自动手，登记待决策）

- `payload.config.ts:242` `connectionString: process.env.DATABASE_URI || ''` 属同类兜底，但 Payload 构建期（`NEXT_PHASE`）也读该配置，直接抛错可能打断 `next build`。需单独设计验证口径后再并入，不随本批静默扩大范围。
- 迁移在生产**不会自动执行**（已核实源码）：`@payloadcms/db-postgres/dist/connect.js:116` 仅在 `NODE_ENV=production && prodMigrations` 时 migrate，而 `payload.config.ts` 只传 `pool`、全仓无 `migrations` 配置 ⇒ 删表须维护窗口显式 `payload migrate`；本地账本 `payload_migrations` 也不含该迁移行（DDL 经 psql 落库）。已写入 tasks §5 发布前置。
  - **2026-09-20 owner 处置：不为这张空表单独开维护窗口**（线上表存在不影响功能、不丢数据），攒到下次真实功能上线一并执行。发布前置清单继续留在 `evidence/release-prerequisites.md`，本批不声称线上已清理。

## Completion Criteria

1. `pnpm --filter cms build` 通过（TS 校验、构建期不启定时器）。
2. `pnpm --filter e2e test` 在真实 CMS + 真实 Postgres（容器 5434，禁内存库）下全绿，且包含本轮新增 3 个场景。
3. 缺 `PUBLIC_CORS_ORIGINS` 时首个 `/api/v2/*` 请求 500 且错误文本点名该变量（负向验证；进程能 Ready）；配齐时 C5 五个用例仍绿。
4. `select count(*) from information_schema.tables where table_name='leads_activity'` 在本地库为 0（迁移确实删表）。
5. `REQUIREMENTS.md` 无重复 `## Backlog`、无未勾的已完成需求；`aiws validate .` 与 `aiws change validate cleanup-batch-20260919 --strict` 通过。
6. 6 个空目录不存在；全库无指向 `lib/leadActivity` 的注释。
7. AGENTS.md §9 自检清单逐条过（命名 camelCase、无兜底/双写、文件 ≤1000 行、影响范围已说明）。

## Verification Commands

```bash
pnpm --filter cms build
pnpm db:up && pnpm --filter cms dev        # 需 CMS 就绪后再跑 e2e
pnpm --filter e2e test
aiws validate .
aiws change validate cleanup-batch-20260919 --strict
```

## 归因登记（前置，AI_PROJECT.md §3.1）

`#2/#4/#5/#6` → 本批新登记 `PROB-001`(死模型双写) / `PROB-002`(CORS 兜底) / `PROB-003`(空目录与失效注释) / `PROB-004`(e2e 覆盖缺口)，写入 `.aiws/issues/problem-issues.jsonl`；`#1` 归 `REQ-0001/REQ-0002` 合同同步。

## Progress Notes

- 2026-09-19 INTAKE：真值/代码/部署脚本盘查完成，4 项 UNRESOLVED 已在对话冻结；用户裁定「本地测试，先不管线上」。

## Audit Trail

- Router：`goal_driven`（≥3 文件 / 跨模块 / 含 Payload 删表）→ `ws-goal`。
