> **Data source**: `.aiws/changes/lead-followup-reminders/tasks/tasks.jsonl` — machine-readable task list with dependencies and verification criteria.

# Tasks: lead-followup-reminders

> Title: 线索跟进自动化：到期提醒+首次跟进SLA（核心，后台内提醒）
>
> Created: 2026-08-26T12:14:46Z

## 0. Preflight

- [ ] 0.1 阅读并遵守 `AI_PROJECT.md` / `AI_WORKSPACE.md` / `REQUIREMENTS.md`
- [ ] 0.2 运行门禁校验：`aiws validate .`（或 `npx -y @aipper/aiws validate .`）
- [ ] 0.3 若真值文件发生变化（例如你更新了 REQUIREMENTS.md），同步基线：`aiws change sync lead-followup-reminders`
- [ ] 0.4 在 `.aiws/changes/lead-followup-reminders/proposal.md` 填写主索引绑定：`Change_ID` / (`Req_ID` or `Problem_ID`) / `Contract_Row` / `Plan_File` / `Evidence_Path`
- [ ] 0.5 生成 `.aiws/plan/...` 后，确认计划文件中的绑定字段与 proposal 一致
- [ ] 0.6 执行计划质检：在 AI 工具运行 `aiws plan-verify`（或按同等清单手工检查“章节/步骤粒度/验证命令与预期”）
- [ ] 0.7 严格校验：`aiws change validate lead-followup-reminders --strict`

## 1. 需求/问题合同（如适用）

- [ ] 1.1 需求交付：补齐/更新 `REQUIREMENTS.md` 验收条款（或确认不需要）
- [ ] 1.2 同步 `.aiws/requirements/requirements-issues.csv`（或更新 `.aiws/issues/problem-issues.csv`）
- [ ] 1.3 记录到 `.aiws/requirements/CHANGELOG.md`（如需求发生变化）

## 2. 实现

- [ ] 2.1 新增 `apps/cms/src/collections/ReminderRules.ts`（name/project/kind(due|sla)/applyStatuses/graceHours/target/enabled，双语 label）
- [ ] 2.2 新增 `apps/cms/src/collections/ReminderNotices.ts`（lead/project/rule/kind/receiver/dueAt/status(open|done)，双语 label，read=projectScopedRead）
- [ ] 2.3 `LeadActivities.type` 新增 `reminder` 选项（双语 label）
- [ ] 2.4 `payload.config.ts` 注册两集合 + `onInit` 启动 `startReminderCron`
- [ ] 2.5 `pnpm --filter cms add node-cron`（无需外部服务的自宿主依赖，对照红线 OK）
- [ ] 2.6 新增 `apps/cms/src/lib/reminderCron.ts`：构建期早退 + globalThis 哨兵 + `runReminderScan`（due/sla 命中 → 判重 → 写 notice + activity）
- [ ] 2.7 新增 `apps/cms/src/app/api/v2/reminders/run/route.ts`（管理员手动触发，统一信封）
- [ ] 2.8 Dashboard 看板新增"待跟进"提醒点（open notices 数量/摘要）；custom.scss 补样式
- [ ] 2.9 `pnpm --filter cms payload generate:types` 重新生成 `payload-types.ts`

## 2A. 协同（可选）

- [ ] 2A.1 若使用委托分析：把结果落盘到 `.aiws/changes/lead-followup-reminders/analysis/`
- [ ] 2A.2 若使用 patch 草案：把结果落盘到 `.aiws/changes/lead-followup-reminders/patches/`，并记录是否采用
- [ ] 2A.3 若存在多审查者：把审查结果落盘到 `.aiws/changes/lead-followup-reminders/review/`

## 3. 验证（必须可复现）

- [ ] 3.1 `pnpm --filter cms build`：生产构建 TS 通过，构建期不启动定时器
- [ ] 3.2 手动扫描验证：起 db + cms dev，后台建 due/sla 规则，造 status=new、nextFollowUpAt 已过线索，`curl -X POST :3000/api/v2/reminders/run` 返回 `{success:true, data:{created>0}}`；重复调用 created 不增长；`reminder-notices` 与 `LeadActivities(reminder)` 可见
- [ ] 3.3 `aiws change validate lead-followup-reminders --strict` 通过

## 4. 交付与归档

- [ ] 4.1 证据落盘到 `.aiws/tmp/...`（报告/日志/请求响应等）
- [ ] 4.2 生成持久证据：`aiws change evidence lead-followup-reminders`
- [ ] 4.3 交叉审计（可选但推荐）：在 AI 工具内运行 `/ws-review`（或按 `AI_PROJECT.md` 手工审计）
- [ ] 4.4 收尾：`aiws change finish lead-followup-reminders --push`（成功后自动归档并生成 handoff）
