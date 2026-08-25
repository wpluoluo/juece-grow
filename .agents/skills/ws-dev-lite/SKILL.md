---
name: ws-dev-lite
description: 使用时机：单文件/小范围快速修复时。触发词：轻量修复、小改动、单点修复、简单配置。注意：复杂度升高请退回 ws-dev。
---

目标：在不引入完整重流程的前提下，完成一次 simple/local 小问题修复，并保持可验证、可追溯。

定位：
- `ws-dev` 的轻量入口，不是新的 workflow stage。
- 适用于单点修复、局部配置调整、明确回归修复；不适用于中大型任务。

适用前提：
- 目标明确，且能归因到 `Req_ID` 或 `Problem_ID`
- 验证入口明确，且能做最小可复现验证
- 一般只影响单文件或紧密相关的小范围文件（≤2 文件，≤100 行）
- 不需要先改 `REQUIREMENTS.md`，也不需要先单独做 review
- 仅限以下场景：typo 修复、配置调整、已知回归修复、单点 bugfix
- 禁止用于：新 feature 开发、跨模块重构、架构变更

立即升级回主流程的情形：
- 发现任务其实是 medium/complex、跨模块、跨目录或需要方案设计
- 无法明确归因、verify、change 上下文
- 需要新建复杂 change 或处理 submodule 目标分支真值
- 修复过程中出现连锁改动、需要补系统性测试或需求调整
- **Change Type Check**：根据 diff 路径判定，若为 `frontend-logic` 或 `full-stack` 类型 → 立即升级到 `$ws-dev`（lite 不支持 Playwright E2E 门禁）

默认约束：
- 先做 `$ws-preflight`
- **Escape Hatch**：若用户明确说"跳过流程"/"直接改"，允许 early-start 实现，但必须输出 `[escape-hatch: direct-implementation]` 标记，并仍然遵守最小约束（归因、验证、evidence）
- 默认不创建 `plan/...`
- 默认不跑 `aiws plan-verify`
- 默认不要求先做双 review
- 若后续准备提交/交付，仍需进入 `$ws-review` / `aiws commit` / `$ws-finish`

执行步骤：
1) 先读取 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`，输出约束摘要。
2) 先判断自己是否真的属于 lite：
   - 用一句话写清 `Goal`
   - 用一句话写清 `Why lite`
   - 若说不清，立刻回退到 `$ws-dev` 或 `$ws-plan`
3) No-Op 路径（无操作提前退出）：
   - 若验证发现目标改动已存在、问题已修复或需求已满足，允许 early exit。
   - 不产生代码改动，但必须输出：
     - `No-Op decision:` 为什么不需要改动
     - `Evidence:` 引用确认状态的命令输出（如 grep、test、diff 结果）
     - `Next:` 直接回到上一阶段（`/ws-review` / `aiws commit` / `/using-aiws`）
   - 禁止：在没有验证的情况下声称"看起来已经实现了"而跳过。
4) 在当前 change 上下文内实施最小改动：
   - 不为"形式完整"额外扩 scope
   - 不默认补与本问题无关的重构或测试矩阵
5) 运行最小可复现验证：
   - 优先使用 `AI_WORKSPACE.md` 已声明的命令
   - 若只需局部回归，允许运行更窄的验证，但要说明为什么足够
5.5) Requirement Impact Check（硬阻断）：
   - 检查本次修复是否改变了：公开接口行为、API 响应字段、错误信息格式、或 `REQUIREMENTS.md` 中文档化的业务规则
   - 如果是 → **这不是 lite 修复**，立即升级到 `$ws-dev`，并输出 `ESCALATED: 需要补 $ws-req-change`
   - 如果不是 → 输出 `REQ_SYNC: NOT_NEEDED`，继续
6) 留下至少一个可追溯证据：
   - 实际改动文件
   - 或 `.aiws/tmp/...`
   - 或 `.aiws/changes/<change-id>/...`
7) 输出：
   - `变更文件（Changed）:`
   - `验证（Verify）:`
   - `证据（Evidence）:`
   - `Next:` 若准备提交，进入 `$ws-review` 或 `aiws commit`

输出要求：
- 明确说明为什么这是 lite，而不是完整 `ws-dev`
- 未运行不声称已运行
- 一旦发现复杂度升高，立刻停止 lite 叙事，切回 `$ws-dev` 或 `$ws-plan`

Workflow State Suffix（会话门禁约定）：
- `ws-dev-lite` 使用 `session` 后缀（而非 `gate` 后缀）记录本次会话结果。
- `gate` 后缀保留给 `ws-dev` / `aiws plan-verify` 的完整计划门禁；不要在本 skill 中使用 `gate` 后缀。
- 若需要与 `ws-dev` 共享状态：先通过 `$ws-dev` 建立 `gate` 后缀记录，再回到 lite 修复。
- 详细参见 `ws-dev` 的 Workflow State Suffix 约定。

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`

## 完成判定

- 最小改动已实现且最小可复现验证通过；输出含 `Changed:` / `Verify:` / `Evidence:` / `Next:`；No-Op 路径须输出 `No-Op decision:` + `Evidence:`。若触发升级条件则明确输出 `ESCALATED`/`REQ_SYNC: NOT_NEEDED`。
