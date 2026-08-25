---
name: ws-auto
description: 使用时机：OpenCode/oMo 会话启动、自动 bootstrap 时。触发词：启动、bootstrap、自动、watchdog。注意：首次初始化请用 ws-preflight。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：
- 为当前 OpenCode 工作区执行一次显式 auto bootstrap，而不是把逻辑塞进用户自己的 `opencode` wrapper。
- 先检查真值文件、托管内容与 autonomy 相关文件是否需要更新。
- 若当前仓库已启用 oMo 且 watchdog 条件齐备：自动确保 tmux 中已有 watchdog。
- 最后给出明确的下一步路由，而不是停留在状态描述。

必需输入：
- `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`
- 当前项目根目录
- 当前任务意图（若已知）

必需输出：
- `Auto Bootstrap:`
- `Update:`
- `OpenCode mode:`
- `Watchdog:`
- `Next:`

阻断条件：
- 缺失任一真值文件
- 当前目录不是 AIWS 工作区，且不存在 `.aiws/manifest.json`
- `.opencode/oh-my-opencode.json` 是无效 JSON

执行步骤（强制）：
1) 先运行 `/ws-preflight`，确认真值文件与项目根路径。
2) 在项目根运行：`aiws opencode auto .`
3) 根据输出收敛结果：
   - 若输出 `update: required` 且随后已执行 `aiws update .`：在 `Update:` 中写明 `applied`
   - 若输出 `mode: oMo-enabled`：在 `OpenCode mode:` 中写明 `oMo-enabled`
   - 若输出 `watchdog:` 为 `already-running` / `created` / `started-with-new-session`：在 `Watchdog:` 中写明已就绪
   - 若输出 `watchdog: skipped (...)`：把跳过原因原样收敛到 `Watchdog:`
4) 给出单一 `Next:`：
   - 若 watchdog 已就绪且任务意图明确：进入 `/using-aiws`、`/ws-plan`、`/ws-dev` 或 `/ws-review`
   - 若只想先声明 autonomous 合同：进入 `/ws-autonomy`
   - 若因缺配置/缺 tmux/invalid JSON 被跳过：先修复对应缺口，不直接假装已进入 autonomous 模式

安全：
- `ws-auto` 允许调用 `aiws update .` 来刷新 AIWS 托管内容，但不自动启用 `.opencode/oh-my-opencode.json`。
- `ws-auto` 只会确保 watchdog 启动；不会自动批准 host permission，也不会自动执行 tmux rescue。

## 完成判定

- 输出含 `Auto Bootstrap:` / `Update:` / `OpenCode mode:` / `Watchdog:` / `Next:` 五项，且 `Next:` 为单一明确路由（非状态描述）。
