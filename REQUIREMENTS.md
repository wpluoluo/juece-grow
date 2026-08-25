# REQUIREMENTS.md

<!-- AIWS_MANAGED_BEGIN:requirements:contract -->
本文件是工作区需求的唯一真值来源。AI 在制定计划与执行测试时必须以此为准。

约束：
- 不写入任何 secrets（token、账号、内网端点等）
- `aiws update` 只维护本托管块；其余内容由项目自由编辑

相关合同：
- `requirements/requirements-issues.csv`：需求拆解执行合同（校验：`python3 tools/requirements_contract.py validate`）
<!-- AIWS_MANAGED_END:requirements:contract -->

本文件是当前项目的需求与验收标准唯一真值来源。请按以下约定维护：

## 如何编写需求

每条需求使用唯一 `Req_ID`（形如 `PROJ-001`），包含：

- **背景 / 问题**：为什么需要
- **目标**：要达成什么（可验证）
- **非目标**：明确不做哪些（防范围蔓延）
- **验收标准**：可机器或人工验证的条目

已完成的需求保留在历史区并标记 `✓`；新增需求追加到 Backlog 区。

## Backlog

<!-- 在此追加新需求条目。示例：

### PROJ-001：示例需求

**背景 / 问题**
- ...

**目标**
- ...

**非目标**
- ...

**验收标准**
- [ ] ...
-->

## 已完成

<!-- 已完成需求归档区。示例：

### ✓ PROJ-000：首个需求

- 状态：已完成
- 验收：全部通过

-->
