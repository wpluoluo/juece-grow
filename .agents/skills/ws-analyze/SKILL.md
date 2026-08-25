---
name: ws-analyze
description: 使用时机：需要分析问题、定位根因、收集上下文时。触发词：分析、定位、调查、诊断。注意：直接改代码请用 ws-dev。
---

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在开始实现/修复前做一次技术分析，产出可执行的最小行动清单，并把证据落盘到 `.aiws/tmp/analyze/`。

输入：
- 主题/需求：用户在本次消息中提供的主题（若不明确，先问一句“本次分析主题是什么？”）

步骤（建议）：
1) 先做 preflight：定位项目根目录，读取 `AI_PROJECT.md` / `REQUIREMENTS.md` / `AI_WORKSPACE.md`，输出约束摘要（上下文扫描）。
2) 基于真值文件与当前代码现状，输出目标 / 非目标、现状证据（文件路径/接口路径）与最小行动清单；现状证据收集、根因定位（复现→假设→二分）、外部事实查证等执行细节按下方「方法论」引用 `$diagnosing-bugs` / `$research` 执行。
3) 将分析落盘到：`.aiws/tmp/analyze/codex-analysis.md`（目录不存在则创建）。
4) 运行 `aiws memory write decision://analysis/<topic>` 写入分析结论（根因、推荐方案、影响评估）。
5) 回复中必须包含：`Evidence:` 证据文件路径。

安全：
- 不打印 secrets（尤其 `secrets/test-accounts.json`）。
- 不执行破坏性命令。

## 方法论（引用 mattpocock `$diagnosing-bugs` + `$research`）

> 诊断/调查执行细节引用 `$diagnosing-bugs` / `$research`（mattpocock），不复制正文，只写触发指引：

- 硬 bug / 性能问题诊断：按 `$diagnosing-bugs`（`.agents/skills/diagnosing-bugs/SKILL.md`，pi 镜像 `.pi/skills/diagnosing-bugs/SKILL.md`）执行——诊断循环：复现→假设→二分，用于步骤 2 的现状证据收集与根因定位。
- 需要查证外部事实：按 `$research`（`.agents/skills/research/SKILL.md`，pi 镜像 `.pi/skills/research/SKILL.md`）执行——高信任源调查并落盘 md。
- 注入点（AIWS 约束叠加）：方法论只负责"怎么做分析"，AIWS 治理始终优先——证据仍落盘 `.aiws/tmp/analyze/`、memory 仍写 `decision://analysis/<topic>`、安全约束（不打印 secrets / 不执行破坏性命令）不放宽、完成判定（落盘 + Evidence + memory）不降低。

## 完成判定

- 分析文档已落盘 `.aiws/tmp/analyze/codex-analysis.md`，回复含 `Evidence:` 路径，且 memory 已写入 `decision://analysis/<topic>`。
