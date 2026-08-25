---
name: ws-autonomy
description: 使用时机：需要自主协作、无人值守执行时。触发词：自主、自动化、协作、retry、rescue。注意：实验功能，不用于正式交付。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 为当前 OpenCode 任务声明 autonomous execution mode，而不是直接接管 runtime。
- 明确 completion contract / retry contract / rescue policy / evidence path。
- 在需要时引导使用 `.opencode/helpers/tmux-swarm-scan.sh` 与 `tmux-swarm-rescue.sh`。
- 在需要时引导使用 `.opencode/helpers/approval-whitelist-check.sh` 判定低风险命令/路径是否可自动放行。
- 在需要时引导使用 `.opencode/helpers/approval-whitelist-run.sh` 执行已获 `allow` 的简单命令。
- 在需要时引导使用 `.opencode/helpers/approval-whitelist-watchdog.sh` 轮询待执行队列。

必需输入：
- `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`
- `packages/spec/docs/opencode-autonomous-swarm.md`
- `packages/spec/docs/opencode-omo-adapter.md`
- 当前任务绑定（`Req_ID` / `Problem_ID` / `change` / `Verify`）

必需输出：
- `Execution Mode:` `single-agent` / `omo-native` / `omo-native + tmux-swarm`
- `Completion Contract:`
- `Retry Contract:`
- `Rescue Policy:`
- `Evidence:`
- `Next:`

阻断条件：
- 当前任务未绑定
- 无法确认当前是否启用了 oMo，又不能接受回退
- 需要 tmux swarm 但当前环境没有 `tmux`

执行步骤（建议）：
1) 先运行 `$ws-preflight`，确认真值文件完整。
2) 判断当前模式：
   - 若未启用 `.opencode/oh-my-opencode.json`：`single-agent`
   - 若启用了 oMo：`omo-native`
   - 若启用了 oMo 且当前接受 tmux 巡检/救援：`omo-native + tmux-swarm`
3) 输出 `Completion Contract:`，至少包含：
   - 真值文件已读取
   - 任务/change 已绑定
   - Verify 已执行
   - review/evidence 已落盘
4) 输出 `Retry Contract:`：
   - `aiws plan-verify` 失败 -> `ws-plan`
   - `ws-review` blocker -> `ws-dev`
   - `validate` 失败 -> `ws-dev`
5) 输出 `Rescue Policy:`：
   - 只允许 `(y/n)`、`Press Enter to continue`、退出 copy-mode
   - 不允许 blind `Ctrl+C` / 广播 shell 命令 / 自动 commit/push
6) 若选择 `omo-native + tmux-swarm`：
   - 如需判定某个低风险命令是否可自动放行：运行 `bash .opencode/helpers/approval-whitelist-check.sh . --kind <read|write|host-permission> --command "<cmd>" [--path "<target>"]`
   - 如需让 watchdog 真正执行已放行的简单命令：运行 `bash .opencode/helpers/approval-whitelist-run.sh . --kind <read|write|host-permission> --command "<cmd>" [--path "<target>"]`
   - 如需持续轮询外部蜂群写入的待执行项：运行 `bash .opencode/helpers/approval-whitelist-watchdog.sh . --once` 或去掉 `--once` 持续运行
   - 提示先运行 `.opencode/helpers/tmux-swarm-scan.sh`
   - 如需安全救援，再运行 `.opencode/helpers/tmux-swarm-rescue.sh`

安全：
- `ws-autonomy` 不是 runtime controller。
- 任何 tmux helper 的结果都必须回收到 `.aiws/tmp/opencode-autonomy/`，最终再由主 agent 收敛到 `.aiws/changes/<id>/...`。

## 完成判定

- 输出含 `Execution Mode:` / `Completion Contract:` / `Retry Contract:` / `Rescue Policy:` / `Evidence:` / `Next:` 六项；若涉及 tmux helper，结果已回收至 `.aiws/tmp/opencode-autonomy/`。
