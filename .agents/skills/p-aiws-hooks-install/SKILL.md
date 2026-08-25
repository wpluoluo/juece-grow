---
name: p-aiws-hooks-install
description: 私有：启用 git hooks 门禁（core.hooksPath=.githooks）
disable-model-invocation: true
---

目标：
- 为当前 git 仓库启用 aiws 门禁 hooks（`git commit`/`git push` 自动跑 `aiws validate .`）

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws hooks install .
elif command -v aiws >/dev/null 2>&1; then
  aiws hooks install .
else
  npx @aipper/aiws hooks install .
fi
```

验证（可选）：
```bash
git config core.hooksPath
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws hooks status .
elif command -v aiws >/dev/null 2>&1; then
  aiws hooks status .
else
  npx @aipper/aiws hooks status .
fi
```

## 完成判定

- `aiws hooks install .` 成功：`git config core.hooksPath` 指向 `.githooks`，且 `aiws hooks status .` 显示门禁已启用。
