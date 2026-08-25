---
name: ws-req-contract-validate
description: 使用时机：需要校验需求合同完整性时。触发词：合同校验、contract validate、需求核对。注意：合同未同步请先 ws-req-contract-sync。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

执行（失败则修正 JSONL 后重试）：
- `python3 tools/requirements_contract.py validate`

输出要求：
- 若失败：列出前 20 条缺失字段（Req_ID + field），并给出最小补齐建议

## 完成判定

- `requirements_contract.py validate` 通过（exit 0）：无缺失字段；若失败则已修正 JSONL 后重试至通过。
