# 贡献指南

juece-grow 是开源独立项目。欢迎提 issue、改文档、修 bug、补测试。先看这份说明，代码规范以 [AGENTS.md](AGENTS.md) 为准。

## 本地环境

- 包管理：pnpm（仓库用 `pnpm-workspace.yaml`，版本见根 `package.json:packageManager`）。
- 数据库：`pnpm db:up` 用 Docker 起 Postgres（5434），Payload 数据自持。
- 应用：`pnpm cms:dev`（后台）与 `pnpm astro:dev`（公开站）。
- 环境变量：复制 `apps/cms/.env.example`、`apps/astro/.env.example` 为 `.env` 按需填写。

## 改代码前

1. 读真值文档：`docs/01-plan.md`（需求）、`docs/02-architecture.md`（架构）、`docs/03-data-model.md`（数据模型）、`docs/06-roadmap.md`（当前阶段）。
2. 涉及 schema 变更读 Payload 官方迁移流程；改文案遵守账号内既有中英 i18n 对象与 `{zh,en}` 结构。
3. 行为准则（AGENTS.md 硬性约束）：
   - 自研文件单文件 ≤1000 行；禁止兜底、双写、兼容写法。
   - `camelCase`（业务）→ snake_case（Postgres 仅由 Payload 映射），不保留双套写法。
   - 对外 API 统一 `/api/v2` + `{ success, data }` / `{ success:false, error:{code,message} }` 信封。
   - 线索主数据只入自有 Postgres，不依赖第三方 SaaS 库存储。

## 提交与合并

- 提交走 conventional commits，例如 `feat(scope): 说明`、`fix(scope): 说明`。
- 变更尽量绑定 `change/<id>`，参考 `.aiws` 工作流；提交前跑 `pnpm build`（含 CMS 的 TS 校验与 Astro SSG）。
- 涉及数据迁移 / 权限 / 跨域等高风险改动，走 review 门禁后再合并。

## 测试

- 单测/接口（若有）与 E2E 在 `apps/e2e`，`pnpm e2e:test` 运行。
- 新增或修改线索、统计、webhook 相关逻辑时补对应用例。

## 文档口径

改字段、接口、集合时同步更新 `docs/*` 真值文档与 README，保证文档/代码/接口三者一致。