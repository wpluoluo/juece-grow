---
name: ws-req-review
description: 使用时机：需要评审需求、验收条件、合同时。触发词：需求评审、验收评审、合同评审。注意：需求已确认直接进 ws-plan。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在不修改任何文件的前提下，对 `REQUIREMENTS.md` 做一次整体 QA，输出缺口/冲突/风险，减少实现漂移。

执行步骤（强制）：
1) 定位项目根目录：先尝试 `git rev-parse --show-superproject-working-tree`（submodule 感知上溯）；若为空再用 `git rev-parse --show-toplevel`。都失败则停止并让用户确认根目录。
2) 读取（存在则必须读取；缺失则明确列出，不要臆测）：
   - `AI_PROJECT.md`
   - `REQUIREMENTS.md`
   - `AI_WORKSPACE.md`
   - `requirements/CHANGELOG.md`（若存在）
   - `requirements/requirements-issues.csv`（若存在）
3) 输出固定结构的报告：

## Requirements QA
- 结论：是否可进入实现（是/否/有条件）
- 漂移风险：最容易导致不一致的点
- 可验收性缺口：缺少输入/输出/错误码/边界/示例的条目
- 完整性：Non-goals/兼容性/鉴权/重试/并发/观测性/性能
- 一致性：与 `AI_PROJECT.md` 约束冲突点
- 可测试性与证据：最小验证命令 + 期望结果 + 证据路径
- 风险清单：3–8 条
- 需要澄清的问题：5–12 个（按优先级）

4) 最后询问用户：是否进入需求落盘流程 `$ws-req-change`？(Y/N)

安全：不打印 `secrets/test-accounts.json`。

## 完成判定

- 已输出完整 Requirements QA 报告（结论明确：是/否/有条件），并已询问用户是否进入 `$ws-req-change`。
