---
name: ws-intake
description: 使用时机：新需求需要逐条澄清、冻结问题时。触发词：需求澄清、intake、冻结问题、前期沟通。注意：需求已冻结直接进 ws-plan。
---

## 配置

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `recommendAnswers` | boolean | true | 提问时先给出推荐答案 |
| `adversarial` | boolean | true | 对抗式审问：挑战假设+代码库探查 |

目标：
- 在 `/ws-plan` 前把新需求或中大型变更里的待确认问题逐条澄清并冻结。
- "一题一线程"：每次只处理 1 个问题，允许多轮往返到形成明确结论。
- 产出轻量草案：`plan/<timestamp>-<slug>.intake.md`。

> Deep Interview 探询维度见 `_shared/intake/deep-interview.md`

## 发散-收敛两子阶段

当需求模糊、方向不明确时：

### 发散阶段（Explore）
- 快速探索 2-3 个方向（≤3 轮），输出每个方向的摘要+风险+依赖
- **探码前问**：先用 `explore` agent 探查代码库（配置文件、已有实现、文档、测试），探查到的信息直接作为输入，不再重复确认

### 收敛阶段（Converge）
- 从发散结果选 1 个方向，逐条冻结问题
- 回到标准"一题一线程"模式

触发条件：用户说"不确定"/"多个方向"等模糊表达。非模糊需求直接进入收敛。

## 核心原则：一次一个问题

- 每轮只推进 1 个 `Open Questions`，未标记 `frozen/deferred` 前不进入下一题
- 输出格式：`Current question → Why it matters → Options → Exit condition`
- 用户选择后立即写盘更新草案

**队列保护**：用户一次提出多个问题时建队处理：`Queue: [Q1, Q2, Q3]` / `Current: Q1` / `Status: [open/in_discussion/frozen/deferred]`

执行要求：
1) 先读真值文件，必要时 `/ws-preflight`
2) 若存在 `plan/*.intake.md` 则续写，否则新建
3) 拆解为 `Open Questions`，状态只允许 `open/in_discussion/frozen/deferred`
4) **对抗式探码后问**：提问前 spawn `explore` agent：
   - 事实探查：代码库已有答案则记录并跳过提问（`codebase: answered/partial` vs `user: required`）
   - 矛盾检索：搜代码库中与用户假设矛盾的模式
   - 边缘案例：空值、并发写入、依赖不可用等
5) 每次只推进 1 个问题，显式输出 `Current question` / `Why it matters` / `Options` / `Recommended answer` / `Exit condition`
6) **决策树分支遍历**：问题组织为树，每个答案可能产生子分支。使用缩进树格式追踪：
   ```
   ├─ Q1 (frozen)
   │  ├─ Q1.1 (frozen)
   │  └─ Q1.2 ← current
   ├─ Q2 (pending)
   ```
   所有叶节点均 `frozen/deferred` 时 intake 完成。无法继续的分支标记 `UNRESOLVED_BRANCH`。
7) 每轮写盘 intake 草案，至少包含：Deep Interview / Context / Codebase Knowns / Open Questions / Resolved Questions / Frozen Decisions / Draft Scope / Draft Verify / Ready for ws-plan
8) **Error States**：覆盖已知失败模式（网络超时、数据一致性、输入校验边界），含回滚条件与方式
9) **Rollback Plan**：涉及数据迁移、API 契约变更、配置漂移修复时，须包含触发条件、回滚步骤、验证方式、副作用
10) 关键问题已冻结 → `Next: /ws-plan`；否则继续 `/ws-intake`

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`

## 完成判定

- 所有 Open Questions 叶节点均为 `frozen`/`deferred`，无 `UNRESOLVED_BRANCH`；intake 草案含 `Ready for ws-plan`，`Next: /ws-plan`。
