# Design: cleanup-batch-20260919

> Title: 清理批次：真值漂移+死模型+兜底+空目录+e2e缺口
>
> Created: 2026-09-19T09:11:18Z

## Context

- 约束来自 `AGENTS.md` §4（单文件 ≤1000 行、禁止兼容/双写/兜底）、§5（camelCase 三层映射）、§7（Payload schema 演进禁止破坏性改表丢数据）、§8（数据迁移属高风险，须双审查）；验证入口来自 `AI_WORKSPACE.md`（`start_cmd: pnpm --filter cms dev`、`health_check`、`playwright_test_cmd`、`test_db_url: postgres://juece:juece@127.0.0.1:5434/juece_grow`，禁内存库）。
- 部署形态：CMS 跑在 1Panel 网络内的容器（`scripts/cms-run.sh` → `127.0.0.1:3100`），数据库为服务器原生 PostgreSQL；本仓刻意不含生产凭据，敏感项经 `${VAR:?}` 外部注入。
- 用户裁定：本批「本地测试，先不管线上」→ 一切结论以本地 dev/test 自证，线上动作降级为文档化发布前置（tasks.md §5）。

## Goals / Non-Goals

**Goals:**
- 真值与合同一致（同一事实在 `REQUIREMENTS.md`、`.jsonl` 合同、CHANGELOG 三处不矛盾）。
- 消除两类违反红线的代码：双写死模型、缺省兜底。
- 结构干净：无空目录、无指向不存在文件的注释。
- 关键业务规则（提醒判重）与写侧端点（assign / clone）有可复现的端到端证据。

**Non-Goals:**
- 不改提醒业务规则本身；不改 Astro 内容来源；不引入 seed 端点；不触生产。

## Decisions

- **D-1（#2 删字段）现在就出 drop 迁移**：依据 dev 库 `leads_activity` 实测 0 行、全仓 `activity` 零读写。备选「只删 schema 留迁移到下窗口」会使 dev/prod schema 漂移，违反"只保留一条正确路径"，不取。
- **D-2（#4 强度）fail-fast 而非静默拒**：`PUBLIC_CORS_ORIGINS` 缺失即抛错。理由——静默不颁发 CORS 头的故障表现是"表单点了没反应"，排查成本远高于容器起不来；且 `cms-run.sh` 已是 `${VAR:?}` 风格，部署侧与运行侧同一种失败语义。
- **D-3（#4 顺序）配置先行**：变量先落到 `.env.example` / `cms-run.sh` / `docs/08-deployment.md`，再删代码默认值。因线上真实依赖默认值，顺序颠倒会在下次部署打断三站留资。
- **D-4（#6 造数）admin 直调 Payload REST**：不新增 `dev-seed` 端点。空目录 `src/app/api/dev-seed` 按删除处理，与 D-4 一致（不留"声明了但没实现"的入口）。提醒扫描的时间条件用"造 `createdAt` 在过去的数据"满足，不改产品代码引入可注入时钟。
- **D-5（范围纪律）`DATABASE_URI || ''` 不在本批**：与 D-2 同类兜底，但 Payload 在构建期同样读取该配置，直接抛错可能打断 `next build`；需单独设计"构建期/运行期"边界，不随清理批次静默扩范围。登记为后续独立 change。

## Risks / Trade-offs

- R1（已核实并更正）删表迁移**不会**在下次生产部署自动执行：`@payloadcms/db-postgres` 的 `connect.js:116` 判定「`NODE_ENV === 'production' && this.prodMigrations` 才 migrate」，而 `apps/cms/src/payload.config.ts` 的 `postgresAdapter({ pool })` 未传 `prodMigrations`，全仓亦无 `migrations.autoRun` 配置。后果：`leads_activity` 在线上继续惰性存在（不会丢数据，风险从"误删"变为"死表长期残留"），且真要清理必须在维护窗口对线上库显式执行 `payload migrate`——该执行会连带跑完所有待执行迁移，须先按 tasks §5.1 核实行数、§5.4 核实 `payload_migrations` 记账、并先跑 `scripts/backup.mjs`。evidence 明写"线上未执行、未核实"，不声称已上线。
- R2 部署契约变更使漏配即宕 → 这是选择的代价（换取不静默损坏）；缓解：错误文本点名变量名，`docs/08-deployment.md` 与 `.env.example` 给可直接复制的值。
- R3 删 `apps/cms/src/components` 可能影响 admin 组件解析 → 该目录为空，实际组件在 `apps/cms/components/`（`payload.config.ts` 的 `./components/*` 经 importMap 解析），删除前由 T5 显式验证 admin 可加载 Dashboard。
- R4 e2e 新增用例写真实 dev 库 → 每个用例自建自清（afterAll 删除所建记录），避免污染既有 C1–C5 断言。

## Migration / Rollback

正向（一次 change 内完成，但**生产执行时点由人工放行**）：

1. 删 `Leads.activity` 字段定义 → `pnpm --filter cms payload generate:types` 再生成类型。
2. 以本地 dev 库执行 `payload migrate:create`（或 `dev` 自动同步后导出），核对生成的迁移仅含 `leads_activity` 相关表/索引/约束的 DROP，不含任何其他列变更。
3. `pnpm --filter cms build` + `pnpm db:up` + dev 启服务 → 迁移在本地库落地 → `3.3` 计数为 `0`。
4. 配置先行项（`.env.example`、`cms-run.sh`、docs）与代码去兜底同批提交，保证「配置声明」和「消费代码」同时到位。

回滚：

- 代码/文档：`git revert` 本 change 提交。
- schema：反向迁移重建 `leads_activity` 表与 `Leads.activity` 字段（原表 0 行，重建无数据损失）。
- 配置：恢复 `envelope.ts` 默认数组即回到旧行为；`cms-run.sh` 去掉 `:?` 即恢复可选语义。
