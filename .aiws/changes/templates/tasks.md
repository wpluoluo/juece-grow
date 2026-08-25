> **Data source**: `.aiws/changes/{{CHANGE_ID}}/tasks/tasks.jsonl` — machine-readable task list with dependencies and verification criteria.

# Tasks: {{CHANGE_ID}}

> Title: {{TITLE}}
>
> Created: {{CREATED_AT}}

## 0. Preflight

- [ ] 0.1 阅读并遵守 `AI_PROJECT.md` / `AI_WORKSPACE.md` / `REQUIREMENTS.md`
- [ ] 0.2 运行门禁校验：`aiws validate .`（或 `npx -y @aipper/aiws validate .`）
- [ ] 0.3 若真值文件发生变化（例如你更新了 REQUIREMENTS.md），同步基线：`aiws change sync {{CHANGE_ID}}`
- [ ] 0.4 在 `.aiws/changes/{{CHANGE_ID}}/proposal.md` 填写主索引绑定：`Change_ID` / (`Req_ID` or `Problem_ID`) / `Contract_Row` / `Plan_File` / `Evidence_Path`
- [ ] 0.5 生成 `.aiws/plan/...` 后，确认计划文件中的绑定字段与 proposal 一致
- [ ] 0.6 执行计划质检：在 AI 工具运行 `aiws plan-verify`（或按同等清单手工检查“章节/步骤粒度/验证命令与预期”）
- [ ] 0.7 严格校验：`aiws change validate {{CHANGE_ID}} --strict`

## 1. 需求/问题合同（如适用）

- [ ] 1.1 需求交付：补齐/更新 `REQUIREMENTS.md` 验收条款（或确认不需要）
- [ ] 1.2 同步 `.aiws/requirements/requirements-issues.csv`（或更新 `.aiws/issues/problem-issues.csv`）
- [ ] 1.3 记录到 `.aiws/requirements/CHANGELOG.md`（如需求发生变化）

## 2. 实现

- [ ] 2.1 <!-- WS:TODO -->
- [ ] 2.2 <!-- WS:TODO -->

## 2A. 协同（可选）

- [ ] 2A.1 若使用委托分析：把结果落盘到 `.aiws/changes/{{CHANGE_ID}}/analysis/`
- [ ] 2A.2 若使用 patch 草案：把结果落盘到 `.aiws/changes/{{CHANGE_ID}}/patches/`，并记录是否采用
- [ ] 2A.3 若存在多审查者：把审查结果落盘到 `.aiws/changes/{{CHANGE_ID}}/review/`

## 3. 验证（必须可复现）

- [ ] 3.1 <!-- WS:TODO 写具体命令（来自 AI_WORKSPACE.md） -->
- [ ] 3.2 <!-- WS:TODO 写期望结果（可判断 DONE/FAIL） -->

## 4. 交付与归档

- [ ] 4.1 证据落盘到 `.aiws/tmp/...`（报告/日志/请求响应等）
- [ ] 4.2 生成持久证据：`aiws change evidence {{CHANGE_ID}}`
- [ ] 4.3 交叉审计（可选但推荐）：在 AI 工具内运行 `/ws-review`（或按 `AI_PROJECT.md` 手工审计）
- [ ] 4.4 收尾：`aiws change finish {{CHANGE_ID}} --push`（成功后自动归档并生成 handoff）
