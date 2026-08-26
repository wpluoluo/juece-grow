# Verify Before Complete · lead-followup-reminders

> Change: `lead-followup-reminders` · 线索跟进自动化：到期提醒 + 首次跟进 SLA（核心，后台内提醒）
> Req_ID: REQ-0002 · GATE-002（ACCEPTED 2026-08-26）
> Verified: 2026-08-26
> Branch: `change/lead-followup-reminders`

## 验证结论

按 proposal / design / tasks 达成，可复现验证全部通过，无未闭环项。

## 逐项验证记录

### 1. 数据模型（新增两集合 + 枚举演进）

- 新增 `reminder-rules`：name / project(空=全局) / kind(due|sla) / applyStatuses / graceHours / target / enabled，双语 label。
- 新增 `reminder-notices`：lead / project / rule / kind / receiver / dueAt / status(open|done)，双语 label。
- `lead-activities.type` 新增 `reminder` 选项（只增不改枚举演进）。
- 集合均注册进 `payload.config.ts`，归组「客户与线索」。
- 结果：`pnpm --filter cms payload generate:types` 成功生成类型。

### 2. 调度与实现

- 新增 `src/lib/reminderCron.ts`：
  - 构建期早退：`NEXT_PHASE==='phase-production-build'`。
  - `globalThis.__reminderCronStarted` 哨兵防 dev HMR 重复注册。
  - 默认调度 `*/30 * * * *`（可用 `REMINDER_CRON_EXPRESSION` 覆盖）。
  - `runReminderScan`：due（applyStatuses + nextFollowUpAt<=now）/ sla（status=new + createdAt+graceHours<=now）命中 → open 判重 → 写 `reminder-notices` + `lead-activities(reminder)`；`receiver=target ?? owner`。
- `payload.config.ts` 注册集合 + `onInit` 启动 `startReminderCron`。
- 新增 `app/api/v2/reminders/run/route.ts`（管理员手动触发，统一信封）。
- Dashboard 看板新增「待跟进提醒」统计卡（open notices 数量）。

### 3. 生产构建 + TypeScript

- 命令：`pnpm --filter cms run build`
- 结果：`✓ Compiled successfully`、`Finished TypeScript`，生成路由含 `/api/v2/reminders/run`；构建期未启动定时器（无扫描日志）。

### 4. 手动扫描 / 判重 / 落写验证

环境：`juece-grow-postgres`(5434) 运行，cms dev 运行于 :3000，管理员 admin 登录。

- 空规则扫描：`POST /api/v2/reminders/run` → `{"success":true,"data":{"created":0}}`
- 建 due 规则（applyStatuses=[new,contacted]）→ `id=1`。
- 造递条线索：lead 32「微信用户」status=new，设 `nextFollowUpAt=2026-08-25`（已过）。
- 第 1 次扫描 → `{"success":true,"data":{"created":1}}`
- 第 2 次扫描（判重）→ `{"success":true,"data":{"created":0}}`（created 不增长）
- `reminder-notices` 可见：`id=1, lead=32, rule=1, kind=due, receiver=null, status=open, dueAt=2026-08-25`
- `lead-activities` 可见：`type=reminder, detail=系统提醒：已到下次跟进时间, meta={ruleId:1,kind:due,dueAt:...}`
- 权限：未登录调用 → `{"success":false,"error":{"code":"FORBIDDEN"}}`，HTTP 403。

### 5. 代码/规范自检（AGENTS §9 + GATE-002 §7）

- 命名 camelCase 三层映射（applyStatuses / graceHours / nextFollowUpAt / dueAt）通过。
- 新增依赖 node-cron：自宿主、无外部服务，对照红线通过。
- API 统一 `/api/v2` 信封（成功/失败），错误不暴露 DB 栈。
- 判重正确：未处理的同一 lead+rule+kind 不重复提醒（实测第 2 次 created=0）。
- 提醒不改线索状态；数据存自有 Postgres。
- 自研文件 ≤1000 行，无兜底/双写/兼容写法。
- 影响范围已说明：后端/数据两集合 + 后台看板 + 内部接口。

## 审查收敛落地

| 审查项 | 处理 | 状态 |
|---|---|---|
| where 类型（`Record<string,unknown>` → Payload `Where`） | 构建报错后修正为 `Where` + `Where[]`，build 通过 | ✅ |
| 集合 delete access 直接放裸 `isGlobalAdmin` | 裸函数参数为 user，access 回调传 `{req}`，误判 403；包装为 `({req})=>isGlobalAdmin(req.user)`，实测删除成功 | ✅ |
| 未登录调用手动触发接口 | 返回统一信封 `FORBIDDEN`/403 | ✅ |
| 构建期不启动定时器（避免多进程/多实例） | `NEXT_PHASE` 早退 + `globalThis` 哨兵，build 无定时器日志 | ✅ |

## 遗留（步骤二范围）

- 外部渠道推送（企业微信 webhook）→ 步骤二独立 change。
- 自动改线索状态 / 自动分配 / 自动外呼——本期非目标。