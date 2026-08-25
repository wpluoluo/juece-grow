# Change Proposal: {{CHANGE_ID}}

> Title: {{TITLE}}
>
> Created: {{CREATED_AT}}

## 目标与非目标

**目标：**
- <!-- WS:TODO 填写本次变更的目标（可验收） -->

**非目标：**
- <!-- WS:TODO 填写明确“不做什么”，防止 scope creep -->

## 主索引绑定（强制）

- `Change_ID` = {{CHANGE_ID}}
- 需求交付：`Req_ID` = <!-- WS:TODO （需求交付可填；例如 TOOLING-001B） -->
- 问题修复：`Problem_ID` = <!-- WS:TODO （问题修复可填；例如 PROB-001） -->
- `Contract_Row` = <!-- WS:TODO 绑定执行合同中的行 ID，可多项（逗号分隔）；例如 Req_ID=TOOLING-001B -->
- `Plan_File` = <!-- WS:TODO 例如 .aiws/plan/2026-02-08_15-30-00-xxx.md -->
- `Evidence_Path` = <!-- WS:TODO 证据路径，可多项（逗号分隔）；优先写持久证据 .aiws/changes/<change-id>/evidence/...；也可附带 .aiws/changes/<change-id>/review/... 或 .aiws/tmp/... -->

## 依赖关系（可选）

- `Depends_On` = <!-- WS:TODO 本 change 依赖的前置 change ID（逗号分隔）；例如 feature-auth -->
- `Blocks` = <!-- WS:TODO 本 change 完成后才能开始的后续 change ID（逗号分隔）；例如 feature-dashboard -->

> 规则：
> - `Depends_On` 的 change 应已完成（archived）；未完成时 `aiws change start` 会输出警告。
> - `Blocks` 用于记录依赖关系，便于后续 change 读取交接文档。
> - 依赖字段为可选，不强制填写。

> 规则：
> - `Req_ID` 与 `Problem_ID` 至少填写一项。
> - `Contract_Row` 必须引用 `.aiws/requirements/requirements-issues.csv` 或 `.aiws/issues/problem-issues.csv` 中的真实行。
> - `Plan_File` 对应的计划文件必须存在，且其绑定字段与本文件一致。
> - `Evidence_Path` 可先声明计划路径，交付前需完成证据落盘。

## 现状与问题

- <!-- WS:TODO 现状是什么、痛点是什么；必要时给证据（日志/截图/issue 链接） -->

## 方案概述（What changes）

- <!-- WS:TODO 逐条写清要改什么（行为/接口/数据/配置）；BREAKING 请标注 -->

## 协同与委托（可选）

- `analysis/`：
  - <!-- WS:TODO 如需委托分析，写明预计产物；例如 `.aiws/changes/<change-id>/analysis/research-a.md` -->
- `patches/`：
  - <!-- WS:TODO 如需外部 patch 草案，写明预计文件；例如 `.aiws/changes/<change-id>/patches/fix-a.patch` -->
- `review/`：
  - <!-- WS:TODO 如需多审查者，写明 reviewer 文件命名或汇总策略 -->

> 规则：
> - `analysis/` 产物默认只作为输入依据，不等于实现完成。
> - `patches/` 中的 patch 草案不自动应用，必须经主 agent 或人工审查。
> - 交付前建议把协同结果收敛到 `review/` 或 `evidence/`，并回填 `Evidence_Path`。

## 影响范围（Scope）

### In Scope（本次改动范围）

> 列出允许修改的文件/目录（支持 glob 模式）；用于 `aiws change validate --check-scope` 检查越界改动。

- <!-- WS:TODO 例如：`packages/cli/src/commands/change.ts` - 修改 change 命令逻辑 -->
- <!-- WS:TODO 例如：`packages/cli/tests/**/*.test.ts` - 相关测试文件 -->

### Out of Scope（明确不改动）

> 列出明确不在本次改动范围内的模块/目录；防止"顺手重构"。

- <!-- WS:TODO 例如：`packages/spec/` - 不修改规范定义 -->
- <!-- WS:TODO 例如：配置文件 - 不修改 .aiws/config.yaml -->

### 外部影响

- 可能影响的外部接口/使用方：
  - <!-- WS:TODO 例如：CLI 命令行接口、API 端点、配置格式等 -->

> 规则：
> - 实际改动超出 In Scope 时，需在 delivery 时解释原因并更新本章节。
> - 可使用 `aiws change validate --check-scope` 检查越界文件。

## 风险与回滚

- 风险：
  - <!-- WS:TODO -->
- 回滚方案（必须可执行）：
  - <!-- WS:TODO -->

## 验证计划（必须可复现）

> 从 `AI_WORKSPACE.md` 选择最贴近本变更的验证入口，写成可直接复制执行的命令。

- 命令：
  - <!-- WS:TODO 例如：`uv run .aiws/tools/server_test_runner.py --workspace .` -->
- 期望结果：
  - <!-- WS:TODO 例如：所有相关用例 DONE；无新增错误日志 -->

## 真值文件/合同更新清单

- `REQUIREMENTS.md`：<!-- WS:TODO 需要/不需要；如需要，写明新增/修改的验收条款 -->
- `.aiws/requirements/CHANGELOG.md`：<!-- WS:TODO 需要/不需要 -->
- `.aiws/requirements/requirements-issues.csv`：<!-- WS:TODO 需要/不需要 -->
- `.aiws/issues/problem-issues.csv`：<!-- WS:TODO 需要/不需要 -->
- 证据落盘（推荐双层）：
  - 持久（建议入库）：`.aiws/changes/<change-id>/evidence/...`（例如 validate 总结、review 总结、关键日志摘要）
  - 临时（可忽略入库）：`.aiws/tmp/...`（例如 `aiws validate . --stamp` 的 JSON）
  - 协同（按需）：`.aiws/changes/<change-id>/analysis/...`、`.aiws/changes/<change-id>/patches/...`、`.aiws/changes/<change-id>/review/...`
