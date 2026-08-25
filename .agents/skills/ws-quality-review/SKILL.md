---
name: ws-quality-review
description: 使用时机：需要审查实现质量、测试覆盖时。触发词：质量审查、质量、回归、覆盖、代码体检。注意：流程完整性审查请用 ws-spec-review。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 审查当前改动的行为正确性、边界条件、测试覆盖和实现质量
- 把“代码/行为层 findings”优先落盘到 `.aiws/changes/<change-id>/review/quality-review.md`

OpenCode + oMo 优先策略：
- 若检测到 `.opencode/oh-my-opencode.json`，或当前会话明确可用 `oracle` / `explore`，优先借用这些 agent 做质量审查。
- `@oracle` 优先负责独立质量/回归审查；`@explore` 负责补代码路径、依赖关系和影响面探索。
- 主 agent 负责把 findings / gaps / next 收敛并落盘。

阶段定位：
- review 子 gate；负责实现质量、行为回归与验证覆盖审查。

## 方法论（引用 $code-review）

> Standards 轴审计（代码约定/坏味基线）执行细节引用 `$code-review`（mattpocock 双轴方法论），不重复正文。本文件保留质量审查特有的治理层检查项（Playwright 强制、AI-Slop 检查等）。

必需输入：
- 当前 `git diff`
- 已执行的验证结果
- 相关代码 / 配置 / 测试文件
- 若存在：`.aiws/changes/<change-id>/analysis/`、`patches/`、已有 review 文件

必需输出：
- `证据（Evidence）:` `.aiws/changes/<change-id>/review/quality-review.md` 或回退 `.aiws/tmp/review/quality-review.md`
- `主要发现（Findings）:` 高到低排序的问题 / 风险 / 缺失测试
- `下一步（Next）:` 最小修复项与回归命令
- 证据分级规则：BLOCKER/HIGH 发现需要展开证据（代码引用/日志/上下文）；PASS/LOW 发现一行结论即可

阻断条件：
- 没有可审改动
- 没有任何验证上下文
- 无法写 review 证据

完成判定：
- 已落盘 quality review 证据，且 findings / 测试缺口 / next 明确。

步骤（建议）：
1) 先读取 `git diff`、验证结果与相关代码。
   - 若检测到 oMo：优先让 `@oracle` 做 quality review 草稿；必要时再调用 `@explore` 补代码路径上下文。
2) **Change Scope Assessment**：在深入审查前，先获取变更上下文。
   - 执行 `git diff --stat HEAD` 查看变更文件及行数
   - 执行 `git log --oneline -3` 查看最近提交
   - 使用此上下文将审查聚焦在变更区域，各 reviewer agent 无需独立发现变更范围
3) 检查：
   - 行为是否可能回归
   - 边界条件 / 失败路径是否覆盖
   - 测试是否足以支撑改动
     - 是否存在明显复杂度、耦合、可维护性或性能问题
     - **Playwright E2E 审查**（当变更涉及 frontend-logic / full-stack 时执行）：
       - Playwright 测试覆盖是否与改动的前端逻辑范围匹配（不要求 100% 全量覆盖，但关键交互路径必须有测试）
       - 测试使用了多少 mock 后端 vs 真实后端（优先推荐真实后端 + `start_cmd`/`health_check`）
       - 复杂用户交互（滑块拖拽、多步表单、模态框确认等）是否被测试覆盖
       - 测试是否可独立重复执行（不依赖人工预置状态）
     - **AI-Slop 检查**（source: `workflow-review-gates.json` aiSlopChecks）：
      - unnecessary_abstraction：过度抽象（单实现接口、未使用的泛化层）
      - fake_comments：伪注释（表述代码行为但不解释 why，或与代码不一致）
      - over_defensive：过度防御（不必要的安全检查、对不可能情况的处理）
      - cargo_cult：货舱崇拜（照搬模式但不理解原因，如不必要的 observer/strategy）
4) 将结论落盘到：
   - 默认：`.aiws/changes/<change-id>/review/quality-review.md`
   - 回退：`.aiws/tmp/review/quality-review.md`
5) 输出：
   - `证据（Evidence）:` — 按严重级别处理：**BLOCKER/HIGH** 附完整证据链（代码引用、影响分析）；**WARNING** 仅给 1 行结论；**INFO/通过项** 不输出或仅 "✓ 通过"
   - `主要发现（Findings）:` 高到低排序的问题 / 风险 / 缺失测试
   - `测试缺口（Gaps）:`
   - `下一步（Next）:` 最小修复项与回归命令

重点：
- 这是质量 / 回归 review，不替代 requirements / gate review。
- 若发现流程、归因、evidence 缺口，转交给 `$ws-spec-review`。

安全：
- 不打印 secrets。
- 不执行破坏性命令。
- 若 oMo agent 不可用，回退为当前 agent 本地 quality review。

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`