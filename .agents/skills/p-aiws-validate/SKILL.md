---
name: p-aiws-validate
description: 私有：校验工作区（漂移检测 + 门禁）。使用时机：提交前需要确认工作区无漂移时。触发词：校验、validate、漂移、门禁。
disable-model-invocation: true
---

目标：
- 作为 CI/本地门禁：校验 required 文件结构、托管块、`.aiws/manifest.json` 漂移
- 强门禁：缺 `python3`/缺 required 脚本也应失败

执行（在仓库根目录）：
```bash
if [[ -x "./node_modules/.bin/aiws" ]]; then
  AIWS_VALIDATE_STAMP=1 ./node_modules/.bin/aiws validate .
elif command -v aiws >/dev/null 2>&1; then
  AIWS_VALIDATE_STAMP=1 aiws validate .
else
  AIWS_VALIDATE_STAMP=1 npx @aipper/aiws validate .
fi
```

证据（可选）：
- stamp：`.aiws/tmp/aiws-validate/*.json`（由 `.gitignore` 忽略）

## 完成判定

- `aiws validate .` exit 0：required 文件结构、托管块、`.aiws/manifest.json` 均无漂移。
