---
name: using-aiws
description: 使用时机：新会话开始、不确定下一步做什么时。触发词：路由、bootstrap、Router、工作流入口、下一步做什么。注意：已明确阶段可直接进入对应 ws-*。
---
## 编排约束

- **不直接实现**：只判 workflow、读真值、路由到 `ws-*`。主 session 不写代码。
- **上下文先于判决**：`direct_implementation` 前收集 `git status --porcelain`、`git diff --stat`、`AI_WORKSPACE.md` 验证入口；仅 ≤3 文件、≤100 行、验证明确才可 direct。
- **意图不明先澄清**：`routeTo=clarify` 时停并问 1-3 个关键问题。
- **L3 纪律（goal resume）**：有 `active`/`paused` goal 时，冷启动 medium+ 勿 bare 跳 `$ws-dev`/`$ws-plan`；优先 `$ws-goal` resume。例外：显式 escape-hatch 或用户点名阶段 skill。

## 路由别名解析

`$ws-<cmd>` 是 `aiws <cmd>` 的语义别名（thin wrapper 已删除，命令语义由 CLI 承载）：
- `$ws-commit` → `aiws commit`；`$ws-push` → `aiws push`；`$ws-pull` → `aiws pull`
- `$ws-deliver` → `aiws deliver`；`$ws-migrate` → `aiws migrate`；`$ws-plan-verify` → `aiws plan-verify`
- `$ws-submodule-setup` → `aiws submodule-setup`；`$ws-memory-seed` → `aiws memory seed`
- `$ws-verify-before-complete` → `aiws verify-bc`

任何文档/旧 skill 中出现上述 `$ws-xxx`，一律按此表解析为 CLI 调用，无需再找对应 skill 文件。
用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：默认入口，先读真值，判定 workflow，再进入 `ws-*`。意图不明则先澄清，不直接实现。阶段：bootstrap/router，只分流。

路由 SSOT：`packages/spec/docs/workflow-router-rules.json`（`goal_driven` / `plan_first` / `direct_implementation` / `escape_hatch`）。本 skill 是人工投影，冲突以 JSON 为准。

## 编排约束

- **不直接实现**：只判 workflow、读真值、路由到 `ws-*`。主 session 不写代码。
- **上下文先于判决**：`direct_implementation` 前收集 `git status --porcelain`、`git diff --stat`、`AI_WORKSPACE.md` 验证入口；仅 ≤3 文件、≤100 行、验证明确才可 direct。
- **意图不明先澄清**：`routeTo=clarify` 时停并问 1-3 个关键问题。
- **L3 纪律（goal resume）**：有 `active`/`paused` goal 时，冷启动 medium+ 勿 bare 跳 `$ws-dev`/`$ws-plan`；优先 `$ws-goal` resume。例外：显式 escape-hatch 或用户点名阶段 skill。

## 必需输入

- 任务描述；`AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`
- 若已存在：`change/<id>`、`plan/...`、`.aiws/changes/<id>/...`、`.aiws/goals/`、`ws-goal` skill

## 必需输出

- `Root:` / `Found:` / `OpenCode mode:` / `Task intent:` / `Binding:` / `Route:` / `Why:` / `Next:`

## 阻断条件

- 无法确定项目根、缺失真值、意图不明、无法归因且不能安全推断

## 执行步骤

### 1. Preflight

读三真值。有 `.opencode/oh-my-opencode.json` → `oMo-enabled`，否则 `standard-opencode`。缺真值 → `$ws-preflight`，建议 `aiws init .`。

### 1.5 Per-turn Breadcrumb（必做）

每轮开始读 change 状态，输出 `[workflow-state:PHASE_NAME/N]`。

### 2. 路由判定

按 `workflow-router-rules.json` 判定。direct 前先收集 git 上下文。

**复杂度启发（结合上下文）：** ≤2 文件、已知路径、≤100 行、验证明确 → 可 direct；≥3 文件 / 跨模块 / 多步 / 未知路径 → medium+（优先 goal/plan）。

**ws-goal 可用**：存在 `.aiws/goals/`，或可加载 `ws-goal` skill。

| 意图 | Route |
|------|-------|
| 需求/验收/合同变更 | `$ws-req-review` |
| 评审/审计/风险 | `$ws-review` |
| finish/merge/push/cleanup | `$ws-finish` |
| handoff/archive | `$ws-handoff` |
| 先出设计方案 | `$ws-plan`（已走 goal → `$ws-goal` 管道） |
| 更新规范/验收 | `$ws-req-change`（先 review） |
| 中大型实现（goal 可用） | `$ws-goal`（`goal_driven`） |
| 中大型实现（goal 不可用） | `$ws-plan`（`plan_first`） |
| 小步明确实现/修复 | `$ws-dev` |
| 极简修复 / 显式跳过流程 | `$ws-dev-lite`（后者 `escape_hatch`） |
| Subagent 不可用 | 单 agent + 工件模式 |

注：`$ws-dev` 默认 subagent-first；主 session 优先 `$ws-delegate` → `aiws-worker`，除非用户说「直接改」。

**Escape Hatch**：用户明确「跳过流程」/「直接改」/「do it inline」→ `$ws-dev-lite`，须 `[escape-hatch]`、Req_ID、可复现验证、evidence 注明原因。小修入口保留，不得全灌 `$ws-goal`。
### 3. 意图不明确

只问 1-3 个关键问题（意图、Req_ID/Problem_ID、verify、change），然后停止。

### 4. Continuation Routing / 续跑决策表（新 session 恢复）

change 相位 + goal 叠加；goal 优先于冷启动 plan/dev 跳过：

| Phase / Goal | Next |
|--------------|------|
| active goal | `$ws-goal` resume（按 state next_action） |
| paused goal | `$ws-goal` resume（继续 / 改目标 / 放弃后冷启动） |
| none | intake；或 medium+ 且 goal 可用 → `$ws-goal`；否则 `$ws-plan` |
| intake | 继续 intake，或 plan/goal（按可用性与冻结） |
| planning | 有 plan→plan-verify；否则 plan（goal 内则 `$ws-goal`） |
| ready-for-dev | 派发 aiws-worker（goal 绑定经 `$ws-goal`） |
| in-progress | 有 patches→review；DONE_WITH_CONCERNS→quality-review；否则继续 |
| review | evidence 齐→finish/commit；否则补 evidence |
| finished / unknown | `$ws-finish` 归档 / `$ws-preflight` |

Subagent 降级：无 subagent 时本 agent 执行，evidence 记 `mode: single-agent`。`BLOCKED` 解 blocker；`NEEDS_CONTEXT` 补 JSONL 后重试。

### 5. 输出路由

```
Root: / Found: / OpenCode mode: / Task intent: / Binding: / Route: / Why: / Next:
```

## 约束

- Router 不实现；不给 route 前不改代码；一次一个主 route；复杂度升高时 `$ws-dev` → `$ws-plan`/`$ws-goal`，`$ws-finish` 回退前置门禁
- subagent 不可用：单 agent，维护等价工件；不用 L4 程序化 skill invoke（agent 读规则后进入 skill）

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`
> Subagent-first 规范：`packages/spec/docs/opencode-subagent-first.md`
