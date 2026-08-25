# Spec-Review · phase1-skeleton（规范/流程/真值归因审查）

> 分支：`change/phase1-skeleton`（HEAD = `41a258c` 初始提交）
> 审查日期：2026-08-25
> 审查类型：spec 轴（流程 / 规范 / 真值归因）
> 审查范围：工作树相对 HEAD 的全部改动（含未跟踪的 `apps/`、`docker-compose.yml`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`）

---

## 0. Triage 结论

**无阻断（HIGH blocker）= 0 条。**
**告警（Warning）需在 finish 前逐条收敛 = 5 条。**
**Info 优化建议 = 4 条。**

整体结论：Phase 1 骨架在技术上正确、代码量小（所有自研文件远超 1000 行上限之下）、命名三层映射与兵马未动而真值先行（README / AI_WORKSPACE / docs 已从陈旧栈 Nuxt+MySQL+Prisma 修正为 Astro+Payload+Postgres）均到位。本次审查不阻塞分支合并，但存在 **1 处硬性红线（AGENTS §6 异常信封）未完全落地** 与 **作用域声明/工具校验与实改不完全一致** 的问题，建议在 `aiws change finish` 前补齐（见 §3 最小修复清单）。交付路径记为 `f:\juece-grow\.aiws\changes\phase1-skeleton\review\spec-review.md`（任务原始路径写为 `g:\juece-grow`,经确认仓库位于 `f:` 盘，`g:\` 不存在，按仓库实际盘符落盘）。

---

## 1. 逐项检查结果

| # | 检查项（Spec 轴） | 结果 | 说明 |
|---|---|---|---|
| 1.1 | 归因完整性 | **告警** | `Req_ID=REQ-0001` 已绑定，且 REQ-0001 确实存在于 `.aiws/requirements/requirements-issues.jsonl`（Spec_Status=DRAFT）。但：需求未回填到 `REQUIREMENTS.md` 验收条款；`Spec_Status` 仍为 DRAFT（Scenario/Inputs/Outputs/验收为空）；proposal 正文引用的合同文件名为 `requirements-issues.csv`，实际为 `.jsonl`。`Evidence_Path` 指向的文件尚未落盘（属交付前步骤，符合预期非阻断）。 |
| 1.2 | Plan_File 绑定一致性 | **通过** | `Plan_File=.aiws/plan/phase1-skeleton.md` 存在，其绑定字段（Change_ID/Req_ID/Contract_Row/Plan_File/Evidence_Path）与 proposal 完全一致。 |
| 2.1 | SCOPE：实改 vs 声明 | **告警** | 实改文件超出 proposal 声明 In Scope。proposal 仅声明 `apps/cms/**`、`apps/astro/**`、`package.json`/`pnpm-workspace.yaml`、`docs/**`、`.aiws/**`、`AGENTS.md`/`CLAUDE.md`。实改中 **`apps/e2e/**`、`docker-compose.yml`、`README.md`、`AI_WORKSPACE.md`、`.gitignore`（后者仅在 plan 声明）未列入 proposal In Scope**。 |
| 2.2 | SCOPE：工具校验覆盖 | **告警** | `metrics.json` 显示历次 `aiws change validate --strict` 均以 **`check_scope: false`** 运行，故工具并未对越界文件告警；`--strict` 通过不能等价于 scope 校验通过。 |
| 3.1 | 命名三层映射 camelCase | **通过** | collections 字段（name/slug/description/pathSlug/metaTitle/metaDescription/publishedAt/seoTitle/seoDescription/dedupKey 等）均为 camelCase；API 请求/响应字段（projectId/phone/wechat/dedupKey）camelCase；Payload slug（projects/sites/articles/leads/forms/users）与其 DB 映射一致，未发现 snake_case 泄漏到业务层。 |
| 4.1 | 红线：外部 CMS/内容 SaaS | **通过** | 依赖仅 payload + @payloadcms/db-postgres + @payloadcms/richtext-lexical + next/react；无 Strapi/Directus/Halo/Chatwoot 客户端。 |
| 4.2 | 红线：Prisma/MySQL/TipTap 落地 | **通过** | 数据层用 `@payloadcms/db-postgres`（Postgres）；富文本用 Payload 内置 **Lexical**（非 TipTap）；无 Prisma、无 MySQL 驱动。 |
| 4.3 | 红线：数据破坏 | **通过** | Postgres 为全新 Docker 实例（5434→5432），Payload 自管 schema，migration 为纯新增；无破坏性改表。 |
| 5.1 | API：/api/v2 统一信封（成功） | **通过** | `envelope.ts` 统一 `ok()`→`{success:true,data}`、`err()`→`{success:false,error:{code,message}}`，health 与 leads 成功/校验路径一致使用；e2e 对 `{success:true,data:{status:'ok'}}` 有精确断言。 |
| 5.2 | API：异常不抛堆栈/统一信封 | **告警** | `leads/route.ts` POST **无 try/catch 包裹** `payload.create`。数据库不可达 / Payload 抛错时会以 Next 默认 500 返回（非 v2 信封，且 dev 暴露内部错误详情），违反 AGENTS §6「不把数据库异常原样抛前端、统一信封」。 |
| 5.3 | API：入口一致性 | **通过** | health GET、leads POST、OPTIONS(CORS) 均走 envelope；CORS 允许 Astro 跨源（开发期约定，见注释）。 |
| 6.1 | 真值同步（README） | **通过** | HEAD 版 README 仍为陈旧栈「Nuxt 4.5.x / Vite 8 + MySQL 8 + Prisma 7 / 自有 Nuxt 服务端」；当前版本已修正为 **Astro 6 + Payload 3 + PostgreSQL 16 + Chatwoot 仅收件箱**。 |
| 6.2 | 真值同步（AI_WORKSPACE） | **通过** | `server_dirs=./apps/cms`、`web_dirs=./apps/astro`、`health_path=/api/v2/health`、postgres 5434 映射、`test_db_url=...:5434/...` 均与 docker-compose/.env.example 一致；`.ws-change.json` 已把 AI_WORKSPACE.md 变更纳入基线同步（truth_sync 事件存在）。 |
| 6.3 | 真值同步（docs） | **通过** | docs 中 Nuxt/MySQL/MongoDB 仅作为「决策对比纪录/历史背景」出现，无把陈旧栈当现行栈的表述；GATE-001 方案对比与实施一致。 |
| 7.1 | GATE-001 与 proposal 一致性 | **通过** | GATE-001 目标/作用域/不做项/风险与 proposal 的目标、非目标、Out of Scope 逐条一致（多站 Phase2、去重归因 Phase2、Lexical 前端渲染、Chatwoot Phase3、无外部 CMS 均对齐）。 |

---

## 2. Top findings

每条标注 [Critical/Warning/Info] + SPEC 归属。

1. **[Warning] SPEC-6 / AGENTS §6（API 规范）**：`apps/cms/src/app/api/v2/leads/route.ts` 的 POST 处理器未包裹 `payload.create`，数据库/未知异常会以 Next 默认 500（非 v2 信封、可能暴露内部信息）返回，未严格达到「不把数据库异常原样抛前端、统一信封」的硬性约定。建议 inline 加 `try/catch`，catch 后返回 `err('INTERNAL', '处理失败', 500)` 且不透出堆栈。
2. **[Warning] SPEC-1（归因/需求合规）**：`REQ-0001` 在 `requirements-issues.jsonl` 中仍为 `Spec_Status=DRAFT`（Scenario/Inputs/Outputs/验收为空），且未回填到 `REQUIREMENTS.md` 的验收条款区（tasks 1.1 未勾选）。作为本 change 唯一绑定的需求，验收真值缺项会削弱「需求→验收→测试」闭环。
3. **[Warning] SPEC-2（作用域声明）**：实改的 `apps/e2e/**`、`docker-compose.yml`、`README.md`、`AI_WORKSPACE.md`（及 `.gitignore`，仅在 plan 声明）未列入 proposal In Scope。且历次 `--strict` validate 均 `check_scope=false`，工具未校验越界。按 proposal 规则需在 delivery 时更新 In Scope 并解释。
4. **[Warning] SPEC-1（合同文件口径）**：proposal/tasks 正文与 AI_PROJECT §3.1 均引用「`requirements-issues.csv`」，但仓库实际真值文件为「`requirements-issues.jsonl`」。是为文档/规则与实现路径的口径漂移（`aiws validate` 本身认 jsonl 且通过，故属文案级、不阻断）。
5. **[Warning] SPEC-5（文档时序/配置同步）**：`design.md`（Decision）与 `tasks.md`（2.1a）均写 `DATABASE_URI=localhost:5432`，而实际 docker-compose 端口映射为 **5434:5432**、`.env.example`/`AI_WORKSPACE` 均为 `5434`。设计/任务文档滞后于实现，存在误导新接手者的可能。
6. **[Info] SPEC-3（安全-最小暴露）**：`Users.ts` `create: everyone`（`auth:true` 下开放公开注册）值得在 Phase 1 后收敛；`leads/route.ts` 的 `overrideAccess: true` 与 collection `create: everyone` 语义冗余（非双写，可留）。
7. **[Info] SPEC-4（耦合/占位）**：`apps/astro/src/pages/index.astro` 硬编码 `data-project-id="1"`，与「工程需先 seed project id=1」隐式耦合；建议后续改为 env 注入或默认站点解析，避免多站点时误绑。
8. **[Info] SPEC-6（环境变量口径）**：Astro 侧 `payload.ts` 用 `CMS_ORIGIN`，客户端脚本 `index.astro` 用 `PUBLIC_CMS_ORIGIN`（Astro 需 PUBLIC_ 前缀才暴露给 client），两者默认值同为 `http://127.0.0.1:3000`，当前各自正确；建议在 astro 包 `.env.example` 显式登记，避免后续误用非 PUBLIC_ 前缀。

---

## 3. 下一步最小修复清单（不阻塞合并，建议 finish 前收敛）

1. **（改动业务代码前必须解决）** `leads/route.ts` POST 增加 `try/catch`，异常统一返回 `err('INTERNAL', ..., 500)`，不透出 DB 异常/堆栈 —— 命中 AGENTS §6 硬性约定。
2. 在 `proposal.md` In Scope 补入 `apps/e2e/**`、`docker-compose.yml`、`README.md`、`AI_WORKSPACE.md`（及 `.gitignore`），或在 delivery 注明越界原因；后续 validate 建议开启 `check_scope` 跑一次。
3. 将 `REQUIREMENTS.md` 补入 REQ-0001 验收条款，并把 `requirements-issues.jsonl` 中 REQ-0001 的 `Spec_Status` 置为 READY；同步把 proposal/tasks/AI_PROJECT 中的 `.csv` 引用改为 `.jsonl`（或确认工具链后统一口径）。
4. 更新 `design.md`、`tasks.md` 中 `DATABASE_URI` 端口为 `5434`。
5. 交付前按 tasks 3.x 补齐 `evidence/verify-before-complete.md` 证据落盘（Evidence_Path 指向文件落地）。

> 本次审查**未改动任何业务代码**，仅评估与落盘。