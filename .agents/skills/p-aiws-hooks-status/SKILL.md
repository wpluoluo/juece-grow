---
name: p-aiws-hooks-status
description: 私有：查看当前仓库 hooks 状态（只读）
disable-model-invocation: true
---

目标：
- 输出当前仓库 hooks 状态（不修改文件）

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws hooks status .
elif command -v aiws >/dev/null 2>&1; then
  aiws hooks status .
else
  npx @aipper/aiws hooks status .
fi
```

## 完成判定

- `aiws hooks status .` 成功输出当前 hooks 状态（exit 0）。
