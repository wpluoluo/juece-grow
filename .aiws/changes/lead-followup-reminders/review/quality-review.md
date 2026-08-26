# Quality Review · lead-followup-reminders

- 审查类型：行为 / 回归 / 测试覆盖 / 代码质量（Quality 轴）
- 分支：`change/lead-followup-reminders`（工作树干净，已提交 `2a607db`）
- 工作目录：`f:\juece-grow`
- 审查日期：2026-08-26
- Req_ID：REQ-0002 线索跟进提醒自动化 · 门禁：GATE-002（ACCEPTED）
- 评审对象：`apps/cms/src/collections/ReminderRules.ts`、`ReminderNotices.ts`、`LeadActivities.ts`、`lib/reminderCron.ts`、`app/api/v2/reminders/run/route.ts`、`payload.config.ts`、`components/Dashboard.tsx`、`(payload)/custom.scss`、生成物 `payload-types.ts`
- 范围：仅评估落盘，不改业务代码

---

## 1. Triage

**结论：无 HIGH Critical blocker，本 change 正确性主干（runReminderScan 判定/判重/receiver/dueAt/不改状态）、调度护栏（NEXT_PHASE 早退 + globalThis 哨兵）、接口权限（isGlobalAdmin 包裹正确）、代码硬约束（≤1000 行、无双写、Where 类型）均达标；但有 2 个权限口径松动项与 1 个测试覆盖缺口建议收敛。**

| 严重度 | 数量 | 说明 |
|--------|------|------|
| Critical | 0 | — |
| Warning | 3 | 见 #1（提醒标记已办仅限全局管理员）、#2（项目写权限可配置全局规则=跨项目提权）、#3（核心新逻辑无自动化测试，仅靠手动验证） |
| Info | 7 | 见 #4–#10 |

综合净评：实现与验证天然对得齐（verify-before-complete.md 覆盖面与本次代码一致，关键路径实测通过），构建/TS 通过，判重实测第 2 次 created=0。核心缺口集中在**权限口径**（“看得到但一个人标记不了 / 项目编辑能配跨项目全局规则”）与**测试形态**（手动验证充分、自动化为零）两条边角，均为 Quality 轴而非 Spec 违约。

---

## 2. 逐项结果

### 2.1 正确性 —— `lib/reminderCron.ts` `runReminderScan`
- due 判定：`status {in: applyStatuses} + nextFollowUpAt {less_than: now}`，命中规则配置阶段 + 过期跟进时间。✅
- sla 判定：`status {equals: 'new'} + createdAt {less_than: now - graceHours}`，未首响即命中。✅
- open 判重：`alreadyOpen(lead+rule+kind, status=open)` 存在即 `continue`，同一 lead+rule+kind 未处理不重复，风暴抑制。✅
- receiver：`relId(raw.target) ?? relId(leadRaw.owner)`，target 优先、owner 兜底、两者空 → null，符合设计。✅
- dueAt：due 用 `nextFollowUpAt`；sla 用 `createdAt + graceHours`。✅
- 不改线索状态：仅 create notices + activities，无任何 leads update。✅
- 返回结构：`Promise<{ created: number }>`，route 直返 `ok(result)`，符合 REQ `/api/v2/reminders/run{success,data:{created}}`。✅

### 2.2 边界 / 回归
- 空规则：`docs` 空 → 循环不执行 → `{created:0}`。✅
- kind 非法：三目守卫 `raw.kind===...? ... : undefined`，`undefined` → `continue`。✅
- applyStatuses 空：`?.length ? ... : ['new']`，空时回退默认（见 #7，判定去重双算）。
- graceHours 缺省：`Number(raw.graceHours) || 24`，sla 无阈值也能工作。✅
- relationship id 规整：`relId` 兼容对象与裸 id，`Number()` 归一。✅

### 2.3 调度安全
- 构建期：`NEXT_PHASE==='phase-production-build'` 在注册调度前早退，构建不启动定时器（verify 实测无扫描日志）。✅
- dev HMR：`globalThis.__reminderCronStarted` 哨兵置位后再 `schedule`，重复模块加载不再注册。✅（多实例/PM2 cluster 仍各进程各注册一次，见 #9，设计已声明不做分布式锁。）
- cron 错误：`runReminderScan().catch(console.error)`，扫描异常被捕获不炸进程；`console.info` 仅 created>0 时打日志。✅

### 2.4 权限 —— `run` 接口与集合 access
- `/api/v2/reminders/run`：`payload.auth` 取 user → `isGlobalAdmin(user)`，否则 `err('FORBIDDEN',...,403)`；外层 try/catch → DB/内部异常转 `REMINDER_SCAN_FAILED` 统一信封，不泄堆栈。✅
- ReminderRules：read=projectScopedRead；create/update=projectWrite；delete=`({req})=>isGlobalAdmin(req.user)`（正确包裹）。⚠️ 见 #2。
- ReminderNotices：read=projectScopedRead；create/update/delete=正确包裹的 isGlobalAdmin。⚠️ 见 #1 —— update（标记已办）对项目成员关闭。
- **裸 isGlobalAdmin 误用核查**：新增两集合中 `isGlobalAdmin` 全部为 `({req})=>isGlobalAdmin(req.user)` 包裹形态，未发现裸用（verify 已收敛）。遗留的裸用仅在**既有文件** `LeadActivities.ts` 的 create/update/delete（本次只增了 `reminder` 枚举，未触及），见 #6。

### 2.5 代码约束
- 自研文件行数：ReminderRules 101、ReminderNotices 94、reminderCron 167、route 24、payload.config +21、Dashboard +9、custom.scss +2，均 ≤1000。✅
- 无兜底/双写：`applyStatuses` 与 `graceHours` 各有 1 处小默认（视为字段选项回退，非双写路径）；`graceHours` 在同一函数内算了 2 次（见 #7）。
- TypeScript：`where` 用 Payload `Where` / `Where[]`（verify 记录由 `Record<string,unknown>` 修正，build 通过）；`docs as unknown as RuleRaw[]`/`LeadRaw[]` 为深度 0 拉取的结构化规整，可控。关系字段 `relId(raw.kind|raw.project)` 归一。✅
- 新增依赖 node-cron（自宿主、无外部服务）对照红线通过；`package.json` 含 `node-cron ^4.6.0` + `@types/node-cron`。✅

### 2.6 测试覆盖
- 已记录手动验证：`evidence/verify-before-complete.md`（空规则、due 命中第 1/2 次判重、notices/activities 落写、receiver=null、权限 403、构建不启定时器、delete access 包裹）。覆盖与本次代码对得齐，关键路径可信。✅
- 缺口（见 #3）：核心新逻辑**无 e2e/自动化测试**，且手动验证未覆盖：sla kind、graceHours 缺省路径、notice 标记 done 的权限、多规则/跨项目隔离、接口 404/500 信封边界、非法 kind 规则。

---

## 3. Top Findings

| # | 级别 | 归属 | 说明 |
|---|------|------|------|
| 1 | Warning | QUALITY(权限/回归) | `ReminderNotices` update/delete/create 均收窄为 `isGlobalAdmin`，但 read 为 `projectScopedRead`。项目 owner/admin/editor（本地写角色）**能看到**待跟进清单却**无法标记已办**（done），只有全局管理员能操作。与 REQ「后台提醒点/看板展示待办 + 处理后可标记已办」及「写权限 admin/项目写」口径不一致，疑似误把「系统记录的写」与「用户的操作流程」混为一挡。建议 update（标记 done）改为项目写权限（项目场景），create/delete 保持全局管理员。 |
| 2 | Warning | QUALITY(权限-提权) | `ReminderRules` create/update 用 `projectWrite`（`memberCanWrite`：任一项目 owner/admin/editor 或全局 admin）。`project` 留空即全局规则，会扫描**全部项目**。于是任意一个项目的 editor 都能创建/修改作用于所有项目的全局规则，及修改他项目规则 → 项目级凭据获得跨项目的扫描配置权。建议全局规则（project=null）要求 isGlobalAdmin；项目级规则 create/update 校验对**该规则 project** 的成员写权限（现有 `memberCanWriteProject`）；点击 update 不得越到其它项目规则。 |
| 3 | Warning | QUALITY(测试覆盖) | 核心新逻辑（due/sla 判定、判重、receiver/dueAt、接口权限、构建不启调度）**仅有手动验证，无任何 e2e/单测**。与本仓既有 e2e 约定（phase1 有 `apps/e2e/tests/lead.spec.ts`）不平行。建议至少补：sla 命中、同 lead+rule+kind 判重、notice 标记 done、未登录/非管理员调 run 接口、非法 kind/空规则边界。 |
| 4 | Info | QUALITY(收敛点) | Dashboard 并行查询新增 `payload.count({collection:'reminder-notices', status=open})`。表未推 schema 时看板整页 500 —— 属「先 push 后起」的标准部署顺序，且本次**无迁移文件**（建表依赖 `payload schema` push、枚举加值依赖库级约束重建），升级时需先建表再启。建议在升级清单显式标出。 |
| 5 | Info | QUALITY(归属) | REQ-0002 到期提醒默认阶段为“进行中(new/contacted)”，`applyStatuses` 默认值仅为 `['new']`。可配置故非阻断，但开箱即用与需求描述不同，建议默认 `['new','contacted']`。 |
| 6 | Info | QUALITY(既有遗留) | `LeadActivities.ts` 的 create/update/delete 仍为**裸 `isGlobalAdmin`**（access 回调传 `{req}`，`isGlobalAdmin({req})` 中 `.role` 为 undefined → 恒 false，即管理员也无法经后台写 lead-activities）。本次仅 +1 枚举未引入该问题；因集合本就定位“只读审计视图”影响小，但在本次触及的文件内遗留，建议顺手包一层 `({req})=>isGlobalAdmin(req.user)`。 |
| 7 | Info | QUALITY(代码质量) | `graceHours` 在同一函数内计算了 2 次（判定 + dueAt），`Number(raw.graceHours)||24` 重复；`applyStatuses?.length?...:['new']` 为字段选项回退。非双写正确性，建议收敛为单一定义（读一次、判空一次、复用变量），减少口径漂移。 |
| 8 | Info | QUALITY(并发/健壮) | 判重仅靠应用层 `alreadyOpen`，无 DB 唯一约束兜底：cron 与手动 run 若重叠（如定时扫描 >30min 或被重复手动触发）存在 TOCTOU 双写窗口。单实例假设下风险极低，但多进程/PM2 cluster 时每进程都会注册 cron（见 verify 措辞与设计）。建议记录为后续多实例门禁项。 |
| 9 | Info | QUALITY(性能) | `runReminderScan` 全量扫描：每启用规则 1 次 leads 查询 + 每命中线索 3 次写查（alreadyOpen find + notice create + activity create）。30 分钟粒度 + 单租户自托管可接受，无索引问题（notices 的 lead/rule/kind 均索引）；数据量大后需 TTL/批量化。 |
| 10 | Info | QUALITY(命名/字段) | 字段命名 camelCase 三层映射通过（applyStatuses/graceHours/nextFollowUpAt/dueAt/receiver），双语 label 齐全；枚举只增不改（`LeadActivities.type` 增 `reminder`）符合迁移红线。 |

---

## 4. 最小修复清单（仅建议，本次不改业务代码）

优先级从高到低，建议在进 commit 门禁前由实现侧收敛：

1. 【权限-高】`ReminderNotices.update`（标记 done）放开到项目写角色（或至少项目 owner/admin），create/delete 保持全局管理员。—— 对应 #1
2. 【权限-中】`ReminderRules` 全局规则（project 空）创建/更新要求 isGlobalAdmin；项目级规则校验对规则所属项目的写权限，update 不得越权到他项目。—— 对应 #2
3. 【测试-中】本 change 收敛前至少补 sla 命中 + 判重 + 非管理员 403 的验证记录；后续 change 按仓库 e2e 约定补自动化（run 接口信封 + 判重）。 —— 对应 #3
4. `LeadActivities` 的裸 `isGlobalAdmin` 顺手包裹为 `({req})=>isGlobalAdmin(req.user)`（同文件既有遗留）。 —— 对应 #6
5. `applyStatuses` 默认值改 `['new','contacted']` 对齐 REQ 描述；`graceHours` 双算收敛为单变量。 —— 对应 #5/#7
6. 升级清单显式标注「先 push reminder-rules/reminder-notices 表 + lead-activities.type 枚举」再启服务，防 Dashboard 整页 500；记录多实例去锁为日后门禁项。 —— 对应 #4/#8

评审净评：正确性主干与调度护栏达标，无 Critical；三项 Warning 均集中在权限口径与测试形态，可在进门禁前按 #1–#3 收敛后放行。verify-before-complete.md 与本次代码高度一致，手动证据充分。