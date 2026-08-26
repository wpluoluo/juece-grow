# Spec-Review · lead-followup-reminders（规范 / 流程 / 真值归因审查）

> 分支：`change/lead-followup-reminders`
> 提交对比：`08ec0b6`（phase1 归档）→ `2a607db`（HEAD，含 77e81b4 计划工件 + 2a607db 实现）
> 审查日期：2026-08-26
> 审查类型：spec 轴（流程 / 规范 / 真值归因）
> 审查范围：两提交累计改动（26 文件，+1262/-3），含新增集合、调度、接口、看板、真值工件

---

## 0. Triage 结论

**High blocker = 0 条。**
**Warning（需 finish 前收敛）= 3 条。**
**Info（优化建议）= 3 条。**

整体结论：本次 change 归因完整（REQ-0002 绑定正确、`Spec_Status=READY`）、GATE-002 已 ACCEPTED、红线（node-cron 自宿主、数据仍存自有 Postgres、自研文件 ≤1000 行、无兜底/双写/兼容写法）全部通过，API 统一信封与权限校验正确，真值同步（REQUIREMENTS / requirements-issues.jsonl / CHANGELOG）已落地。**不阻断分支合并。** 存在 3 处告警均属「口径/流程完备性」层面：REQ-0002 验收条款字段名词与实现用名不一致（`type` vs `kind`）、proposal In Scope 未完整覆盖实改工件、合同文件名口径 `csv` vs `jsonl`（phase1 遗留的同类问题，本轮未修正）。建议在 `aiws change finish` 前收敛（见 §3 最小修复清单）。交付路径：`f:\juece-grow\.aiws\changes\lead-followup-reminders\review\spec-review.md`。

---

## 1. 逐项检查结果

| # | 检查项（Spec 轴） | 结果 | 说明 |
|---|---|---|---|
| 1.1 | 归因完整性：REQ-0002 绑定 + Spec_Status | **通过** | REQ-0002 存在于 `requirements-issues.jsonl`，`Spec_Status=READY`、Scenario/Inputs/Outputs/DatModel/Business_Logic/NonFunctional 齐全（内容与实现一致：due/sla 判据、open 判重、receiver=target??owner）。`proposal.md` 主索引绑定 `Change_ID/Req_ID=REQ-0002/Problem_ID=空/Contract_Row=REQ-0002/Plan_File/Evidence_Path` 互相一致。 |
| 1.2 | Plan_File 绑定一致性 | **通过** | `Plan_File=.aiws/plan/2026-08-26-lead-followup-reminders.md` 存在，其 Bindings 六字段与 proposal 完全一致。tasks.md 的 Change_ID 一致。 |
| 2.1 | SCOPE：实改 vs 声明 | **告警** | proposal In Scope 覆盖了全部**代码文件**（两集合、reminderCron、route、LeadActivities、custom.scss、Dashboard、payload.config、payload-types、package.json、lock）。但**未完整覆盖实改的工件/文档**：`docs/gates/GATE-002-follow-up-reminders.md`、`.aiws/plan/...`、`.aiws/memory-bank/**`（4 处）、`.aiws/requirements/requirements-issues.jsonl`、`.aiws/requirements/CHANGELOG.md`、`.aiws/changes/.../metrics.json`、`.ws-change.json` 未逐项列入 In Scope（proposal 仅笼统列为 `REQUIREMENTS.md / .aiws/changes/lead-followup-reminders/**`）。 |
| 2.2 | SCOPE：工具校验覆盖 | **通过**（残留警告） | `metrics.json` 显示历次 `aiws change validate --strict` 均以 `check_scope: false` 运行，且 12:18:47 起 `ok=true`（errors=0）。`--strict` 通过但 `check_scope=false`，工具未对越界文件告警 —— 属工具配置层面，非本 change 缺陷。 |
| 3.1 | 名称：camelCase 三层映射 | **通过** | API 字段 `created`、关系 `lead/project/rule/target/receiver/owner`、业务字段 `applyStatuses/graceHours/nextFollowUpAt/dueAt/enabled/status/kind` 均 camelCase；Postgres slug（`reminder-rules`/`reminder-notices`/`lead-activities` 与 Lead/ReminderRules 集合 slug 一致）；未发现 snake_case 泄漏到业务层。 |
| 3.2 | 名称：双语 label | **通过** | 两新集合 labels、字段 label、options、admin description、collection description 全部 `{zh, en}` 双语；`LeadActivities.type=reminder` 选项亦双语。 |
| 4.1 | 红线：是否引入外部 CMS / 新服务 | **通过** | 唯一新增运行时依赖 `node-cron@^4.6.0`（devDeps `@types/node-cron`）。无 Strapi/Directus/Halo、无外部推送服务、无 Chatwoot 客户端引入。 |
| 4.2 | 红线：node-cron 自宿主合规（AGENTS §3/§7） | **通过** | node-cron 为纯本地进程内调度器，不依赖外部服务/网络，自包含、自宿主；数据读写仍走自有 Postgres（postgresAdapter，`DATABASE_URI`）。调度由 `payload.config.ts onInit` 启动，进程内常驻，无外泄。符合「外部 CMS 禁止 / 数据自持」红线。 |
| 4.3 | 红线：构建期不启动 / HMR 防重 | **通过** | `reminderCron.startReminderCron`：先 `NEXT_PHASE==='phase-production-build'` 早退，再 `globalThis.__reminderCronStarted` 哨兵防 dev HMR 重复注册。与 GATE-002 §5、REQ-0002 验收「构建期不启动」一致。证据 3 节实测 build 无定时器日志。 |
| 4.4 | 红线：自研文件 ≤1000 行 | **通过** | ReminderRules 101、ReminderNotices 94、reminderCron 167、route 24、LeadActivities 86、Dashboard 455（+16 相对改动）、payload.config 240。全部远低于 1000 行。 |
| 4.5 | 红线：无兜底/双写/兼容写法 | **通过** | `runReminderScan` 仅一条正确路径；判重只查 `reminder-notices(status=open)`；接口与 cron 共用同一 `runReminderScan` 单一实现（无双写）；未发现 snake_case 双书、兼容旧逻辑。 |
| 5.1 | API：/api/v2 统一信封 | **通过** | `POST /api/v2/reminders/run` 走 `envelope.ts` 的 `ok()`/`err()`：成功 `{success:true,data:{created}}`；失败 `{success:false,error:{code,message}}`。 |
| 5.2 | API：异常不透 DB 栈 | **通过** | route 用 `try/catch` 包裹 `getPayload`+`runReminderScan`，catch 统一返回 `err('REMINDER_SCAN_FAILED', ..., 500)`，不透出内部堆栈或 DB 异常 —— 满足 AGENTS §6（比 phase1 的 `leads/route.ts` 在该项上更规范）。 |
| 5.3 | API：权限校验 | **通过** | `req.headers` 经 `payload.auth` 解析用户 → `isGlobalAdmin(user)` 校验；非管理员统一返回 `err('FORBIDDEN',...,403)`。证据 4 节实测未登录调用返回 `{"success":false,"error":{"code":"FORBIDDEN"}}`，HTTP 403。 |
| 5.4 | API：判重/语义边界 | **通过** | `alreadyOpen` 用 `lead+rule+kind+status=open` 断言，未处理不重复提醒；提醒不改线索自身状态（`runReminderScan` 只写 notices+activities，不改 Leads）。 |
| 6.1 | 真值同步：REQUIREMENTS.md | **通过** | 已新增 REQ-0002 Backlog 条目（背景/目标/非目标/验收 7 条）。`.ws-change.json` 的 `truth_sync` 事件记录了 `REQUIREMENTS.md` 基线同步（sha 68d230…）。 |
| 6.2 | 真值同步：requirements-issues.jsonl | **通过** | REQ-0002 已追加至 `.aiws/requirements/requirements-issues.jsonl`（Spec_Status=READY）。 |
| 6.3 | 真值同步：CHANGELOG | **通过** | `.aiws/requirements/CHANGELOG.md` 已追加 2026-08-26 记录，关联 change/lead-followup-reminders。 |
| 6.4 | 真值同步：memory-bank | **通过** | 已新增 `.aiws/memory-bank/change/2026-08-26-lead-followup-reminders.md` 与 decision 记录，符合 Memory Protocol。 |

---

## 2. Top findings

每条标注 [Warning/Info] + SPEC 归属。

1. **[Warning] SPEC-6（真值口径不一致）**：`REQUIREMENTS.md` REQ-0002 验收条款写「reminder-rules 集合含 **type**(due/sla)」，而实现代码与 `requirements-issues.jsonl`（Data_Model/Business_Logic）均用 **`kind`** 作为字段名。真值文件内部字段名词不一致会削弱验收对照。验收标准实际满足（`kind` 即 type 语义），属命名口径漂移，`kind` 与代码/合同一致，建议以 `kind` 为准修订 REQUIREMENTS.md 措辞，避免误读。
2. **[Warning] SPEC-2（作用域声明未全覆盖）**：proposal In Scope 使用 `apps/cms/src/collections/reminder-rules.ts`/`reminder-notices.ts` 等小写 slug 写法列出代码文件（这些路径实为集合 slug，与实际文件名 `ReminderRules.ts`/`ReminderNotices.ts` 不全一致），且未逐项列出实改的 `GATE-002`、`.aiws/plan/...`、`.aiws/memory-bank/**`、`requirements-issues.jsonl`、`CHANGELOG.md`、`metrics.json`、`.ws-change.json`。若开启 `check_scope` 会报越界。
3. **[Warning] SPEC-1（合同文件口径）**：`proposal.md`「真值文件/合同更新清单」与 `tasks.md` 1.2 均引用 `requirements-issues.csv`，实际真值文件为 `requirements-issues.jsonl`。为 phase1 已指出过、本轮未修正的文档口径漂移（工具认 jsonl 且通过，故为文案级）。
4. **[Info] SPEC-5（scope 路径命名）**：proposal In Scope 用集合 slug（`reminder-rules.ts`）表示文件，与磁盘实际文件名（`ReminderRules.ts`、`ReminderNotices.ts`）不一致，列出真实相对路径更利于 scope 核对与 `check_scope` 启用。
5. **[Info] SPEC-4（安全-数据校验）**：`row` 的 `/api/v2/reminders/run` 未对请求体做任何校验（无需 body，POST 空触发即可，语义合理）。`runReminderScan` 遍历规则时对 `graceHours` 有 `Number(raw.graceHours) || 24` 默认兜底（缓解型、可接受，非双写）。提醒接口为管理员内部接口，无公开面，风险低。
6. **[Info] SPEC-3（证据时序）**：`verify-before-complete.md` 已落盘且覆盖判重/权限/构建实测，符合 Evidence_Path；但手测步骤（dev+curl）未留有独立日志快照于 `.aiws/tmp/`，仅记录于 markdown，若需复核可补存档。非阻断。

---

## 3. 下一步最小修复清单（不阻塞合并，建议 finish 前收敛）

1. **（真值一致性，建议改）** 修订 `REQUIREMENTS.md` REQ-0002 验收第 1 条措辞，将 `type(due/sla)` 统一为 `kind(due/sla)`（与代码、requirements-issues.jsonl 一致）。改动前仅文案层，建议与工具校验并行执行。
2. **（作用域完备性）** `proposal.md` In Scope 补列实改工件：`docs/gates/GATE-002-follow-up-reminders.md`、`.aiws/plan/2026-08-26-lead-followup-reminders.md`、`.aiws/memory-bank/**`、`.aiws/requirements/requirements-issues.jsonl`、`.aiws/requirements/CHANGELOG.md`、`⚠️ 与 .ws-change.json/metrics.json`。同时将代码文件路径由集合 slug 改为磁盘真实路径（`ReminderRules.ts`/`ReminderNotices.ts`）。
3. **（文案口径）** 将 `proposal.md`、`tasks.md`、AI_PROJECT 中的 `.csv` 引用统一改为 `.jsonl`（与 phase1 遗留项一并收敛）。
4. **（可选）** 若后续需要严格越界校验，将 `aiws change validate` 的 `check_scope` 改为 `true` 重跑一次，确认 scope 声明与实改一致。

> 本次审查**未改动任何业务代码**，仅评估与落盘。