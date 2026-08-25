---
name: p-aiws-change-templates-which
description: 私有：查看当前 change templates 来源（只读）
disable-model-invocation: true
---

目标：
- 输出当前仓库 change templates 的解析来源与路径（用于排查模板来自哪里）

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change templates which
elif command -v aiws >/dev/null 2>&1; then
  aiws change templates which
else
  npx @aipper/aiws change templates which
fi
```

## 完成判定

- `aiws change templates which` 成功输出模板来源与路径（exit 0）。
