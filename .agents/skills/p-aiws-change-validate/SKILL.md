---
name: p-aiws-change-validate
description: 私有：校验 changes 工件（可 strict）
disable-model-invocation: true
---

目标：
- 校验 `.aiws/changes/<change-id>/` 工件完整性、归因与 WS:TODO（用于 hooks/CI）

执行（在仓库根目录）：
```bash
change_id="<change-id>"
if [[ -x "./node_modules/.bin/aiws" ]]; then
  ./node_modules/.bin/aiws change validate "$change_id" --strict
elif command -v aiws >/dev/null 2>&1; then
  aiws change validate "$change_id" --strict
else
  npx @aipper/aiws change validate "$change_id" --strict
fi
```

说明：
- `--strict` 会把 `WS:TODO`/缺少归因视为错误，并启用计划质量门（章节完整、步骤粒度、验证命令与预期）
- 紧急情况下可用 `--allow-truth-drift`（不推荐）

## 完成判定

- `aiws change validate <id> --strict` 无错误（exit 0）：工件完整、归因齐全、无 WS:TODO。
