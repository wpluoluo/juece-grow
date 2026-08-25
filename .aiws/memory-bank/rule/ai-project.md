---
title: AI_PROJECT.md（项目规则 / 约束真值）
created: '2026-08-25T15:35:10.583Z'
updated: '2026-08-25T15:35:10.583Z'
summary: '<!-- AIWSMANAGEDBEGIN:ai-project:core --> <!-- AIPROJECTVERSION: 2 -->'
tags:
  - seed:ai-project
---
# AI_PROJECT.md（项目规则 / 约束真值）

_Source: `AI_PROJECT.md`_

# AI_PROJECT.md（项目规则 / 约束真值）

<!-- AIWS_MANAGED_BEGIN:ai-project:core -->
<!-- AI_PROJECT_VERSION: 2 -->

本文件用于在**具体项目/工作区**内统一 OpenCode 的执行约束与协作方式，避免多套规则各写一份导致漂移。

定位：
- `REQUIREMENTS.md`：定义“要做什么/验收是什么”（需求真值）
- `AI_WORKSPACE.md`：定义“怎么跑/怎么测/目录如何发现”（运行与测试真值）
- `AI_PROJECT.md`：定义“允许怎么做/边界是什么/产物如何沉淀”（项目约束真值）

## 1) 优先级（强制）

当三者内容冲突时，按以下优先级执行：
1. `AI_PROJECT.md`
2. `REQUIREMENTS.md`
3. `AI_WORKSPACE.md`
4. `requirements/CHANGELOG.md`（仅记录历史，不覆盖当前需求）
5. `requirements/requirements-issues.csv`（需求拆解执行合同：Spec/Impl 状态机）
6. `issues/*.csv`（执行合同；必须与上面真值一致）

## 2) 安全与边界（强制）

- 不写入/不打印 secrets：`secrets/`、`.env*`、token/apiKey/oauth/private_key 等不得进入 git。
- 不做破坏性操作：除非在本文件明确允许（例如 `rm -rf`、`git reset --hard`、`git clean -fdx`）。
- 仅在 `environment: test` 场景允许自动化修复闭环/无人值守（否则必须人工确认每一步）。

## 3) 产物与证据（强制）

每轮迭代必须落盘至少一个“可追溯产物”（三选一即可）：
- 证据：`.aiws/tmp/...`（report/log/resp）
- 合同：`issues/*.csv`（状态变化：TODO/DOING/DONE/BLOCKED/SKIP）
- 变更工件：`.aiws/changes/<change-id>/`（proposal/tasks/design；详见 `.aiws/changes/README.md`）

不得只在对话里口头描述“已验证/已修复”。

完成小结（change finish 时，主 session 应输出一段中文工作摘要）：
- 目标：概括本轮 change 解决了什么问题
- 改动范围：改了什么文件/模块（增删改各多少）
- 验证结果：怎么确认没问题（构建/测试/LSP/validate 等关键门禁结果）

推荐（防规则/范围漂移）：
- 创建工件：补齐 `.aiws/changes/<change-id>/proposal.md`、`tasks.md`（可选 `design.md`）
- 声明 active change（团队共享）：切到分支 `change/<change-id>`（也支持 `changes/`、`ws/`、`ws-change/`）
- 若仓库存在 `.gitmodules`：使用 `aiws change start <change-id> --switch`；不要在当前 superproject 里直接手工切分支。
- 若 submodule 因 gitlink checkout 处于 detached HEAD：直接切到目标分支（`git checkout <target-branch>`），不要继续留在 detached HEAD 状态。
- 严格校验：`aiws validate .`（包含：漂移检测 + `ws_change_check` + `requirements_contract`）
- 启用 hooks（本地生效）：`git config core.hooksPath .githooks`（提交/推送时自动跑 `aiws validate .`）
- CI 建议追加：`aiws validate .`

可选（完全脱离 dotfiles 的默认路径）：
- `aiws change new|validate|sync|archive ...`（创建工件/运行校验/归档的快捷命令）

### 3.1) 变更归因（强制）

任何“写代码/改配置/改测试”的改动必须能归因到以下二选一：
- **需求交付**：关联 `requirements/requirements-issues.csv` 的 `Req_ID`（并能映射到 `REQUIREMENTS.md` 的验收条款）
- **问题修复**：关联 `.aiws/issues/problem-issues.jsonl` 的 `Problem_ID`（BUG/TECHDEBT/OPS/TOOLING 等）

若一个问题阻塞某个需求交付：两边都要互相引用（在 `Notes` 字段里写对方的 ID），避免“修了但没人验收/验收了但遗留问题丢失”。

## 4) 提交流程（默认推荐）

- 先对齐 `REQUIREMENTS.md`（必要时用 `/ws-req-change` 记录变更并写入 `requirements/CHANGELOG.md`）
- 再执行最小验证（以 `AI_WORKSPACE.md` 的测试入口为准）
- 最后才允许提交（若项目采用 submodule，按 `AI_WORKSPACE.md` 的 `server_dirs` 执行）

## 5) 可配置开关（可选）

如需要在本项目强制更严格的行为，可在此追加明确条款（示例）：
- 只允许改动的目录白名单
- 必须执行的测试命令列表
- 必须携带/回传 `X-Request-Id` 的接口范围

### 5.1) 前端测试门禁（Verification Tier）

根据改动类型，要求不同的验证方式：

改动类型分类：
- `pure-ui`：纯界面调整（颜色、间距、文案等视觉层面变更，不含交互逻辑）
  - 要求：仅需 lint + 构建，无需启动后端
- `frontend-logic`：前端交互/逻辑变动（API 调用、状态管理、表单校验等）
  - 要求：必须配置 `AI_WORKSPACE.md` 的 `playwright_test_cmd` / `start_cmd` / `health_check`
  - 要求：必须启动后端并通过 Playwright 浏览器级验证
- `backend-api`：后端 API/服务逻辑变动
  - 要求：单元测试 + 接口测试；单元测试必须连接 dev/test 环境真实数据库（禁止 H2 等嵌入式/内存数据库）
- `full-stack`：同时涉及前后端
  - 要求：前端 Playwright 验证 + 后端测试
- `config-docs`：仅配置文件/文档改动
  - 要求：lint + 构建

判定方式：由 `ws-dev` 入口根据 diff 文件路径自动判定；或者在 `proposal.md` 中显式声明。

## 6) 服务端/自动化测试约束（工作区模式，强制）

当本目录按 AI Workspace 运行（存在 `AI_WORKSPACE.md` / `REQUIREMENTS.md` / `tools/server_test_runner.py`）时，约束如下：

- `X-Request-Id`：自动化测试请求必须携带；服务端必须回传同名响应头；日志应包含 `request_id=<id>` 以便按单次请求定位问题。
- 接口清单真值：优先使用 `docs/openapi.json`。若缺失，先补齐导出方式并生成到该路径，再做全量覆盖测试（避免“覆盖范围不可复现”）。
- 证据落盘：每轮至少更新一次 `.aiws/tmp/...` 或 `issues/*.csv`（禁止只在对话里口头宣称“已验证/已修复”）。

<!-- AIWS_MANAGED_END:ai-project:core -->

## 7) 项目特有规则（ws-rule 管理）

<!-- AI_PROJECT_RULES_BEGIN -->
- 使用 `/ws-rule` 维护本段内容；请勿手工修改 BEGIN/END 标记。
- 建议写成“可执行/可检查”的条款（能落到目录/文件/命令/产物），避免只写口号。
<!-- AI_PROJECT_RULES_END -->

你可以在本段下方追加项目自定义说明；`aiws update` 不会改动托管块以外内容。
