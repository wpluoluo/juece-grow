---
name: p-aiws-change-start
description: 私有：切分支并初始化变更工件（可选安装 hooks）
disable-model-invocation: true
---

目标：
- 切到分支 `change/<change-id>` 并初始化 `.aiws/changes/<change-id>/` 工件
  - 若检测到 `.gitmodules`（git submodules），默认使用 `--no-switch` 避免切走 superproject 分支导致 submodule 状态混乱；传 `--switch` 可强制切换

要求：
- 需要 git 仓库；若不是 git 仓库先 `git init`

执行（在仓库根目录）：
```bash
change_id="<change-id>"
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change start "$change_id"
elif command -v aiws >/dev/null 2>&1; then
  aiws change start "$change_id"
else
  npx @aipper/aiws change start "$change_id"
fi
```

可选参数：
- `--hooks`：同时执行 `aiws hooks install .`
- `--title <title>`：写入标题
- `--no-design`：不生成 design.md
- `--switch`：显式切换 superproject 分支（默认存在 `.gitmodules` 时不切换，传此参数强制切换）
- `--no-switch`：不切换当前分支（仅确保 `change/<change-id>` 分支存在并初始化工件）；适用于 superproject + submodule 场景
- `--allow-dirty`：允许 dirty 工作区执行 start（不推荐）

## 完成判定

- `aiws change start` 成功：分支 `change/<change-id>` 已就绪且 `.aiws/changes/<change-id>/` 已初始化（exit 0）。
