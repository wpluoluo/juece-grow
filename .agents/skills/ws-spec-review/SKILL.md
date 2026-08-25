---
name: ws-spec-review
description: 使用时机：需要审查流程完整性、requirements 归因时。触发词：规范审查、流程审计、spec review。注意：实现质量审查请用 ws-quality-review。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 审查当前改动是否满足真值文件、change 绑定、证据路径和 gate 完整性要求
- 把“流程/规范层 blocker”与“代码层问题”区分开，优先落盘到 `.aiws/changes/<change-id>/review/spec-review.md`

OpenCode + oMo 优先策略：
- 若检测到 `.opencode/oh-my-opencode.json`，或当前会话明确可用 `oracle` / `librarian`，优先借用它们做 spec / gate 审查。
- `@oracle` 优先负责 requirements / gate / evidence 独立审查；`@librarian` 负责补文档、规范、依赖与路径真值。
- 主 agent 负责把 blocker / warning / next 收敛到最终 review 文件。

阶段定位：
- review 子 gate；负责 requirements / plan / evidence / workflow gate 完整性审查。

## 方法论（引用 $code-review）

> Spec 轴审计执行细节引用 `$code-review`（mattpocock 双轴方法论）：Spec 轴 = 代码是否忠实实现需求/真值归因，不重复正文。

必需输入：
- `AI_PROJECT.md`
- `REQUIREMENTS.md`
- `AI_WORKSPACE.md`
- 当前 `git diff`
- 若存在：`plan/...`、`.aiws/changes/<change-id>/proposal.md`、`tasks.md`、`review/`、`evidence/`

必需输出：
- `证据（Evidence）:` `.aiws/changes/<change-id>/review/spec-review.md` 或回退 `.aiws/tmp/review/spec-review.md`
- `阻断项（Blockers）:` requirements 归因 / gate / evidence 缺口
- `下一步（Next）:` 修复项与最小验证命令
- 证据分级规则：BLOCKER/HIGH 发现需要展开证据（代码引用/日志/上下文）；PASS/LOW 发现一行结论即可

阻断条件：
- 无法定位项目根或真值文件
- 无法判断当前 change / 归因上下文
- 无法写 review 证据

完成判定：
- 已落盘 spec review 证据，且明确指出 blocker / warning / next。

步骤（建议）：
1) 先运行 `$ws-preflight`。
   - 若检测到 oMo：优先让 `@oracle` 做 spec review 草稿；需要补规范上下文时再调用 `@librarian`。
2) **Change Scope Assessment**：在深入审查前，先获取变更上下文。
   - 执行 `git diff --stat HEAD` 查看变更文件及行数
   - 执行 `git log --oneline -3` 查看最近提交
   - 使用此上下文将审查聚焦在变更区域，各 reviewer agent 无需独立发现变更范围
3) 对照真值文件检查（治理层清单，方法论细节见 `$code-review` Spec 轴）：
   - 当前改动能否归因到 `Req_ID` / `Problem_ID`
   - `plan/...`、`proposal.md`、`tasks.md`、`evidence/` 是否与改动保持一致
   - 是否存在越界目录改动、危险操作、未声明的非目标扩张
   - 是否已经准备好可复现验证入口
4) 把结论落盘到：
   - 默认：`.aiws/changes/<change-id>/review/spec-review.md`
   - 回退：`.aiws/tmp/review/spec-review.md`
5) 输出：
   - `证据（Evidence）:` — 按严重级别处理：**BLOCKER/HIGH** 附完整证据链（归因/路径引用）；**WARNING** 仅给 1 行结论；**通过项** 不输出或仅 "✓ 通过"
   - `阻断项（Blockers）:` requirements 归因 / gate / evidence 缺口
   - `警告（Warnings）:`
   - `下一步（Next）:` 修复项与最小验证命令

重点：
- 这是 spec / gate review，不是代码质量 review。
- 若发现实现质量或回归问题，转交给 `$ws-quality-review`。

安全：
- 不打印 secrets。
- 不执行破坏性命令。
- 若 oMo agent 不可用，回退为当前 agent 本地 spec review。

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`