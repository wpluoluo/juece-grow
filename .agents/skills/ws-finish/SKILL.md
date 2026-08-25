---
name: ws-finish
description: 使用时机：完成 change 并合并回目标分支时。触发词：完成、finish、合并、merge、归档。注意：finish 前必须通过 review gate。
---

# ws-finish

`aiws finish` 的收尾入口。

关键契约：
- 若 `aiws change status <change-id>` 输出 `governance_rule: finish_resume_required`，继续执行 `aiws change finish <change-id> --push`
- 普通 finish 的 `validate/evidence/state` 仍应在 `change/<change-id>` 分支完成（当前机制不创建独立 worktree，见 ADR-0002）

## MEM_SYNC Gate（finish 前必过）

在 `aiws change finish` 执行前，**必须**将本次变更的知识持久化到 memory-bank：

1. **写入决策记录**：
   - 从 change 工件提取变更摘要（change-id、Req_ID/Problem_ID、改动文件、原因）
   - 运行 `aiws memory write decision://<change-id>` 写入结构化决策记录，包含变更内容、改动范围、影响评估
2. **刷新真值衍生记忆**：
   - 运行 `aiws memory seed --force` 从更新后的真值文件（REQUIREMENTS.md、AI_PROJECT.md 等）重新生成记忆
3. **重建索引**：
   - 运行 `aiws memory rebuild-index` 确保索引最新
4. 输出 `MEM_SYNC:` 状态：
   - `SYNCED` — memory 已更新
   - `BLOCKED` — 写入失败，阻断 finish

`aiws change finish --push` 的执行参考 `_shared/run-aiws.md`。

## 完成判定

- MEM_SYNC Gate 输出 `SYNCED`，且 `aiws change finish <id> --push` 成功（exit 0）：change 已合并回目标分支。
