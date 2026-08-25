---
name: ws-goal
description: 目标协议：设定可审计的 goal 目标；依赖链预检；管道委托；完成审计
---
# ws-goal

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 将用户需求转化为可审计的 goal 目标，按 ws-goal-contract.md 的目标模板写入目标文件。
- 依赖链预检：阻断"死 change 阻塞下游"这类 chain 问题。
- 管道委托：预检通过后将 goal 拆分为 phase-level 子任务（INTAKE→PLAN→DEV→REVIEW→FINISH），每个 phase 委托给独立轻量子 agent，主 session 编排调度与验证。
- 完成审计：claim done 时验证 outcome 真伪。

ws-goal 不做的事：
- 不直接在 main session 操作 change 或写代码（通过 pipeline subagent 委托执行）
- 不替换 review/commit/finish 门禁
- 不 auto-chain 到下一个 goal（但在同一 goal 内支持多组顺序调度 §6）


## Phase Boundary Authority (TOOLING-003D / contract §10)

**Sole writer**: `aiws goal advance` is the **only** allowed writer for phase-boundary fields in `.aiws/goals/<goal-id>.state.json`:
- `status` (active/complete/paused/…)
- `current_phase`
- checkpoint `status` / `completed_at` / `error` / `attempts` for phase transitions

**MUST at every phase boundary** (after verifying the phase is actually done):
```bash
aiws goal advance --goal-id <goal-id> [--json]
# optional explicit jump (prerequisites must be complete):
aiws goal advance --goal-id <goal-id> --phase <next_phase>
# dirty / drift recovery or §7.6 migration (active .md, missing state.json):
aiws goal advance --goal-id <goal-id> --heal
# preview:
aiws goal advance --goal-id <goal-id> --dry-run
```

**FORBIDDEN**:
- Hand-editing `state.json` checkpoint/status/`current_phase` fields to "mark complete" or "start next phase"
- Freehand JSON patches as the normal advance path
- Treating model memory of progress as authoritative over CLI state

**Allowed without advance**:
- Create initial `state.json` once when defining a new goal (all checkpoints pending, status=active) — first transition still goes through `advance`
- Read state for inject / resume summary
- Write Progress Notes / goal `.md` human text (not machine FSM fields)

**Dirty states**: `aiws goal validate-state` rejects inconsistent FSM snapshots. Heal via `advance --heal` or `validate-state --heal`, then continue with `advance`.

**Platform continuation** (Ralph 主 / Boulder 辅) may re-invoke advance; they do **not** own the FSM write path.


前置条件：
1) 先运行 `/ws-preflight`（对齐 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`）。

执行流程：

### PHASE 0 — INTAKE（对抗式目标审问）

在写 goal 文件前，先对目标本身做对抗式审问：

0) 检查 `.aiws/goals/` 目录（先扫描 `.state.json`，再扫描 `.md`）：
   a) 若用户仅查询状态（无明确目标），列出所有 goal 文件及其 status 字段，然后结束。
   b) 扫描 `.aiws/goals/*.state.json`：
      - 读取每个 state.json 的 `status` 字段
      - 若发现 `status=active` 或 `status=paused` 的 state.json：
        i.  读取对应 `.aiws/goals/<goal-id>.md` 文件获取完整目标描述
        ii. 输出 goal 摘要：goal_id, status, current_phase, checkpoint 状态, error（若有）
        iii. 输出恢复选项：
             - （a）从失败的 phase 继续
             - （b）跳过该 phase（标记 complete，继续下一个）
             - （c）暂停并 handoff
        iv. 用户选择后：
             - 若选择 a）→ `aiws goal advance --goal-id <id> --heal`（如需）后从当前 phase 恢复；注入 §7.5 continuation context
             - 若选择 b）→ 用 `aiws goal advance --goal-id <id> --phase <next>`（prereq 已满足时）跳过；**禁止**手改 JSON
             - 若选择 c）→ 输出 handoff 建议，结束
        v. 若用户选择全量重跑 → 通过 heal/migration 或新建 state（CLI），不要 freehand 重置 JSON
   c) 若未找到 state.json 但有 status=active 或 status=paused 的 .md 文件（旧格式迁移）：
      - 按 §7.6 迁移策略处理（自动生成 state.json 后全量重跑）
1) **工作区上下文扫描（Context-Aware Intake）**：在开始 intake 问题前，先扫描工作区获取已有工作的上下文信号，用于预填充 intake 的初始问题答案：
   - `git diff --stat`（未暂存的改动文件列表）
   - `git log --oneline -5`（最近提交记录）
   - `git branch --list 'change/*'`（已有 change 分支及状态）
   - `git stash list`（暂存的工作）
   - `.aiws/plan/*.intake.md`（孤立 intake 草稿）
   - `.aiws/intake/*.state.json`（进行中的 intake）
   - `aiws/brands.yml`（品牌配置：若存在，列出所有品牌名）
   - 扫描结果输出为压缩的上下文摘要：

```text
═══ 工作区上下文 ═══
未提交改动: BizDeviceRepo.kt (+12 -0) — 修复 activeType 过滤
最近提交:   "fix: device/pages filter activeType and deviceId"
Change 分支: change/fix-auth (3 commits, 未合并)
孤立 Intake: .aiws/plan/20240115-auth-intake.md (3/5 问题已冻结)
品牌配置:   aiws/brands.yml — brands: ly, default
════════════════════
```

2) 将扫描到的上下文传递给下一步的 intake 对抗式审问，作为初始问题答案的预填参考。用户可见预填内容并可修改确认。

2a) **品牌绑定（Brand Binding）**：若存在 `aiws/brands.yml`：
    - 单品牌：直接读取该品牌的 submodules 映射，无需询问
    - 多品牌：在 intake 审问中询问"当前工作用哪个品牌？"，将所选品牌的 submodules 映射（子模块→分支）注入上下文；后续 PLAN/DEV 涉及子模块操作时据此绑定目标分支
    - 无 `aiws/brands.yml`：跳过本步，不阻塞（未配置品牌的项目不受影响）

3) **运行改进后的 `/ws-intake`**（对抗式审问模式）对 goal objective 做逐条审问：
   - 步骤 1 扫描的上下文自动作为 intake 问题的预填答案（用户可见并可修改）
   - 推荐答案模式：对事实类/选择类问题先给出推荐（参考 `recommendAnswers` 配置）
   - 决策树分支遍历：每条回答展开对应子分支，直到所有叶节点被消费
   - 对抗式审问层：自动探查代码库寻找矛盾信号，挑战隐含假设，探测边缘案例
4) **产出 intake 草案**：写入 `plan/<timestamp>-<slug>.intake.md`，包含完整的决策树遍历记录，并在草案开头嵌入**步骤 1 的工作区上下文摘要**作为上下文来源记录
5) **阻塞检查**：若 intake 草案中存在 `UNRESOLVED_BRANCH`，输出阻塞报告并暂停。用户必须显式确认忽略或补充信息后才能进入 PHASE 1。
6) 将 intake 审问结果（已冻结的目标范围、约束、边界）传递到后续 goal objective 定义。
6a) **记录 checkpoint（sole writer）**：phase 验证通过后运行 `aiws goal advance --goal-id <goal-id>`（完成 intake → 启动 goal_def）。**禁止**手改 state.json。

> **Auto-Advance**：若步骤 5 无 UNRESOLVED_BRANCH，步骤 6→6a→PHASE 1 自动推进，不需询问用户确认。参见 §7.8。

### PHASE 1 — GOAL 定义

7) 接受用户输入的 goal objective，明确目标范围与验收标准（基于 PHASE 0 的 intake 产出）。
8) 按 ws-goal-contract.md 的目标模板生成目标文件，写入 `.aiws/goals/<goal-id>.md`。
8a) 同时创建 `.aiws/goals/<goal-id>.state.json`（§7.2 格式），初始状态：
    - `status`: "active"
    - `current_phase`: "intake"
    - 所有 checkpoints: `{"status": "pending", "attempts": 0, "completed_at": null, "error": null}`
9) 输出 completion audit checklist，列出每个 goal 的完成标准与验证方式。
9a) **记录 checkpoint（sole writer）**：`aiws goal advance --goal-id <goal-id>`（完成 goal_def → 下一 phase）。**禁止**手改 state.json。

### PHASE 2 — 预检与管道委托

**Checkpoint 记录规则**（贯穿整个 Phase 2，TOOLING-003D）：
- 每个 phase 边界 **必须** 调用 `aiws goal advance --goal-id <goal-id>`（sole writer）
- 进入/完成 phase 的 `current_phase` 与 checkpoint 状态由 advance 写入
- 失败/暂停：优先通过 advance/heal 路径或文档化的 CLI；**禁止**手改 JSON 推进
- dirty 时：`aiws goal advance --goal-id <goal-id> --heal` 或 `aiws goal validate-state --heal`

10) **依赖链预检**：按 ws-goal-contract.md §2.4 执行上游依赖链健康检查。
    - 通过后：`aiws goal advance --goal-id <goal-id>`（完成 dep_check）
    - 阻断时：在 Progress Notes 记录 error；状态机暂停语义见 contract（勿手改 JSON 伪装 complete）

11) **Workspace State Analysis**：分析 dirty/submodule/change artifacts/git 状态，输出分级影响报告。按 §2.5.4 分级处理（SSOT：**HIGH → 自动解决**，默认不阻断）：
   - NONE/LOW → 自动继续，记录到 Audit Trail
   - MED → 自动继续，输出警告
   - **HIGH** → 按 contract §2.5.4 自动处理：dirty 时执行 `git stash push --keep-index -m "ws-goal auto-stash: <goal-id>"`；若 stash 失败 → 警告用户并暂停。完成后执行 `git stash pop`。submodule 等问题按 contract 处理；仅自动化失败时提示，**不**默认等人确认
   - 通过后：`aiws goal advance --goal-id <goal-id>`（完成 ws_analysis）
12) **Phase-Level Pipeline Delegation**：预检 + 分析通过后，将 goal 拆分为 PLAN→DEV→REVIEW→FINISH 四个 phase 顺序执行，每个 phase 委托给独立轻量子 agent，主 session 验证每个 phase 产出后决定继续/重试/暂停。参考 `/ws-goal` command 的 step 5 完整流程。
     - 每个 pipeline phase 验证通过后：`aiws goal advance --goal-id <goal-id>`（sole writer）
     - **Prompt Inline Diff（T2）**：构造 REVIEW 委托 prompt 时，必须内联 `git diff` 输出（`git diff HEAD --stat` + `git diff HEAD` 或 `git diff <change-base>..HEAD`），将 change scope 与具体改动注入 prompt，使 reviewer 无需额外上下文查询。DEV 委托 prompt 同理可附 diff 引用。
     - Granularity Gate（c-i）：在 DEV 委托前运行；检查 granularity_ok=true、design_context 和 internal_tasks 非空
     - 粒度不达标（granularity_ok != true）→ 阻断并输出报告，暂停 goal
     - 粒度达标后进入 DEV delegation（c-ii）
     - 失败：Progress Notes 记 error；不要手改 checkpoint 伪装 complete

13) **PLAN 多分支决策支持**：当 PLAN 产出包含多个可行执行路径时（如"先 Phase 1&2 vs 先修 P0 stub"），不得停下询问用户"选哪个"。改为：
     - 用 §7.9.3 格式输出结构化建议块（含各分支内容、风险、预估、推荐）
     - 可调用 Oracle 分析各分支的代码级影响来生成建议块（§7.10）
     - 用户确认选择后继续执行；仅当各分支风险/收益接近无推荐时才需用户主动分析

14) **Auto-Advance（协议 §7.8 + CLI §10）**：所有 phase 间推进（INTAKE→GOAL_DEF→DEP_CHECK→WS_ANALYSIS→PLAN→DEV→REVIEW→FINISH）在验证通过后 **必须** 执行 `aiws goal advance`。协议描述语义；**写权威是 CLI**。仅以下情况需要人工确认后再 advance：
     - INTAKE 阶段存在 UNRESOLVED_BRANCH（步骤 4）
     - 依赖链 UNHEALTHY（步骤 10）
     - PLAN 存在多分支需用户选择（步骤 13）
     **注意**：workspace HIGH **不是**默认人工门禁（§2.5.4 自动解决）。除此之外的 phase 边界在验证通过后直接 advance。
     每次 advance 成功后执行下方 **Platform Continuation Binding** 镜像刷新。
