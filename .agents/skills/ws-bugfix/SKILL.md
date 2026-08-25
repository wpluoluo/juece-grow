---
name: ws-bugfix
description: 使用时机：从禅道/外部系统拉取 bug 进行修复时。触发词：bug、修复、禅道。注意：非禅道小修复请用 ws-dev-lite。
---

# ws-bugfix

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：以 goal 式完整工作流驱动单个禅道 bug 的修复——拉取 → 分析 → 解决 → 测试 → 验证 → review → resolve → commit → push → finish，直至 bug 在禅道 resolve 且变更归档。
非目标：不直接操作禅道（仅通过 Zentao MCP）；不手改 bugfix-state.json 的状态机字段；不写入 secrets；不凭空改代码。

## 数据真值约定（所有 phase 必须遵守）

> **JSON 是 bug 详情唯一真值源**。所有 phase 的 agent 必须从 `bug/zentao-bug-<id>.json` 读取 bug 详情（steps/expect/actual/notes 等），**不得**依赖任何 Markdown 文件中的转述。
>
> Bugfix 目录下 `.md` 文件（如有）仅为人类可读的索引摘要，不具备数据权威性。Diagnose/Dev agent 被喂入 prompt 时，应优先 inline 注入 JSON 原文，而非 MD 的「分析」段。
>
> **回归验证**：Phase 4（TEST）必须产出可复现的回归脚本/用例。脚本应独立可运行，覆盖「修复前失败、修复后通过」场景。语言/框架不限——可以是 `scripts/` 下的 `.mjs` 脚本、模块的单元测试用例，也可以是 E2E 用例。

## 批量/headless 派发模式（被 batch 派发时适用）

当本 session 由 `aiws bugfix batch run` 派发时（handoff 文件声明**自主模式/headless**），执行以下规则：

**识别标志**：handoff 声明「本 session 由 `aiws bugfix batch run` 派发：自主模式（headless）」；change 分支已由 CLI 创建（`change/bugfix-<bug-id>`，当前 HEAD 已在其上），无需（也不应）重复 `aiws bugfix start`，直接推进 10-phase。

**不询问、不等待**：
- 全程不询问用户、不等待人工介入；能依据真值（bug JSON / 附件 / 代码）自行判断的，一律自行判断后推进
- INTAKE 阶段歧义（需求/附件/复现不明确）→ 先自行查证（读 JSON、看附件、查代码）→ 能定论就继续；确属不明确 → **停止改动**并写 `skipped` 信号退出
- ANALYZE 无法收敛（超出假设-验证循环上限 / 阶段预算）→ 输出当前结论并 advance，或标记 `skipped` / `needs_human`
- ANALYZE 出口 REQ SYNC 主判定 `BLOCKED` → 自行处理：确属需求变化则更新 `REQUIREMENTS.md`，否则判定 `NOT_NEEDED`；无法自行定论才写 `skipped` 信号退出；COMMIT 前仅做增量复核

**门禁照常执行**：resolve 路径门禁（REVIEW 阶段自行经禅道 MCP `resolve_bug`）、TEST 单测验证（test-gate）等 10-phase 各项门禁语义**不改**，与交互式模式一致。

**完成判定（done.signal 契约）**：全部流程完结后，在 `tasks/<taskId>/evidence/done.signal` 写入**且仅写入一行**：
- `complete` —— 仅当 `aiws change finish` 成功、bugfix-state phase=done、工作区干净后
- `skipped: <原因>` —— 需求不明确/超出能力，未做改动
- `needs_human: <原因>` —— 做了部分工作但被阻塞（如 merge 冲突无法安全解决）

CLI 不再代为 resolve/merge：`resolve_bug` 与 `aiws change finish bugfix-<bug-id> --push` 均由本 session 自行完成。

## 禅道回复风格约束（所有 phase 必须遵守）

- 评审意见用中文（代码标识符/文件路径保持原文）
- 附截图时告知来源（bug 附件 / 运行截图）
- 不把 AI 自己转述的 Markdown 内容当作证据引入回复
- `resolve_bug` 的 `solutionModules` 中**不写** `Evidence:` / `Verify:` 标签或额外节——禅道 UI 不显示这些标签节

## 前置

1. 先运行 `/ws-preflight`（对齐 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`）。
2. 确认 Zentao MCP 可用（`get_my_bugs` / `get_bug_detail` / `resolve_bug`）。

## Phase Boundary Authority（sole writer = CLI）

**`aiws bugfix advance` 是 bugfix-state.json 中阶段边界字段的唯一合法写入者**：

```bash
aiws bugfix advance bugfix-<bug-id>
```

**FORBIDDEN**：
- 手改 `bugfix-state.json` 的 `status` / `current_phase` / checkpoint 字段来"标记完成"或"推进下一阶段"
- 以模型对进度的记忆替代 CLI 状态
- 跳过 advance 直接进入下一阶段

**Allowed without advance**：
- `aiws bugfix start <bug-id>` 创建初始 state（首个迁移仍走 advance）
- `aiws bugfix status [change-id]` 读取状态用于恢复/摘要
- 写证据文件、review 文件等人类可读产物

中断后恢复：`aiws bugfix status [change-id]` 查看当前 phase，从对应阶段继续。

## Bugfix Workflow — 10 个 Phase

各 phase 的详细操作步骤见 [`PHASES.md`](PHASES.md)；E2E 编写遵循 [`e2e-playwright`](../e2e-playwright/SKILL.md)，subagent 派发与视觉证据遵循 `packages/spec/docs/pi-subagent-first.md`。**修改 phase 内容时请编辑 `PHASES.md`，而非此处**。

入口（bug-id 必填）：

```bash
aiws bugfix start <bug-id>        # CLI 要求显式位置参数（必填）
```

省略 bug-id 时：先调 Zentao MCP `get_my_bugs`（projectId 优先传入）获取激活 bug 列表 → 取第一个（或用户指定的）bug-id → `aiws bugfix start <bug-id>`。

| Phase | 入口/门禁 | 出口条件 |
|-------|-----------|----------|
| 1 — **INTAKE** | 原始 JSON 落盘，不生成 intake Markdown | `aiws bugfix advance` → ANALYZE |
| 2 — **ANALYZE** | `diagnosing-bugs` 根因分析；有疑问走 `grill-with-docs`；出口执行 **REQ SYNC 主判定**（详见 `REQ_SYNC_GATE.md`） | REQ_SYNC=SYNCED/NOT_NEEDED 后 `aiws bugfix advance` → FIX |
| 3 — **FIX** | 进入 `$ws-dev` 最小改动；跨多模块/多文件（≥4 源文件或跨子模块）先在 tasks.md 规划子任务（见 PHASES.md PHASE 3）；LSP clean | 修复证据落盘到 evidence |
| 4 — **TEST** | 按模块选择测试命令 | 测试通过（未通过不能进入 VERIFY） |
| 5 — **VERIFY** | 对照 `expect` 与 `actual` 逐条验证 | 全部通过后 `aiws bugfix advance` → REVIEW |
| 6 — **REVIEW** | `$ws-review` 审计 + 禅道回填 `resolve_bug`（带 `solutionModules`）；advance 前执行 REQ SYNC **增量复核** | `aiws bugfix advance` → COMMIT |
| 7 — **COMMIT** | `aiws commit` | 校验 + 提交成功 |
| 8 — **PUSH** | `aiws push` | 推送成功 |
| 9 — **FINISH** | `aiws change finish bugfix-<bug-id> --push` + 回填 `issues/fix_bus_issues.csv` | `aiws bugfix advance` → DONE |
| 10 — **DONE** | 输出修复摘要 | — |

> 注意：REQ SYNC GATE **主判定**在 PHASE 2 ANALYZE 出口（advance → FIX 前）执行；COMMIT 前（PHASE 6 REVIEW 通过后）仅做**增量复核**。详见 [`REQ_SYNC_GATE.md`](REQ_SYNC_GATE.md)。

## ANALYZE 阶段收敛规则

Phase 2（ANALYZE）必须遵守以下收敛规则，防止无限深挖导致上下文膨胀（749 案例 8+ 轮推理不收敛、上下文冲到 102K）：

1. **假设-验证循环上限 3 轮**：每轮必须验证或排除一个假设；3 轮后仍无法定位根因 → 停止深挖，输出待确认项，`aiws bugfix advance` 或标记 `needs_human`
2. **深挖检测**：同层排除 > 5 个候选后，强制退回更高层（重读 bug 描述，确认复现预期）
3. **阶段预算**：analyze 阶段 input 上限 ~60K tokens；超出时必须收敛（输出当前结论并 advance，不继续深挖）

详细规则同步记录在 [`PHASES.md`](PHASES.md) 的 PHASE 2 节。

## 各 phase 详细步骤

请阅读 [`PHASES.md`](PHASES.md) 获取每个 phase 的完整操作说明。

## REQ SYNC GATE（硬阻断）

**主判定**在 PHASE 2 ANALYZE 出口（advance → FIX 前）执行：对比修复涉及的 API/字段/错误信息与 `REQUIREMENTS.md` 描述，有偏差则此时更新真值（`$ws-req-change` / CHANGELOG）。完整说明和三种状态输出见 [`REQ_SYNC_GATE.md`](REQ_SYNC_GATE.md)。

**增量复核**在 COMMIT 前（PHASE 6 REVIEW 通过后、advance 前）执行：修复落地后如产生新增需求影响则补同步，否则沿用 ANALYZE 判定，不重复全量流程。

只有 `REQ_SYNC` 为 `SYNCED` 或 `NOT_NEEDED` 时，才能 `aiws bugfix advance bugfix-<bug-id>`（→ FIX 或 → COMMIT）。
> **原则**：`PHASES.md` 和 `REQ_SYNC_GATE.md` 是 phase 细节与门禁规则的唯一真值源。SKILL.md 只保留约束和路由。修改 phase 逻辑时务必操作对应的 reference 文件。