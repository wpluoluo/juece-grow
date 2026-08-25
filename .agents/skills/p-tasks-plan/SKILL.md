---
name: p-tasks-plan
description: 原子：tasks 同步（从 .aiws/changes/<id>/tasks.md 生成 update_plan payload）
disable-model-invocation: true
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 用 `.aiws/changes/<change-id>/tasks.md` 的 checkbox 任务作为“步骤真值”
- 生成可直接用于 `update_plan` 的 JSON payload（`pending/in_progress/completed`）
- 输出当前进度摘要（done/total + 当前 in_progress）

约束：
- 不写入任何 secrets（token、账号、内网端点等不得进入 git）
- 只读 `.aiws/changes/<id>/tasks.md`（不自动改写 tasks 文件）
- 未运行不声称已运行

执行步骤（建议）：
1) 先运行 `$ws-preflight`。
2) 推断 `change-id`：
   - 优先从当前分支名读取：`git rev-parse --abbrev-ref HEAD`（期望形如 `change/<change-id>`）
   - 若无法推断：让用户明确本次要同步的 `<change-id>`
3) 检查 tasks 文件存在：`test -f .aiws/changes/<change-id>/tasks.md`
4) 输出进度摘要：
```bash
python3 tools/ws_tasks_plan.py status --file .aiws/changes/<change-id>/tasks.md
```
5) 生成 `update_plan` payload（JSON 输出到 stdout）：
```bash
python3 tools/ws_tasks_plan.py plan --file .aiws/changes/<change-id>/tasks.md --explanation "sync tasks.md -> update_plan"
```
6) 调用 `update_plan`，将上一步 JSON 原样作为入参（确保任意时刻最多 1 条 `in_progress`）。

输出要求：
- `Change_ID:` <change-id>
- `Tasks:` `.aiws/changes/<change-id>/tasks.md`
- `Next:` 推荐下一步（通常为继续完善 tasks 或进入 `$ws-dev`）

## 完成判定

- `update_plan` payload 已生成且与 tasks.md 状态一致：任意时刻最多 1 条 `in_progress`；输出含 `Change_ID:` / `Tasks:` / `Next:`。
