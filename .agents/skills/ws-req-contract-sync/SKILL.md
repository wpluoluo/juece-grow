---
name: ws-req-contract-sync
description: 使用时机：需要同步需求执行合同到代码时。触发词：合同同步、contract、req sync。注意：合同内容变更请先 ws-req-change。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

用途：从 `REQUIREMENTS.md` 的 FlowSpec 补齐 `requirements/requirements-issues.jsonl`（只生成骨架，不猜测完成状态）。

执行（在 workspace 根目录）：
- `python3 tools/requirements_contract_sync.py --workspace .`

输出要求：
- 说明新增/更新了多少条
- 明确下一步：手工补齐 CRUD/Inputs/Outputs/Business_Logic/Tests，并将可开工条目标为 `Spec_Status=READY`

下一步建议：`$ws-req-contract-validate`

## 完成判定

- `requirements_contract_sync.py --workspace .` 执行成功（exit 0），输出新增/更新条数，并给出下一步建议。
