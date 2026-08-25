---
name: p-aiws-change-next
description: 私有：给出下一步建议（只读）。使用时机：change 已创建、需要继续推进时。触发词：下一步、next、建议。只读查询，不改动工件。
disable-model-invocation: true
---

目标：
- 基于当前仓库与 changes 工件状态，输出最小下一步建议

执行（在仓库根目录）：
```bash
change_id="<change-id>"
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change next "$change_id"
elif command -v aiws >/dev/null 2>&1; then
  aiws change next "$change_id"
else
  npx @aipper/aiws change next "$change_id"
fi
```

## 完成判定

- `aiws change next` 成功输出最小下一步建议（exit 0）。
