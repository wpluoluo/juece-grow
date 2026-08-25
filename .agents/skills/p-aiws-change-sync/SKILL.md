---
name: p-aiws-change-sync
description: 私有：同步真值基线到 .aiws/changes/<change-id>（写入 .ws-change.json）
disable-model-invocation: true
---

目标：
- 将当前真值文件（`AI_PROJECT.md` / `AI_WORKSPACE.md` / `REQUIREMENTS.md`）的 hash 快照同步到 `.aiws/changes/<change-id>/.ws-change.json`

执行（在仓库根目录）：
```bash
change_id="<change-id>"
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change sync "$change_id"
elif command -v aiws >/dev/null 2>&1; then
  aiws change sync "$change_id"
else
  npx @aipper/aiws change sync "$change_id"
fi
```

## 完成判定

- `aiws change sync` 成功：`.ws-change.json` 已写入当前真值文件 hash 快照（exit 0）。
