# Change Proposal: phase1-skeleton

> Title: Astro + Payload + Postgres 工程骨架（单站点 + 表单线索入池）
>
> Created: 2026-08-25T12:42:59Z

## 目标与非目标

**目标：**
- 建立 monorepo：`apps/astro`（公开站，SSG）+ `apps/cms`（Payload 3 自托管后台）。
- `apps/cms` 可跑通：连接 PostgreSQL 16、Payload Auth、首批 collections（Project / Site / Article / Lead / Form）。
- `apps/astro` 可跑通：SSG 骨架 + 首页/文章详情静态渲染 + 从 Payload 拉取数据（单站点）。
- 表单提交可将线索写入自有 Postgres 的 Lead。
- 共享信封 `/api/v2` 与统一错误规范生效。

**非目标：**
- 多项目/多域名挂站（Phase 2）。
- 去重合并/归因/CRM 插件（Phase 2 验明插件能力后再定）。
- 富文本 Lexical 前端渲染组件（先以结构化字段/列表代替正文）。
- Chatwoot 收件箱接入（Phase 3）。
- 任何外部 CMS / 内容 SaaS 引入。

## 主索引绑定（强制）

- `Change_ID` = phase1-skeleton
- 需求交付：`Req_ID` = REQ-0001
- 问题修复：`Problem_ID` = N/A
- `Contract_Row` = Req_ID=REQ-0001
- `Plan_File` = .aiws/plan/phase1-skeleton.md
- `Evidence_Path` = .aiws/changes/phase1-skeleton/evidence/verify-before-complete.md

## 依赖关系（可选）

- `Depends_On` = N/A
- `Blocks` = phase2-multisite, phase2-lead-dedup-attribution

> 规则：
> - `Depends_On` 的 change 应已完成（archived）；未完成时 `aiws change start` 会输出警告。
> - `Blocks` 用于记录依赖关系，便于后续 change 读取交接文档。
> - 依赖字段为可选，不强制填写。

> 规则：
> - `Req_ID` 与 `Problem_ID` 至少填写一项。
> - `Contract_Row` 必须引用 `.aiws/requirements/requirements-issues.jsonl` 或 `.aiws/issues/problem-issues.jsonl` 中的真实行。
> - `Plan_File` 对应的计划文件必须存在，且其绑定字段与本文件一致。
> - `Evidence_Path` 可先声明计划路径，交付前需完成证据落盘。

## 现状与问题

- 仓库前身为纯文档仓库，无任何可运行代码；有真值文档 docs/01~06 与 GATE-001 门禁（docs/gates/）。
- 痛点：无工程骨架，无法发文章、无法收表单线索，多产品增长平台无法落地。
- 本 change 以 GATE-001 为准，门禁方案对比已在该文件 §2 记录（Astro/Postgres/Payload 已定）。

## 方案概述（What changes）

- 新建 monorepo 根 `package.json`（pnpm workspaces）+ `.gitignore` 托管块。
- 新增 `apps/cms`（Payload 3 + Postgres）：Payload 初始化、数据库连接、Auth、首批 collections（Project / Site / Article / Lead / Form）+ 表单提交 API（/api/v2）。
- 新增 `apps/astro`（Astro SSG）：布局、首页、文章详情静态渲染，从 Payload 拉取；引入 /api/v2 信封。
- 文档：docs 已同步新栈；本 change 新增 .aiws 门禁工件（proposal/design/tasks）。
- 无 BREAKING：全新增，无既有接口/数据被破坏。

## 协同与委托（可选）

- `analysis/`：
  - `.aiws/changes/phase1-skeleton/analysis/payload-rest-contract.md` — 明确 Payload REST 拉取字段与 /api/v2 映射。
- `patches/`：
  - 无。
- `review/`：
  - `.aiws/changes/phase1-skeleton/review/spec-review.md`、`review/quality-review.md` — 高风险/跨域按 AGENTS §8 双审查。

> 规则：
> - `analysis/` 产物默认只作为输入依据，不等于实现完成。
> - `patches/` 中的 patch 草案不自动应用，必须经主 agent 或人工审查。
> - 交付前建议把协同结果收敛到 `review/` 或 `evidence/`，并回填 `Evidence_Path`。

## 影响范围（Scope）

### In Scope（本次改动范围）

> 列出允许修改的文件/目录（支持 glob 模式）；用于 `aiws change validate --check-scope` 检查越界改动。

- `apps/cms/**` - Payload 后台（collections / auth / db / API）
- `apps/astro/**` - 公开站（SSG 页面 / 布局 / 数据拉取）
- `apps/e2e/**` - Playwright 烟测
- `package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` - monorepo 根
- `docker-compose.yml` - 本地 Postgres 容器
- `README.md` / `AI_WORKSPACE.md` / `.gitignore` - 配置与真值同步
- `docs/**` - 真值文档同步
- `.aiws/**` - 门禁工件
- `AGENTS.md` / `CLAUDE.md` - 治理与上下文（如需）

### Out of Scope（明确不改动）

- 不引入任何外部 CMS / 内容 SaaS
- 不改动数据迁移历史（Postgres 为全新实例，Payload 自管 schema）
- 不实现 Phase 2 的多站/归因/去重

### 外部影响

- 新增对外 API：`/api/v2`（成功/失败统一信封）
- 新增 Payload admin 路由（后台管理入口）

> 规则：
> - 实际改动超出 In Scope 时，需在 delivery 时解释原因并更新本章节。
> - 可使用 `aiws change validate --check-scope` 检查越界文件。

## 风险与回滚

- 风险：
  - Payload + Astro 集成非官方第一顺位，需自拼拉取链路 → 用 Payload REST/SDK + 文档化模板，Phase 1 先以单站点验证。
  - 工程范围膨胀拖速度 → 严格按本门禁作用域，超出即拆下一门禁。
  - 数据/配置升级丢数据 → Postgres 全新实例由 Payload 自管 schema，遵循 AGENTS §7 迁移纪律（本期以加字段为主）。
- 回滚方案（必须可执行）：
  - 全部为新增文件，无既有代码被破坏 → 直接移除 `apps/` 与新配置即可回退到纯文档状态；`git revert` 首个提交。

## 验证计划（必须可复现）

> 从 `AI_WORKSPACE.md` 选择最贴近本变更的验证入口，写成可直接复制执行的命令。

- 命令：
  - `pnpm install`（安装 monorepo 依赖）
  - `pnpm --filter cms dev`（启动 Payload，连本地 Postgres）
  - `pnpm --filter astro dev`（启动 Astro SSG，从 Payload 拉取首页与文章）
  - 提交一个表单 → 在 Payload admin 的 Lead 中看到该线索
- 期望结果：
  - Payload admin 可登录，首批 collections 列表可见。
  - Astro 首页/文章详情能渲染出从 Payload 拉取的数据。
  - 表单提交后 Lead 落库，/api/v2 返回 `{ success: true, data }`。
  - 自检清单（AGENTS §9）全过：命名 camelCase、无外部 CMS、/api/v2 信封、SEO 字段、线索在自有 Postgres、文件 ≤1000 行、影响范围已说明。

## 真值文件/合同更新清单

- `REQUIREMENTS.md`：需要 —— `aiws init` 已生成，待按 docs/06-roadmap Phase 1 更新验收条款
- `.aiws/requirements/CHANGELOG.md`：需要
- `.aiws/requirements/requirements-issues.jsonl`：需要（登记 PHASE1-SKELETON）
- `.aiws/issues/problem-issues.csv`：N/A
- 证据落盘（推荐双层）：
  - 持久（建议入库）：`.aiws/changes/phase1-skeleton/evidence/verify-before-complete.md`
  - 协同（按需）：`.aiws/changes/phase1-skeleton/review/spec-review.md`、`review/quality-review.md`
