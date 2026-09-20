# GATE-005 · 线索分配与站点复制的错误码映射 + 审计写路径修复

> 门禁规则见 AGENTS.md §8：高风险（权限 / 数据 / 跨域 / 破坏性）变更先立门禁并获确认后才落地。
> 状态：**APPROVED**（2026-09-20，owner 裁决原文「PROB-005 / 006 要不要各立一个项目 → 不用」）。ID：GATE-005，slug：assign-clone-error-and-audit-fix。
> 绑定：`apps/cms/src/collections/{Leads,Sites,Memberships,Users}.ts` 的自定义端点与级联钩子 + `apps/e2e/tests/{leads-assign,sites-clone}.spec.ts`。不改 schema、不改数据、不动线上。

## 1. 背景

清理批次 `cleanup-batch-20260919` 为 `/api/leads/assign`、`/api/sites/clone` 补 e2e 时，实测出两类缺陷并登记为 PROB-005（P2 错误码映射）与 PROB-006（P1 审计丢失）。两者原计划「另立 change」，理由是「改错误映射与审计写路径属行为变更，需独立门禁 + 双审查」。owner 2026-09-20 裁决不各自立项、合并为一个改动做掉 ⇒ 本门禁即那份「独立门禁」，同时覆盖修复过程中扫出的同类实例。

## 2. 方案对比

| 选项 | 做法 | 后果 | 取舍 |
|------|------|------|------|
| A | 各自立 change（005 / 006 两批） | 回滚边界最细，但同一函数改两次、同一 spec 改两次，双审查跑两轮 | 否：纯流程开销，无风险控制收益 |
| B | 只登记台账、不中修 | 本批范围最小 | 否：P1 审计缺陷与对外错误码失真继续裸奔，违背「已核实缺陷当场修」 |
| **C** | **合并为一个改动 + 本门禁 + 双审查** | 一次改完同一端点的错误码/审计/响应面，回滚单位是一个提交 | **采纳**（owner 裁决） |

## 3. 修复清单（含扫描时命中的同类实例）

| 项 | 缺陷 | 修复 | 定位 |
|----|------|------|------|
| 1 | `/assign` 对不存在的 `leadId` 回 500，前面的 404 分支是死代码（Payload `findByID` 默认抛 NotFound，被外层 `catch` 混成 500） | `disableErrors: true` ⇒ 查不到返回 null，按真实原因回 404 `LEAD_NOT_FOUND` | `Leads.ts:166-181` |
| 2 | 同上，跟进人不存在也落 500 | 404 `ASSIGNEE_NOT_FOUND` | `Leads.ts:191-204` |
| 3 | `/assign` 写动态丢审计：`payload.update` 未透传 `req` ⇒ `afterChange` 拿不到发起人 ⇒ `lead_activities.actor=null` | 透传 `req`（与 Payload 自带 REST handler 同一传法） | `Leads.ts:227-240` |
| 4 | `/assign` 响应把 `owner` 回成整份用户文档（含鉴权用的 `sessions[]`） | `depth: 0` 只回裸 id；测试断言改为键集 + `typeof owner === 'number'` 白名单 | `Leads.ts:232-234`（PROB-015） |
| 5 | `/clone` 与第 1 项完全同类：不存在的 `sourceId` 落 500，`if (!source)` 死代码；`catch` 静默无日志 | `disableErrors` + null → 404 `SOURCE_NOT_FOUND`；`catch` 记 `logger.error` | `Sites.ts:70-88,127-131`（PROB-016） |
| 6 | 级联清主丢审计（第 3 项同因，扫描命中）：移除成员 / 删除用户时 `payload.update` 清 `owner` 未透传 `req` ⇒ 清主动态 `actor=null` | 两处透传 `req`；新增用例断言清主动态带发起人 | `Memberships.ts:42-49`、`Users.ts:41-49` |
| 7 | 恒真权限判断（§4 禁止死兜底）：`memberCanWriteProject(...) \|\| !isProjectMember(...)` 第二项蕴含于第一项，且多打一次 memberships 查询 | 删第二项与其 import，留一行说明「写角色 ⊆ 成员」 | `Leads.ts:183-189` |

### 为什么不改的（同轮判定）

* `/assign`、`/clone` 的「读到再写之前对象被删」竞态仍回 500：那是并发窗口而非逻辑死分支，改法要走事务/条件更新，属另一量级 ⇒ 登 PROB-019。
* 「负责人被清空」被记成 `type=assigned`（`detail=已分配跟进人`）：集合 `options` 无 `unassigned`，加档位要改 schema 走迁移，按 §7 不混进本批 ⇒ 登 PROB-018。
* 超 int4 的 id（如 `2147483648`）仍回 500 而非 400/404：需要一次统一的 id 边界校验设计 ⇒ 登 PROB-017。
* `access.ts` 三处 `findByID` 未关默认抛错却写了 null 分支（恒不可达）：属权限代码，fail-closed 已被「抛错即拒绝」满足，改法涉及权限语义 ⇒ 登 PROB-020，本批不动权限面。
* 6 处 `/api/v2/*` 的 `catch` 静默回 500 无日志：同一口径要一次扫全 ⇒ 登 PROB-021。

## 4. 影响范围

* **对外契约（行为变更）**：`/api/leads/assign` 与 `/api/sites/clone` 在「记录不存在」时由 `500 LEAD_ASSIGN_FAILED` / `500 SITE_CLONE_FAILED` 改为 `404 LEAD_NOT_FOUND` / `404 ASSIGNEE_NOT_FOUND` / `404 SOURCE_NOT_FOUND`；`/assign` 成功响应由「整份用户文档」收敛为 `{id, owner: number}`。
* **数据**：只新增审计行内容差异（`lead_activities.actor` 由 NULL 变有值、`depth` 不影响落库），无 schema、无回填、无删改。
* **消费方**：全仓检索 `leads/assign` 只命中注释与 `apps/e2e/tests/leads-assign.spec.ts`；`sites/clone` 只命中 `sites-clone.spec.ts` 与文档 ⇒ 无站内调用方受影响；`docs/` 未把旧的 500 语义写成契约。
* **线上**：未连接、未执行任何迁移或 SQL。

## 5. 风险与回滚

| 风险 | 处置 |
|------|------|
| 外部脚本按 500 判「不存在」会改变判定 | 站内无消费方；对外文档从未承诺 500 语义；`CHANGELOG.md` 显式记录该契约变更 |
| `depth: 0` 让依赖响应里用户对象的调用方拿不到名字 | 端点响应本就只回 `owner`，需要名字另走 REST 查询；e2e 断言键集与类型 |
| 透传 `req` 把会话带进本地 API 调用 | 这是 Payload 自带 REST handler 的同一传法（`updateByID.js:20`），且响应字段面被白名单断言钉住；实测响应体 `body_has_sessions=false` |
| 删恒真权限判断放宽边界 | 未放宽：`memberCanWriteProject` 命中即要求该项目有写角色（写角色 ⊆ 成员），拒绝路径与状态码不变，由 C6 与 assign 的 403 用例共同守 |
| 回滚 | `git revert` 本轮提交即回到旧行为；无数据动作可逆性问题（不迁数据） |

## 6. 自检项（AGENTS.md §9 + 本门禁）

- [x] 命名三层映射不变（`leadId`/`assigneeId`/`sourceId`/`depth`），无 snake_case 泄漏。
- [x] 未引入外部 CMS / 新依赖：`package.json`、`pnpm-lock.yaml` 无改动。
- [x] API 信封统一：成功 `{success,data}`、失败 `{success,error:{code,message}}`，500 分支只回统一信封 + 服务端日志，不外泄堆栈。
- [x] 无兜底/双写/兼容写法：死兜底（恒真权限项）已删；未新增 `??`、未保留旧 500 口径。
- [x] SEO 无回归：不涉及公开站渲染。
- [x] 线索仍在自有 Postgres；Chatwoot 仍只作收件箱。
- [x] 文件行数：`Leads.ts` 397 → 400 行内、`Sites.ts` 265、`Memberships.ts`/`Users.ts` 未破 500。
- [x] 影响范围已说明（对外契约 / 数据 / 消费方 / 线上）。
- [x] 双审查：`review/quality-review.md`、`review/spec-review.md` 均补 2026-09-20 修复轮段落，HIGH 项经 triage 收敛。
- [x] 验证可机器复核：`evidence/verification.jsonl` 追加类型、探针、全量 e2e、库侧残留与门禁记录；全量 e2e 见 `72/79` 日志。
