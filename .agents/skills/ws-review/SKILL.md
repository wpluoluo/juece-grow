---
name: ws-review
description: 使用时机：需要审计当前改动、查找风险时。触发词：审计、评审、review、风险检查、回归检查。注意：高风险变更应补 ws-spec-review + ws-quality-review。
---

## 双审查边界

- `ws-review` 是通用评审入口
- **高风险或准备 finish 的变更**：必须拆为 `ws-spec-review`（流程/归因/真值完整性）+ `ws-quality-review`（行为回归/边界条件/测试覆盖），两份独立证据
- 单份 review 文件同时覆盖 spec 和 quality 不计为双审查


独立性与成本（派发决策见 `packages/spec/docs/pi-subagent-first.md` §何时派 subagent / 何时不派）：
- **独立审查值得派 subagent**：审查者拥有独立上下文、不受实现者偏见污染、不污染主会话——这是 review 类 subagent 存在的意义
- **接受审查类 subagent 的慢**：一次独立审查 5-15 分钟属正常，它是门禁不是性能优化；等待期间主 session 做非冲突准备（或直接等通知），不 sleep 空等
- 简单/低风险改动**不需要**为形式上走流程而派审查 subagent——`ws-review` 可由主 session 收敛通用 review；双审查（spec+quality）仅在 triage 判 required 时启用

用中文输出（命令/路径/代码标识符保持原样不翻译）。
目标：在提交/交付前审计当前改动，对照真值文件检查是否越界，并把审计证据优先落盘到 `.aiws/changes/<change-id>/review/`（若无法确定 `change-id` 再回退 `.aiws/tmp/review/`）。
若当前语境已经明确是“准备交付/finish”，则本入口不应只停留在通用 review：应继续同时补齐 `$ws-spec-review` 与 `$ws-quality-review`，把 dual review gate 一次性收敛完。

OpenCode + oMo 优先策略：
- 若检测到 `.opencode/oh-my-opencode.json`，或当前会话明确可用 `oracle` / `explore` / `librarian`，优先借用这些 agent 做 review。
- `@oracle` 优先负责独立审查与 findings；`@explore` 用于补 diff 影响面；`@librarian` 用于补 requirements / docs / 依赖上下文。
- 主 agent 必须负责把 findings 收敛并落盘，不要把子 agent 输出直接当最终 review 结论。

阶段定位：
- review 阶段；负责对当前改动做规范、风险和验证完整性的审计。
- 双审查边界：ws-spec-review 查流程/真值归因，ws-quality-review 查行为/回归/测试。高风险或准备 finish 的任务必须同时完成两者。

## 方法论（引用 $code-review）

> 双轴审计方法论执行细节引用 `$code-review`（mattpocock）：Standards 轴（代码约定/坏味基线）+ Spec 轴（需求符合性），不重复正文。Triage 条件判断（dual-review required or not）按 project 约定的风险判定标准，基于 `$code-review` 双轴框架。

必需输入：
- 当前 `git status` / `git diff`
- 已执行的验证结果
- 真值文件：`AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`
- 当前 `change/<change-id>` 上下文（若能识别）
- 若存在：`.aiws/changes/<change-id>/analysis/`、`patches/`、已有 `review/` 文件

必需输出：
- 审计文件：`.aiws/changes/<change-id>/review/codex-review.md` 或回退 `.aiws/tmp/review/codex-review.md`
- `主要风险（Top risks）:` 3-8 条
- `下一步（Next）:` 最小修复清单 + 最小验证命令

阻断条件：
- 没有可审计的改动或验证上下文
- 审计证据无法写盘

完成判定：
- 审计证据已落盘，主要风险和下一步已明确，可作为 commit/deliver 前置输入。

步骤（建议）：
1) 先做 preflight：定位项目根目录，读取 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`，输出约束摘要。
   - 若检测到 oMo：优先让 `@oracle` 做独立审查；必要时再让 `@explore` / `@librarian` 补上下文。
2) **Change Scope Assessment**：在深入审查前，先获取变更上下文。
   - 执行 `git diff --stat HEAD` 查看变更文件及行数
   - 执行 `git log --oneline -3` 查看最近提交
   - 使用此上下文将审查聚焦在变更区域，各 reviewer agent 无需独立发现变更范围
3) **Triage**：按 `$code-review` 双轴方法论，判断是否需要双审查。Triage 输出格式：
   ```
   Triage: dual-review: required | not-required
   Rationale: <one reason>
   Spec review scope: <what to check> (if required)
   Quality review scope: <what to check> (if required)
   ```
   Findings 格式要求：每个 finding 必须有 [Critical/Warning/Info] 级别标签 + 归因到 SPEC/QUALITY/REGRESSION 类别。
4) 基于 `git status` / `git diff`（以及你实际运行过的测试结果），对照 `AI_PROJECT.md` 与 `REQUIREMENTS.md` 检查：
   - 是否存在越界目录改动/危险操作
   - 是否有可复现验证命令与证据
   - 是否维护了 `.aiws/changes/<change-id>/` 或相关 `issues/*.csv`
   - 若存在 `analysis/` / `patches/`：审查这些委托工件是否已被主 agent 理解、是否需要采用/拒绝，并把结论写入 review 文件
5) Workflow State Suffix 审计（检查 4 种后缀使用是否一致）：
   - `session` 后缀：只由 ws-dev-lite / ws-intake 写入，标记会话级进度
   - `gate` 后缀：由 ws-dev / aiws plan-verify 写入，标记计划/实现门禁结果
   - `plan` 后缀：由 ws-plan 写入，标记计划阶段状态
   - `gateway` 后缀：由 ws-finish / aiws deliver 写入，标记交付门禁结果
   - 检查当前 change 中使用的后缀类型是否正确对应所在阶段；若出现混用，在审计报告中标记异常。
6) 将审计落盘到（目录不存在则创建）：
   - 默认：`.aiws/changes/<change-id>/review/codex-review.md`
   - 回退：`.aiws/tmp/review/codex-review.md`（仅在无法确定 `change-id` 时使用）
   - 若已有其它 reviewer 文件：不要覆盖它们；当前 reviewer 应写自己的文件或更新自己的汇总文件
7) 若 triage 标记为 `dual_review_required`，继续补齐 dual review gate：
   - 运行/收敛 `$ws-spec-review`，落盘 `.aiws/changes/<change-id>/review/spec-review.md`
   - 运行/收敛 `$ws-quality-review`，落盘 `.aiws/changes/<change-id>/review/quality-review.md`
   - 不要把单个 `codex-review.md` 误当成 finish gate 已完成
8) 运行 `aiws memory write decision://<change-id>/review` 写入审查发现的约束/决策。
9) 回复中输出：
   - `证据（Evidence）:` 证据文件路径
   - `主要风险（Top risks）:` 3–8 条（高→低）
   - `下一步（Next）:` 最小修复清单 + 最小验证命令

安全：
- 不打印 secrets。
- 不执行破坏性命令。
- 若 oMo agent 不可用，回退为当前 agent 本地 review，不阻断流程。

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`

并发矩阵：explorer/read-only/证据检查可任意并行且无需独立分支（各自写独立 `analysis/`/evidence）；worker 的代码、测试、共享文件写入必须串行，或使用独立分支/不相交 `writeScope` 后由 integrator 合并。并行期间主 session 只做纯读准备，不 FIX、不改代码、不重启服务。
