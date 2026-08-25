---
name: ws-preflight
description: 使用时机：新会话开始、仓库首次操作时。触发词：预检、初始化、首次、preflight、检查环境。注意：已经开工可直接 ws-dev。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在开始任何“写代码/改配置/落盘文件”之前，对齐工作区真值文件，避免规则漂移。

阶段定位：
- workflow 入口阶段；负责判断当前仓库是否具备继续执行其它 `ws-*` 阶段的前置条件。

必需输入：
- 当前项目根目录候选路径
- `AI_PROJECT.md`
- `REQUIREMENTS.md`
- `AI_WORKSPACE.md`

必需输出：
- `Root:` 当前项目根
- `Found:` 实际读取到的真值文件
- `Missing:` 缺失项
- `OpenCode mode:` `oMo-enabled` / `standard-opencode`
- `Key rules:` 3-8 条约束摘要
- `Next:` 若真值齐全，建议进入 `$ws-plan` 或 `$ws-dev`；若缺失，建议先 `aiws init .`

阻断条件：
- 无法确定项目根目录
- 缺失任一真值文件

完成判定：
- 使用者已经知道当前仓库能否继续进入后续阶段，以及必须遵守的约束与下一步入口。

执行步骤（强制）：
1) 定位项目根目录（submodule 感知）：
   - 优先：`git rev-parse --show-superproject-working-tree`（submodule 内上溯到 superproject 根）
   - 若为空：`git rev-parse --show-toplevel`
   - 若两者都失败：停止并让用户确认当前目录是否为项目根（不要猜测）。
2) 在项目根目录读取以下文件（存在则必须读取；缺失则明确报告缺失项，不要臆测内容）：
   - `AI_PROJECT.md`
   - `REQUIREMENTS.md`
   - `AI_WORKSPACE.md`
3) 若缺失任意真值文件：不要继续“写代码/改配置/落盘文件”。先输出缺失项，并给出下一步建议：
   - `npx @aipper/aiws init .`（或 `aiws init .`）初始化真值文件
   - 然后重新执行 `$ws-preflight`
4) 输出：
   - `Root:` <项目根路径>
   - `Found:` <实际读取到的文件列表>
   - `Missing:` <缺失文件列表>
   - `OpenCode mode:` 
     - 若检测到 `.opencode/oh-my-opencode.json`：`oMo-enabled`
     - 否则：`standard-opencode`
   - 若为 `oMo-enabled`：附一句说明后续 `ws-plan` / `ws-review` / `ws-spec-review` / `ws-quality-review` / `ws-delegate` 会优先借用 oMo agent
   - `Key rules:` 3–8 条 bullet（范围/禁止项/必须产物/必须验证命令）
5) 若存在 `.gitmodules`：
   - 输出 submodule 列表：`git config --file .gitmodules --get-regexp '^submodule\\..*\\.path$'`
   - 检查每个 submodule 是否配置 `submodule.<name>.branch`（缺失则提示先运行 `aiws submodule-setup`；否则 `aiws validate .` 会失败）

安全：
- 不打印 secrets；遇到疑似敏感值只提示“存在风险”但不要复述原文。
- 不执行破坏性命令。
