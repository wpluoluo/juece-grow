---
name: p-aiws-change-archive
description: 私有：归档变更工件（会先做严格校验并生成 handoff.md）
disable-model-invocation: true
---

目标：
- 将 `.aiws/changes/<change-id>/` 归档到 `changes/archive/<YYYY-MM-DD>/...`

执行（在仓库根目录）：
```bash
change_id="<change-id>"
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change archive "$change_id"
elif command -v aiws >/dev/null 2>&1; then
  aiws change archive "$change_id"
else
  npx @aipper/aiws change archive "$change_id"
fi
```

说明：
- `archive` 默认会先跑严格校验并要求 tasks 全部勾选
- `--force` 会绕过部分门禁（不推荐）
- 归档后会生成交接文档：`changes/archive/<date>-<change-id>/handoff.md`

## 完成判定

- 归档成功：`changes/archive/<YYYY-MM-DD>-<change-id>/` 目录存在且含 `handoff.md`（命令 exit 0）。
