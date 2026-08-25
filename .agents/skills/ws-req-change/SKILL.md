---
name: ws-req-change
description: 使用时机：需要修改需求文档、验收标准时。触发词：需求变更、验收、修改需求、REQUIREMENTS。注意：需求评审未通过请先走 ws-req-review。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：记录需求变更（更新 `REQUIREMENTS.md` + 追加 `requirements/CHANGELOG.md`），并同步/校验执行合同 `requirements/requirements-issues.jsonl`。

步骤（必须按顺序）：
1) 读取：`AI_PROJECT.md`、`REQUIREMENTS.md`、`AI_WORKSPACE.md`、`requirements/CHANGELOG.md`（缺失则创建目录与文件）。
2) 先产出“拟变更方案”（不要立刻写文件）：
   - 变更摘要（1–5 条）
   - 影响范围（API/鉴权/字段/状态码/测试边界）
   - 回滚思路（1–2 条）
3) 对比与冲突检查（强制，不写文件）：
   - 对比“变更前 vs 拟变更后”的差异清单（新增/删除/语义变化）
   - 整理潜在冲突/不确定点（只列“最可能影响验收/实现”的，避免噪音）
4) 逐条澄清（强制，避免一次问完）：
   - 若存在潜在冲突/不确定点：**本轮只问 1 个**最高优先级问题（给出 2–4 个可选答案或二选一），然后停止，等待用户回复；不要继续问下一题，也不要写文件。
   - 收到用户回复后：更新“拟变更方案”，回到步骤 3) 重新对比，直至没有未决问题。
5) 强制停下来让用户确认：是否继续落盘？(Y/N)
6) 用户确认 Y 后再写入：
   - 更新 `REQUIREMENTS.md`（只保留当前有效版本，不在此堆历史）
   - 追加 `requirements/CHANGELOG.md`
7) 同步/补齐需求执行合同（强制，自动处理 FlowSpec 有/无两种情况）：
   - `python3 tools/requirements_contract_sync.py --workspace .`
   - 说明：若 `REQUIREMENTS.md` 中不存在 FlowSpec（或 flows 为空），该命令只会确保 `requirements/requirements-issues.jsonl` 存在并给出 WARN（这是预期行为，不要当成失败）。
8) 校验需求执行合同（强制）：`python3 tools/requirements_contract.py validate`
9) 同步场景合同（可选，但若存在 FlowSpec 则强烈建议自动执行）：
   - 若 `REQUIREMENTS.md` 同时包含 `<!-- FLOW_SPEC_BEGIN -->` 与 `<!-- FLOW_SPEC_END -->`：运行 `$ws-req-flow-sync`
   - 否则：跳过，并提示用户“可以先不维护 FlowSpec；后续需要场景回归时再补”

输出必须包含：
- 本次更新的文件清单（路径）
- 回滚方案（如何撤销本次需求变更）
- 下一步建议命令

安全：
- 不打印 `secrets/test-accounts.json`
- 不引入任何 token/密钥到仓库

## 完成判定

- `REQUIREMENTS.md` 已更新且 `requirements/CHANGELOG.md` 已追加；执行合同 `requirements-issues.jsonl` 已同步/校验通过。
