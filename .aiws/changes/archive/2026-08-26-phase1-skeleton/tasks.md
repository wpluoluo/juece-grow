> **Data source**: `.aiws/changes/phase1-skeleton/tasks/tasks.jsonl` — machine-readable task list with dependencies and verification criteria.

# Tasks: phase1-skeleton

> Title: Astro + Payload + Postgres 工程骨架（单站点 + 表单线索入池）
>
> Created: 2026-08-25T12:42:59Z

## 0. Preflight

- [x] 0.1 阅读并遵守 `AI_PROJECT.md` / `AI_WORKSPACE.md` / `REQUIREMENTS.md`
- [x] 0.2 运行门禁校验：`aiws validate .`（或 `npx -y @aipper/aiws validate .`）
- [x] 0.3 若真值文件发生变化（例如你更新了 REQUIREMENTS.md），同步基线：`aiws change sync phase1-skeleton`
- [x] 0.4 在 `.aiws/changes/phase1-skeleton/proposal.md` 填写主索引绑定：`Change_ID` / (`Req_ID` or `Problem_ID`) / `Contract_Row` / `Plan_File` / `Evidence_Path`
- [x] 0.5 生成 `.aiws/plan/...` 后，确认计划文件中的绑定字段与 proposal 一致
- [x] 0.6 执行计划质检：在 AI 工具运行 `aiws plan-verify`（或按同等清单手工检查“章节/步骤粒度/验证命令与预期”）
- [x] 0.7 严格校验：`aiws change validate phase1-skeleton --strict`

## 1. 需求/问题合同（如适用）

- [x] 1.1 需求交付：补齐/更新 `REQUIREMENTS.md` 验收条款（或确认不需要）
- [x] 1.2 同步 `.aiws/requirements/requirements-issues.jsonl`（或更新 `.aiws/issues/problem-issues.jsonl`）
- [x] 1.3 记录到 `.aiws/requirements/CHANGELOG.md`（如需求发生变化）

## 2. 实现

- [x] 2.1 monorepo 根：`package.json`（pnpm workspaces）+ `pnpm-workspace.yaml` + `.gitignore` 托管块
- [x] 2.1a 本机运行：根 `docker-compose.yml` 仅起 postgres（DATABASE_URI=localhost:5434）；cms/astro dev 跑 host
- [x] 2.2 `apps/cms`：Payload 3 初始化 + Postgres 连接（@payloadcms/db-postgres）+ 环境配置
- [x] 2.3 `apps/cms`：首批 collections（Project / Site / Article / Lead / Form）
- [x] 2.4 `apps/cms`：表单提交 API（/api/v2，写入 Lead）
- [x] 2.5 `apps/astro`：Astro SSG 骨架 + 布局 + 首页
- [x] 2.6 `apps/astro`：文章详情静态渲染 + 从 Payload 拉取数据
- [x] 2.7 共享 /api/v2 信封与统一错误规范落地
- [x] 2.8 e2e 烟测：Playwright 提交表单 → Lead 落库 → /api/v2 返回 `{success:true,data}`（`apps/e2e` 或独立 e2e 包）

## 2A. 协同（可选）

- [x] 2A.1 若使用委托分析：把结果落盘到 `.aiws/changes/phase1-skeleton/analysis/`
- [x] 2A.2 若使用 patch 草案：把结果落盘到 `.aiws/changes/phase1-skeleton/patches/`，并记录是否采用
- [x] 2A.3 若存在多审查者：把审查结果落盘到 `.aiws/changes/phase1-skeleton/review/`

## 3. 验证（必须可复现）

- [x] 3.1 `pnpm install` 成功
- [x] 3.2 `pnpm --filter cms dev` 启动，Payload admin 可登录，首批 collections 列表可见
- [x] 3.3 `pnpm --filter astro dev` 启动，首页/文章详情渲染出 Payload 数据
- [x] 3.4 提交表单 → Lead 落库，/api/v2 返回 `{ success: true, data }`
- [x] 3.5 e2e 烟测通过：`pnpm --filter e2e test`（表单提交→Lead 落库→信封断言 DONE）

## 4. 交付与归档

- [x] 4.1 证据落盘到 `.aiws/tmp/...`（报告/日志/请求响应等）
- [x] 4.2 生成持久证据：`aiws change evidence phase1-skeleton`
- [x] 4.3 交叉审计（可选但推荐）：在 AI 工具内运行 `/ws-review`（或按 `AI_PROJECT.md` 手工审计）
- [x] 4.4 收尾：`aiws change finish phase1-skeleton --push`（成功后自动归档并生成 handoff）