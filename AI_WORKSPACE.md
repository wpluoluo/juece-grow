# AI_WORKSPACE.md（工作区说明）

## 0) 项目配置（用户维护）

本段由用户维护；`aiws update` 不会改动本段（建议把“可变参数”都放在这里）。

- server_dirs:
  - ./backend
- web_dirs:
  - ./web
- app_dirs:
  - ./app

- openapi_path: "docs/openapi.json"
- openapi_url: "/openapi.json"

- base_url: "http://127.0.0.1:8080"
- health_path: "/health"
- log_path: ".aiws/tmp/server-test/app.log"

- environment: "test"
- base_url_allowlist:
  - "http://127.0.0.1"
  - "http://localhost"
  - "https://127.0.0.1"
  - "https://localhost"
- dangerous_disabled: true
- max_requests_per_minute: 60

- node_version: "20"
- node_use_cmd: "command -v mise >/dev/null && mise use -g node@20 || (command -v nvm >/dev/null && nvm use 20) || true"

- playwright_test_cmd: "cd {web_dir} && npx playwright test"
- start_cmd: "cd {service_dir} && npm start"
- health_check: "curl -f http://127.0.0.1:8080/health"

- test_db_url: "jdbc:mysql://127.0.0.1:3306/test"  # 后端单元测试连接的 dev/test 真实数据库（禁止 H2 等嵌入式/内存库）
- test_db_cmd: "mysqladmin ping -h 127.0.0.1"      # 测试库连通性检查命令（可选，用于验证库可用）

<!-- AIWS_MANAGED_BEGIN:ai-workspace:core -->

本文件描述“AI Workspace（多子项目工作区）”的结构与运行方式，供 OpenCode 读取。

## 1) 目录发现规则

目录名不固定时，按以下优先级寻找 server（后端服务）目录：
1. 明确配置（推荐）：在上方 `0) 项目配置` 写出 `server_dirs` 列表（相对路径）
2. 自动发现：扫描子目录，匹配以下标记文件
   - Rust：`Cargo.toml`
   - Go：`go.mod`
   - Java：`pom.xml` 或 `build.gradle` / `build.gradle.kts`

可选：前端目录同理（`package.json` + 常见前端脚手架特征），请在上方 `web_dirs/app_dirs` 写死路径。

## 1.1) 接口清单来源（强烈建议）

为保证自动化测试覆盖“全部已实现接口”且可复现，优先使用 OpenAPI 作为接口清单真值来源。

请在上方 `0) 项目配置` 填写：
- `openapi_path`：固定路径（推荐 `docs/openapi.json`）
- `openapi_url`：服务运行时导出 OpenAPI 的 URL（缺省时 runner 会按常见路径尝试 `/openapi.json`、`/v3/api-docs`、`/swagger.json` 等）

如 OpenAPI/Knife4j 受 basic/bearer 保护，可在 `secrets/test-accounts.json` 配置 `openapi_auth`（支持 headers/basic/bearer；未填则沿用 API 鉴权）。

规则：
1) 若 `docs/openapi.json` 存在，则以其生成接口清单（优先级最高）
2) 否则尝试通过 `openapi_url` 从运行中的服务导出并写入 `docs/openapi.json`
3) 若仍不可用，才降级到路由导出/代码扫描（兜底）

## 2) 服务启动与构建（可覆盖）

默认策略：
- Rust：`cargo build`，启动 `cargo run` 或 `./target/<bin>`
- Go：`go test ./...`，启动 `go run ./cmd/<app>`（按项目调整）
- Java：`./mvnw -q -DskipTests package`，启动 `java -jar target/*.jar`

如果你的项目不是上述结构，请在上方 `0) 项目配置` 写死命令（推荐）：
- `build_cmd` / `start_cmd` / `stop_cmd`（用于 runner 的 `--manage-service`）

占位符：
- `{service_dir}`：服务目录的绝对路径
- `{service}`：服务目录名（Path.name）

## 2.1) Git / Submodule 提交（可选）

如果你的工作区使用 git submodule 管控后端/前端目录，建议把 server 目录固定写入 `server_dirs`，并把“提交动作”独立出来：
- 先 `/server-test-plan` → `/server-test` 跑到验收通过
- 再 `/server-commit` 对 `server_dirs` 指定的 submodule 做 commit，并在工作区根仓库提交 submodule 指针更新

建议 commit message 保持通用简洁，优先使用中文；英文也可以，例如：
- `修复: API 健康检查空指针`
- `构建: 调整 server 测试脚本`
- `杂项: 更新 workspace submodule 指针`

## 3) 测试入口

默认：
- BASE_URL: `http://127.0.0.1:8080`
- HEALTH_PATH: `/health`（或 Spring Boot `/actuator/health`）

请在上方 `0) 项目配置` 覆盖：
- `base_url` / `health_path` / `log_path`

## 3.2) web/app 的单元测试命令（推荐必填）

为了让"需求→实现→测试→提交"闭环在多子项目工作区中可自动执行，**推荐必填**，在上方 `0) 项目配置` 写死：
- `web_test_cmd` / `web_build_cmd`
- `app_test_cmd` / `app_build_cmd`

占位符：
- `{web_dir}`：web 目录的绝对路径
- `{app_dir}`：app 目录的绝对路径

## 3.3) web 的 Playwright E2E 测试（条件必填）

当项目存在前端代码且改动涉及非 pure-ui 的前端逻辑时，Playwright E2E 测试是**强制门禁**。

请在上方 `0) 项目配置` 填写（推荐必填）：
- `playwright_test_cmd`：Playwright 测试执行命令（完整命令，含 `cd {web_dir}`）
- `start_cmd`：启动后端服务的命令（用于 E2E 测试前启动依赖）
- `health_check`：后端健康检查命令（用于确认后端就绪后再跑 E2E）

规则：
1. 非 pure-ui 的前端代码改动（frontend-logic / full-stack）必须经过 Playwright 浏览器级验证才允许完成
2. 验证必须启动真实后端（通过 `start_cmd`）+ 真实 Playwright 测试（通过 `playwright_test_cmd`）
3. 纯 UI 视觉调整（pure-ui）或纯后端改动（backend-api）不受此门禁影响

## 3.4) 工具链与版本（强烈建议）

为减少“在新机器上验证半天”的情况，建议在上方 `0) 项目配置` 显式声明语言工具链版本与切换方式：
- `node_version` / `node_use_cmd`
- `java_version` / `java_use_cmd`
- `python_version` / `python_use_cmd`

## 3.5) 后端单元测试数据库约束（强制）

后端单元测试**必须连接 dev/test 环境的真实数据库**（MySQL / PostgreSQL 等），**禁止使用 H2 等嵌入式/内存数据库**——内存库 SQL 方言/行为与生产不一致，会导致“单元测试通过、部署后报错”。

请在上方 `0) 项目配置` 填写：
- `test_db_url`：测试数据库 JDBC 连接串（真实数据库实例，非 H2）
- `test_db_cmd`：测试库连通性检查命令（可选，用于验证库可用）

规则：
1. `backend-api` / `full-stack` 类型改动的单元测试必须在真实数据库上运行
2. 未配置 `test_db_url` 时 → `ws-dev` / `ws-bugfix` 流程 `BLOCKED`（或按完成判定记录文档化豁免）
3. 使用 H2 等嵌入式/内存库代替 → 视为未执行验证

## 3.0) Policy（默认安全边界）

为让自动化测试“开箱即用且不越界”，建议统一用 policy 字段作为硬边界（runner 与 hooks 会读取）。推荐默认值：
- `environment: "test"`
- `base_url_allowlist`：默认仅允许 localhost（防止误打到生产）
- `dangerous_disabled: true`：默认禁用危险接口（除非 REQUIREMENTS 明确允许）
- `max_requests_per_minute: 60`：默认节流，避免压垮测试环境

## 3.1) 环境声明（强烈建议）

建议在上方 `0) 项目配置` 明确声明当前是测试环境，并写清允许的测试边界：
- `environment: "test"`
- `allow_mutations: true`
- `auto_commit: true`（可选：仅在 test 环境允许自动提交）

## 4) 鉴权与测试账号

测试账号与鉴权信息放在（固定位置）：
- `secrets/test-accounts.json`

规则：
- 该文件不应提交到 git
- AI 不应在输出中打印其中的敏感字段

推荐格式（节选）：
- 若已有 token：在 `auth.headers` 填入固定 header（例如 `Authorization: Bearer ...`）
- 若只有账号密码：填写 `accounts[0].username/password`，并在 `auth` 中指定登录方式（例如 `auth.type=login` + `login_path/token_json_path`）；runner 会先登录再带 token 跑接口

## 5) Request-ID / Trace-ID 约定（强烈建议）

为便于自动化测试将“单次请求”与“服务端日志”稳定关联，建议统一以下约定：

- 请求 Header：`X-Request-Id`
  - 测试端每次请求都生成一个新的 `X-Request-Id`（例如时间戳/uuid）
  - 服务端若收到该 header，必须原样透传到响应 header（同名）
  - 服务端若未收到该 header，必须生成一个，并写入响应 header
- 日志字段：服务端日志必须包含 `request_id=<id>`（或等价字段，但需在此文件中固定）

说明：
- 自动化测试默认会在请求中携带 `X-Request-Id`，并以该值作为日志 grep 的主键（比时间窗更可靠）。
- 如果你的服务使用 `traceparent`（W3C Trace Context）也可以，但仍建议保留 `X-Request-Id` 作为最低公约数。

## 6) Runner 约定（推荐）

如果测试机安装了 `uv`，推荐在工作区根目录放置 `tools/server_test_runner.py`（来自本仓库模板），用于：
- 从 OpenAPI 生成/更新 `issues/server-api-issues.csv`
- 执行请求并按 `X-Request-Id` 关联日志

如希望 runner 自动执行 build/start/stop，请使用：
```bash
uv run tools/server_test_runner.py --workspace . --manage-service
```

<!-- AIWS_MANAGED_END:ai-workspace:core -->
