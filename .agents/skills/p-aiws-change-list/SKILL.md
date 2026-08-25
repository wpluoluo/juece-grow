---
name: p-aiws-change-list
description: 私有：列出 changes 工件（只读）
disable-model-invocation: true
---

目标：
- 列出当前仓库的变更工件与状态

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change list
elif command -v aiws >/dev/null 2>&1; then
  aiws change list
else
  npx @aipper/aiws change list
fi
```

## 完成判定

- `aiws change list` 成功输出变更工件列表（exit 0）。
