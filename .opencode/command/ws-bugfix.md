---
description: 缺陷修复：禅道 MCP 拉单 + goal 式工作流（分析→修复→测试→验证→review→resolve→commit→push→finish）
---
<!-- AIWS_MANAGED_BEGIN:opencode:ws-bugfix -->
# ws bugfix

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：从禅道拉取一个激活 bug，走 goal 式完整工作流（拉取→分析→解决→测试→验证→review→resolve→commit→push→finish）直至修复并归档。

建议流程：
1) 先运行 `/ws-preflight`（读真值文件并输出约束摘要）。
2) 调用 Zentao MCP `get_my_bugs` 拉取激活 bug 列表；可指定 bug 编号，否则取第一个激活 bug。
3) 用 `get_bug_detail` 拉取 bug JSON（唯一真值源）落盘到 `.aiws/changes/bugfix-<bug-id>/bug/zentao-bug-<bug-id>.json`，附件图片落盘到 `bug/images/<bug-id>/`。
4) `aiws bugfix start <bug-id>` 创建 change/bugfix-<bug-id> 分支与 bugfix-state.json（10 phase FSM），此后每阶段用 `aiws bugfix advance <change-id>` 推进（Phase Boundary Authority，禁止手改 state.json）。
5) 按 FSM 阶段执行：INTAKE → ANALYZE（diagnosing-bugs 根因，有疑问走 grill-with-docs）→ FIX（ws-dev 最小改动）→ TEST（test-gate）→ VERIFY（expect/actual 对照）→ REVIEW（ws-review；通过后 resolve_bug 带 solutionModules + git push）→ COMMIT → PUSH → FINISH（aiws change finish --push）→ DONE。

E2E/视觉/并发短指针：E2E 编写遵循 `e2e-playwright` 与 `ws-bugfix/PHASES.md`，先查 `e2e/common`，复用 auth/wait/vxe，使用 `waitForPageReady`，并通过 naked `waitForTimeout` 门禁。视觉证据先落盘；独立 tmux Pi worker 只接收路径，显式使用 `aipper/qwen3` 或 `aipper/gpt-5.5`，主 session 只回收 summary/结构化结果/`done.signal`。只读分析可并行；代码/测试/共享文件写入必须串行或隔离写集。
6) 禅道回填 `resolve_bug` 在 REVIEW 通过后、FINISH 前调用；solutionModules 四字段（rootCause/fixApproach/logicChange/impact），impact 不得写"无"；resolvedBuild 默认 `ZENTAO_DEFAULT_RESOLVED_BUILD` 回退 trunk。
7) 批量场景：运行 `/ws-bugfix-batch` 串行循环（finish 后自动拉下一个激活 bug 直到无剩余）。

输出要求：
- `Bug ID:` 修复的禅道 bug 编号
- `变更文件（Changed）:` 文件清单
- `验证（Verify）:` 实际运行的命令 + 期望结果
- `证据（Evidence）:` 证据路径（bug/zentao-bug-<id>.json、bug/test-reports/、review/...）
<!-- AIWS_MANAGED_END:opencode:ws-bugfix -->

可在下方追加本项目对 OpenCode 的额外说明（托管块外内容会被保留）。
