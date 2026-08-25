---
name: ws-delegate
description: 使用时机：需要拆分子任务、委托给子 agent 时。触发词：委托、子 agent、拆分、并行、sub-agent。注意：简单任务不需委托。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：优先 oMo agent 拆分任务；不可用则回退 OpenCode delegation / 单 agent。

## 核心约束

**先判是否值得派**（规范正文 `packages/spec/docs/pi-subagent-first.md` §何时派 subagent / 何时不派）：
- 简单任务（≤3 文件 / ≤100 行 / 纯文档或单点改动）→ **不委托**，主 session 直接干（`ws-dev-lite` 即可）
- 仅 3 类值得委托：① 独立审查（review/spec/quality）② 真正可并行的独立文件写入（隔离门：并行 subagent 各自独立文件集/分支，写集无交集）③ 上下文隔离（大任务防主 session 爆）
- 大任务委托前：把「派谁 / 各写哪个目录 / 如何合并」写进 tasks.md；主进程等待时做非冲突准备，**不 sleep 轮询空等**

- **Subagent-First**：主 session 只编排收敛，不写代码；产出由 subagent 完成并可追溯。
- **Handoff 证据**：worker 必须产出 `.aiws/changes/<id>/handoff-evidence.md`（完成/未完成/残余风险）。缺失=委托未完成。

## 方法论（引用 $claude-handoff）

> 会话移交文档撰写细节引用 `$claude-handoff`（mattpocock）：如何组织交接文档（完成内容/未完成/残余风险/建议技能），不重复正文。本 skill 保留 AIWS 治理层：handoff 证据必须落盘 `.aiws/changes/<id>/handoff-evidence.md`（缺失=委托未完成），协议结构与归因不变。

## 必需输入 / 输出

**输入：** 真值 + delegation contract 上下文（`workflow-delegation-contracts.md`、`opencode-omo-adapter.md`、`opencode-subagent-first.md`）；任务已绑定 `Req_ID` / change / Verify。

**输出：** `Delegation Plan:` role / preferred agent / readScope / writeScope / artifactTargets / fallback；`Context Curation:` / `Execution Mode:` / `Evidence:` / `Next:`。

**执行：** 主 session 不改代码；产物由 subagent 可追溯产出；handoff 含 delegate round number、产出路径、未关闭项。

**阻断：** 任务未绑定 / 边界不清 / 未策展上下文 / 无法判断 oMo 可用性 / handoff 缺失。

## 角色映射

| aiws | oMo | 标准角色 | 职责 | 读 | 写 |
|------|-----|----------|------|----|----|
| planner | planner-sisyphus | implementer | 代码+测试 | 真值+change | 代码+测试+evidence/ |
| explorer | @explore / @librarian | reviewer | 独立审查 | 真值+diff+evidence | review/*.md |
| reviewer | @oracle | researcher | 分析探索 | 真值+外部文档 | analysis/*.md |
| integrator | 当前主 agent | | | | |

## 连续执行循环

1. 主 session 策展 JSONL → dispatch `aiws-worker`
2. 检查 Status：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
3. DONE → dispatch `aiws-reviewer`；pass→收敛 evidence；fail→worker 修复（≤3）
4. DONE_WITH_CONCERNS → 先 `ws-quality-review`
5. NEEDS_CONTEXT → 补上下文重试（≤2）；仍失败→回退单 agent
6. BLOCKED → 输出 blocker，不继续

## L2 tmux 派活（通知→执行→回收）

L2 链路由 `TmuxSessionSpawner`（`packages/aiws/src/commands/session-spawner-tmux.ts`）执行：spawn 独立 tmux 会话跑 CLI（opencode/pi）→ `tmux send-keys` 发通知消息（含产物契约）→ 子 agent 读 handoff.md 执行 → 写 evidence → 主进程 waitOne 轮询判定。

1. **通知派活**：`aiws change tasks execute --strategy tmux` 生成 `tasks/<id>/handoff.md` + `context.jsonl` 后，spawn 独立 tmux 会话（`aiws-task-<id>`），通过 send-keys 发送通知消息（默认消息含产物契约）。
2. **子 agent 执行**：读 `tasks/<id>/handoff.md` 开工；完成后写三产物：`tasks/<id>/evidence/summary.md`（摘要）、`tasks/<id>/evidence/done.signal`（完成信号，存在即完成）、`.aiws/changes/<id>/handoff-evidence.md`（完成/未完成/残余风险，ws-delegate 契约）。
3. **主 session 回收**：waitOne 轮询判定——`evidence/done.signal` 存在 → completed；或 `summary.md` 非占位内容 → completed；超时 → cancelled。tmux 会话自动销毁（`; exit`）。

| 产物 | 路径 | 判定角色 |
|------|------|----------|
| summary.md | `tasks/<id>/evidence/summary.md` | 主 session waitOne：非占位内容 → completed（兜底） |
| done.signal | `tasks/<id>/evidence/done.signal` | 主 session waitOne：存在 → completed（权威） |
| handoff-evidence.md | `.aiws/changes/<id>/handoff-evidence.md` | 主 session：ws-delegate 契约核查（缺失=委托未完成） |

> 判定协议不变（done.signal 权威 + summary.md 兜底）；自定义 `handoffMessage` 可覆盖默认通知消息。视觉 worker 只收路径，显式使用 `aipper/qwen3` 或 `aipper/gpt-5.5`，回收 `summary.md`/结构化结果/`done.signal`。

## 上下文策展

1. 读合同 `contextFiles` → 2. 展开 glob（`<id>`）→ 3. 委托者调整（增删/priority/sections）→ 4. 预算 high+medium ≤5 文件、总行 ≤4000 → 5. 写 `.aiws/changes/<id>/analysis/<role>-context.jsonl`

插件 `aiws-inject-context` 自动注入；`task()` 指定 `role: <role>` 即可。

## 子 agent 返回协议

```
**Status:** DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
**Completed:** <实现内容>
**Files Changed:** <路径>
**Verification:** <命令+结果>
**Artifacts:** <analysis|patches|review|evidence 路径>
**Concerns:** <疑虑或未完成项>
```

## Delegation Plan 格式

```
**Delegation Plan:**
- role: worker | preferred agent: aiws-worker
- readScope: <...> | writeScope: <...>
- artifactTargets: .aiws/changes/<id>/patches/, .aiws/changes/<id>/evidence/
- fallback: single-agent
Context Curation: .aiws/changes/<id>/analysis/worker-context.jsonl
```

## 委托者检查清单

**派遣前：** `[ ] prompt 含上下文引用` `[ ] JSONL 已写` `[ ] 预算通过` `[ ] readScope/writeScope/artifactTargets 已声明`

**返回后：** `[ ] 解析 Status` `[ ] 非 DONE→按规则处理` `[ ] 非 DONE→记入 delegation-decisions.md` `[ ] handoff 存在且非空`

**安全：** 不把 `ws-delegate` 做成第二套 orchestrator；delegated agent 不越权写未授权文件；有 `.gitmodules` 时不跳过 submodule drift check。

> 运行时行为约束：`packages/spec/docs/run-behavior-guidelines.md`

并发矩阵：explorer/read-only/证据检查可任意并行且无需独立分支（各自写独立 `analysis/`/evidence）；worker 的代码、测试、共享文件写入必须串行，或使用独立分支/不相交 `writeScope` 后由 integrator 合并。并行期间主 session 只做纯读准备，不 FIX、不改代码、不重启服务。
