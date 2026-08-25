---
name: p-aiws-init
description: 私有：初始化工作区（生成真值文件与门禁）
disable-model-invocation: true
---

目标：
- 生成/补齐真值文件与门禁文件（以 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md` 为准）
- 写入/更新 `.gitignore` 的 aiws 托管块
- 生成/更新 `.aiws/manifest.json`（用于漂移检测）

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws init .
  ./node_modules/.bin/aiws validate .
elif command -v aiws >/dev/null 2>&1; then
  aiws init .
  aiws validate .
else
  npx @aipper/aiws init .
  npx @aipper/aiws validate .
fi
```

约束：
- 不写入任何 secrets
- 只允许更新托管块（`AIWS_MANAGED_BEGIN/END`）或 spec 指定的 `replace_file` 文件

## 完成判定

- `aiws init .` + `aiws validate .` 均成功：真值文件、`.gitignore` 托管块、`.aiws/manifest.json` 已生成且无漂移。
