---
name: p-aiws-change-finish
description: 私有：安全合并 change/<change-id> 回目标分支（默认 fast-forward）
disable-model-invocation: true
---

目标：
- 将 `change/<change-id>` fast-forward 合并回目标分支，减少手输分支名导致的错误

执行（仓库根目录）：
```bash
change_id="<change-id>"
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change finish "$change_id"
elif command -v aiws >/dev/null 2>&1; then
  aiws change finish "$change_id"
else
  npx @aipper/aiws change finish "$change_id"
fi
```

说明：
- 默认等价于：`git merge --ff-only change/<change-id>`
- 若你当前就在 `change/<change-id>` 分支上，`finish` 会尝试读取 `.aiws/changes/<change-id>/.ws-change.json` 的 `base_branch` 作为目标分支
- 若无法 fast-forward：先在 change 分支里 `git rebase <target-branch>`，再重试 `aiws change finish`

## 完成判定

- `aiws change finish` 成功（exit 0）：`change/<change-id>` 已 fast-forward 合并回目标分支，`.aiws/changes/<change-id>/` 已归档或标记完成。
