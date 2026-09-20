# Intake: cleanup-batch-20260919

> Generated: 2026-09-19 · Change: cleanup-batch-20260919 · Req: —（TECHDEBT 批次，归因待登记 Problem_ID）

## 工作区上下文（Context-Aware Intake 预填）

```
未提交改动: .aiws/memory-bank/.index.yaml (+11)  ·  新增 decision/analysis/chatwoot-offline.md（未跟踪）
最近提交:   c9cbc2d chore(aiws): 修正需求合同漂移——REQ-0002 置 DONE 并清理示例行
Change 分支: 无（change/* 全部已归档进 main）      Stash: 无
孤立 Intake: 无（.aiws/plan 下仅两份已完成 change 的 plan）
品牌配置:   无 aiws/brands.yml
Goals:      .aiws/goals/ 不存在（本 goal 为首个）
真值文件:   AI_PROJECT.md ✓ / REQUIREMENTS.md ✓ / AI_WORKSPACE.md ✓
合同现状:   REQ-0001、REQ-0002 均 Spec_Status=READY · Impl_Status=DONE
归因入口:   .aiws/issues/problem-issues.jsonl 仅含 PROB-000 模板种子 → 本批次无 Problem_ID 可挂（AI_PROJECT.md §3.1 阻断）
ws-goal 契约: ws-goal-contract.md 在本仓不存在 → state.json 按 SKILL.md §7.2 描述 + `aiws goal advance --phase` 取值集构造
```

## 范围（用户已批准「按顺序开工」）

| # | 事项 | 类型 | 归因 |
|---|---|---|---|
| 1 | REQUIREMENTS.md 两份重复 `## Backlog` 段 / 验收框全未勾 / 已完成区仅注释示例；CHANGELOG.md 残留 `\| YYYY-MM-DD \|` 模板行 | 真值合同对齐 | REQ-0001/REQ-0002 |
| 2 | `apps/cms/src/collections/Leads.ts:379` 死字段 `activity`（array）+ 迁移基线建出的 `leads_activity` 表 | 删双写死模型（红线 §4） | 新 Problem_ID |
| 4 | `apps/cms/src/lib/envelope.ts:7` `DEFAULT_CORS_ORIGINS` 缺 env 兜底 | 收敛兜底为 fail-closed | 新 Problem_ID |
| 5 | 6 个空目录 + 指向不存在的 `lib/leadActivity` 的注释 | 结构清理 | 新 Problem_ID |
| 6 | e2e 未覆盖：提醒扫描、`/api/leads/assign`、`/api/sites/clone`、后台文章编辑 | 测试补齐 | 新 Problem_ID |

排除（不代用户决策）：#3 Astro 首页/功能/方案/价格文案是否入 CMS（产品范围）；#7 `reference/juecesass-marketing-20260825/` 旧 Vue 站是否出库（删已入库内容）。

> **2026-09-20 裁决回填**（不改动上面的原始排除记录）：#7 决定删除 ⇒ 移入本批执行（16 文件 / 7 目录，见 plan Scope 与 tasks 2.13）；#3 决定做 ⇒ 属新增内容模型与站点取数，另立 change 交付，不并入本清理批。

## 决策树遍历

### 分支 A — #2 删字段的执行方式

- A1 现在生成 drop 迁移（schema 与表一并删）
  - 前置事实：dev 库 `select count(*) from leads_activity` = **0**（本轮实测，容器 `juece-grow-postgres`）；全库 grep `activity` 仅命中 `Leads.ts:379` 定义本身，零读写。
  - 判定：非「改关系/改类型」，属删死表，不触 AGENTS.md §7 数据红线；但 `payload.config.ts` 启 `drizzle` 迁移，删列需提交迁移文件，属高风险 → §8 要求双审查。
  - **UNRESOLVED_BRANCH-A1**：线上库同表行数未核实（见分支 D）。
- A2 只删 schema 定义、迁移留待下个发布窗口 → 会留下 dev/prod schema 漂移，违反「不留双路径」，不取。
- A3 保留字段标 deprecated → 违反 §4 禁止兼容写法，不取。
- 推荐：**A1**，以线上库核实为放行条件。

### 分支 B — #4 CORS 收敛的顺序（关键风险）

实测事实（本轮盘查，非推断）：

- `PUBLIC_CORS_ORIGINS` 在**全仓任何配置里都不存在**——`apps/cms/.env.example` 仅 3 个变量（DATABASE_URI / PAYLOAD_SECRET / NEXT_PUBLIC_SERVER_URL），`docker-compose.prod.yml` 只编排 Chatwoot，`Dockerfile.cms` runner 段只设 NODE_ENV/HOSTNAME/PORT，`docs/08-deployment.md:99` 生产关键项只列 DATABASE_URI / PAYLOAD_SECRET / CHATWOOT_WEBHOOK_SECRET。
- 结论：**线上当前依赖 `DEFAULT_CORS_ORIGINS` 生效**。直接删默认值 = 三个公开站（juece.cloud / erp. / yunque.）的跨端留资 POST 与内容拉取被浏览器 CORS 全量拦截。

由此 #4 不是纯代码收敛，而是「配置先行 → 再删默认」的两步批次（先固化再动手）：

1. B1 先补配置：`apps/cms/.env.example`、`docs/08-deployment.md` 生产关键项、Dockerfile/1panel 环境变量说明写入 `PUBLIC_CORS_ORIGINS`，并在部署侧实际注入生效。
2. B2 后删默认：移除 `DEFAULT_CORS_ORIGINS`，改为读不到 env 即不颁发任何 CORS 头（或直接启动失败，见 B3）。
- **UNRESOLVED_BRANCH-B1**：B1 第 2 步是服务器侧人工动作，本仓无生产凭据（`secrets/` 不存在，40ce2d1 已去敏）。
- B3 收敛强度待定：「缺 env → 不出 CORS 头」（静默 fail-closed）vs「缺 env → 启动抛错」（硬失败）。AGENTS.md 无兜底条款倾向前者易被误认为正常工作，用户既往偏好为硬失败不静默兜底；但硬失败会改变容器启动契约。**推荐：dev/test 走 `.env` 提供、生产缺失即启动抛错。**

### 分支 C — #6 e2e 可测性

- C1 提醒扫描依赖时间条件（`nextFollowUpAt<=now`、`createdAt+graceHours<=now`）。可用「造一条 `createdAt` 在过去 30 天的 new 线索」满足，不需改产品代码引入时钟。
- C2 `src/app/api/dev-seed/` 是**空目录**（配置里声明过路由却无实现）→ 说明 seed 端点曾是计划内未落地。e2e 需要稳定种子数据，选项：
  - C2a 用 Playwright 直接调 Payload REST 以 admin 身份建数据（不新增产品代码）；
  - C2b 补 `dev-seed` 端点（新增公开面，扩大攻击面，需鉴权设计）。
  - **推荐 C2a**；C2b 属新功能，不并入清理批次。空目录 `dev-seed` 在 #5 中按「删除」处理（与 C2a 一致，不留未实现声明）。
- C3 覆盖优先级：提醒扫描（有业务规则、当前零覆盖）> assign > sites clone（涉及建站副作用）。后台文章编辑依赖 Lexical 交互，成本高、收益低 → 建议排除本批。

### 分支 D — 生产侧核实通道

#2 与 #4 的放行都需一次生产侧确认：

- D1 用户提供生产 Postgres 只读通道（或自行执行 `select count(*) from leads_activity` 并回报）。
- D2 无通道 → 本批只落「代码 + 迁移文件 + 配置文档」，`aiws verify-bc` 的线上生效部分标记为待人工执行，不声称已上线（既往反馈：分层汇报部署状态）。

## Verify（本批自证口径）

- `pnpm --filter cms build`（TS 校验 + 构建期不启定时器）
- `pnpm --filter e2e test`（须真实后端 + 真实 Postgres，禁内存库）
- `aiws validate .`、`aiws change validate cleanup-batch-20260919 --strict`
- 命名/行数/无兜底自检：AGENTS.md §9 清单

## 补充实测：#4 连带的测试侧改动

- `apps/e2e/tests/security.spec.ts:189` 的 C5 块以 `https://juece.cloud` 为白名单 Origin 断言 `Allow-Origin` 回显，命中的正是 `DEFAULT_CORS_ORIGINS`。删默认值后若测试环境无 env，C5 五个用例全红。
- `apps/e2e/playwright.config.ts` 无 `webServer` 配置，CMS(3000)/Astro(4321) 由人工预先启动 → 测试期 CORS 变量只能来自 `apps/cms/.env`（Next 自动加载 dotenv）。
- 因此 #4 必含子项：`apps/cms/.env.example` 增 `PUBLIC_CORS_ORIGINS`（含三站 + 本地 4321），并在 `docs/08-deployment.md:99` 生产关键项补齐该项，否则新环境照抄文档会直接踩坑。

## 阻塞报告

UNRESOLVED_BRANCH 共 3 项：A1（线上表行数）、B1（生产 env 注入）、B3（fail-closed 强度）。按 ws-goal §0.5，需用户显式确认或忽略后方可进入 PHASE 1。
