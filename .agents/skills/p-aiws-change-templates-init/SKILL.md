---
name: p-aiws-change-templates-init
description: 私有：在仓库内初始化 change templates（写入 changes/templates）
disable-model-invocation: true
---

目标：
- 初始化 `changes/templates/`（用于在仓库内自定义 proposal/tasks/design 模板）

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change templates init
elif command -v aiws >/dev/null 2>&1; then
  aiws change templates init
else
  npx @aipper/aiws change templates init
fi
```

## 完成判定

- `aiws change templates init` 成功：`changes/templates/` 已生成（exit 0）。
