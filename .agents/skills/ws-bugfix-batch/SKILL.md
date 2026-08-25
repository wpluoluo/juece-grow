---
name: ws-bugfix-batch
description: 使用时机：批量修复禅道激活 bug 时。触发词：批量、batch、自动修复、循环修复。注意：单个 bug 修复请走 ws-bugfix。
---

# ws-bugfix-batch

用中文输出（命令/路径/代码标识符保持原样不翻译）。

本 skill 是批量修复禅道激活 bug 的**「预筛 + 监视」编排器**：先对每个 bug 做预筛判定（落盘 `preflight.md`），再由外部 CLI `aiws bugfix batch run` 串行派发——每个 bug 一个 tmux pi 子 session 走**完整 ws-bugfix**（含自己的 REVIEW / resolve / change finish），CLI 只核验 + restore；本 skill 负责预筛、监视与汇总，人工只介入 `skipped` / `needs_human` / `failed` 三类。

> 本 skill 依赖 aiws 提供 `aiws bugfix batch run` 命令（版本过低或缺命令则无法执行）。

## 版本预检（硬门禁）

批量流程开始前**必须**先探测命令存在性（而非比对版本号——版本号会随发版过时）：

- 执行 `aiws bugfix batch run --help`；命令存在（exit 0）→ 通过
- 命令不存在（command not found / exit ≠ 0）→ **立即 stop**，报告"需升级 aiws 至含 `aiws bugfix batch run` 的版本"
- **明确禁止**降级为 session 内手动循环（08-03 教训：agent 把"命令不存在"误判为流程问题，卡住问用户）

## 执行流程（预筛 + 监视）

1. 探测 `aiws bugfix batch run --help` 确认命令存在（不通过则 stop）
2. `aiws bugfix batch start <project-id>`（或从 `.aiws/config.json` 读 `project_id`）→ 拉取全量激活 bug → 获取 `batchId`
3. **预筛 pass**：按顺序对每个 bug 判定 → 结论落盘 `bug/<bug-id>/preflight.md`（`runnable` 或 `needs_human: <原因>`），详见下方「预筛 pass」
4. `aiws bugfix batch run <batch-id>`（建议 `--parallel 1`）— 串行派发：每个 bug 一个 tmux pi 子 session 走完整 ws-bugfix（handoff 引用 preflight.md）；CLI 核验 done.signal + restore 回 base 后自动下一个
5. `aiws bugfix batch status <batch-id>` — 汇总：`done` / `skipped(原因)` / `needs_human(原因)` / `failed`（stats 层面 needs_human 计入 failed 桶，per-bug 明细仍单独显示）
6. **人工最后介入**：只处理 `skipped` / `needs_human` / `failed` 三类（用 status 定位，重新 spawn 子 session 或手动处理）；不打断 AI 可处理项的循环

### 预筛 pass

对 `aiws bugfix batch start` 拉到的每个 bug，在派发前先判定其可执行性：

- 自查对象：bug 详情 JSON 的 `steps` / `expect` / `actual` / `attachments` 完整性 + 标题模块识别（backend / web / 其它）——bug 详情唯一真值源 `bug/zentao-bug-<id>.json`
- 判定方式：AI 自查；信息缺失 / 模块归属不明 / 复现不确定时，必要时与用户 grill 式澄清
- 结论落盘：`bug/<bug-id>/preflight.md`，内容为一行其一：
  - `runnable` —— 信息完整、模块可识别，可进入派发
  - `needs_human: <原因>` —— 信息缺失 / 无法定论，跳过自动派发，交人工后置处理
- 预筛只影响人工介入面，不阻塞 `batch run` 队列的机械执行

### 执行模式

- **单工作目录串行执行（默认 parallel=1）**：不引入多 git worktree（`finishBug` 会 checkout base + merge，并发互相破坏）
- `--parallel` 参数保留但不鼓励使用；默认行为为串行
- 只读预筛、分析、证据检查可并行且无需独立分支；代码编写、测试修改、共享 change 文件写入必须串行，或隔离分支/不相交写集后由 integrator 合并。
- 视觉截图判读沿用独立 tmux Pi worker + 显式 `aipper/qwen3` 或 `aipper/gpt-5.5`，仅回收路径、`summary.md`、结构化结果和 `done.signal`。

### 派发会话自动恢复（配合 `aiws pi watch --detect-stall`）

被派发的子 session（tmux pi）可能因上游 API 瞬时错误（余额不足 / 5xx / 网络）卡住；`pi-session-state.json` 事件在非交互 session 不一定写入，建议**派发 batch / 审查会话后随行启动** pane 级 watchdog：

```bash
aiws pi watch --detect-stall --stall-pattern 'aiws-task-*'   # 批量派发的 worker 会话
aiws pi watch --detect-stall --stall-pattern 'review-*'      # 独立审查会话
```

检测 tmux pane 文本中的上游错误特征 → 冷却（默认 60s）→ 自动 `send-keys "继续"`（pi 多上游会重试切到健康上游）→ 达上限（默认 5）输出诊断；`--once` 可单轮检查（配脚本）。

## 防自杀协议（硬规则）

清理 batch 残留进程**禁止**使用 `ps aux | grep -E "<含 opencode/pi>"` + `kill` 组合——模糊 grep 会匹配到主 session 自身，误杀自己导致停机（08-07 教训：主 session 执行 `kill 32540 32542` 误杀自身 opencode，停机约 6 小时）。

正确做法：

1. 精确匹配：`pgrep -f "^aiws bugfix batch run"`（带 `^` 锚定），不要用 `grep -E "opencode"` / `grep pi`（短名会误匹配大量无关进程）
2. 或读 batch-run 的 PID 文件（如 `/tmp/batch-run-<id>.pid`），只 kill 该 PID 树
3. kill 前必查：`ps -o pid,ppid,cmd -p <pid>` 确认目标不是自己 / 父进程 / 主 session
4. kill 后确认：`ps -p <pid> >/dev/null 2>&1 && echo alive || echo gone`

## 数据真值

> **JSON 是 bug 详情唯一真值源**。所有 agent 必须从 `bug/zentao-bug-<id>.json` 读取 bug 详情（steps/expect/actual/notes 等），**不得**依赖任何 Markdown 文件中的转述。
>
> Bugfix 目录下 `.md` 文件（如有）仅为人类可读的索引摘要，不具备数据权威性。

## 完成判定

`aiws bugfix batch run <batch-id>` 执行成功且结束（finally 无 restore 失败中止），且 `aiws bugfix batch status <batch-id>` 无 `failed` / `needs_human` 剩余 → batch 完成，输出汇总报告（含 `done` / `skipped(原因)` / `needs_human(原因)` / `failed` 明细）。

- `skipped` 属可接受结果（无需返工），但仍应复核其 `原因` 是否合理
- `failed` / `needs_human` 剩余 → 未完成：按第 6 步入工介入；**failed/needs_human 项不会自动重新入队**（队列只认 `pending` 状态），需人工把 batch-state.json 中该项 `status` 改回 `pending` 并从 `processed_bug_ids` 移除后再 `batch run`，或手动处理该项

## compress 失败协议（通用）

compress 调用失败时的处理协议：

1. **失败重试一次**：重新构造 `content` 数组后重试（LLM 可能把数组参数错误序列化成字符串）
2. **仍失败 → 跳过压缩，继续工作**：不要 stop，不要阻塞流程
3. **心理模型**：compress 是优化手段，不是生死线（08-01 证明 243K 上下文不压缩照常跑完；08-05 死于"失败即停"导致整个流程卡死）
