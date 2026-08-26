# GATE-002 · 线索跟进提醒自动化（到期 + 首次跟进 SLA，核心）

> 门禁规则见 AGENTS.md §8：重大改动先立门禁，获确认后才落地。
> 状态：**ACCEPTED**（2026-08-26）。ID：GATE-002，slug：follow-up-reminders。
> 绑定：change/lead-followup-reminders · Req_ID: REQ-0002 · 步骤一（后台内提醒，不接外部）

## 1. 背景
- `Leads.nextFollowUpAt` 字段已存在但无任何消费机制，跟进全凭人工记忆，逾期/漏跟无提醒。
- `new` 线索长期无人首响、停在未跟进状态无信号。
- 本次落地后台内闭环：可配置规则 → node-cron 定时扫描 → 命中写待跟进清单 + 事件时间线 + 看板提醒点。

## 2. 方案对比
### 2.1 触发机制
| 方案 | 结论 |
|---|---|
| node-cron（apps/cms 常驻调度） | ✅ 采纳：自包含、自宿主、无外部依赖，贴合用户选择与红线 |
| 外部 cron 轮询 /api/v2 接口 | 未选本期：依赖外部调度器，需暴露内部接口；作为手动触达补充保留 |

### 2.2 提醒落点
| 方案 | 结论 |
|---|---|
| 新增 `reminder-notices` 集合（待跟进清单） | ✅ 采纳：可作为去重依据 + 后台待跟进列表 + 看板待办来源 |
| 仅 LeadActivities + 看板查询 | 未选：无持久"待办/已办"状态，无法判重与标记处理 |

### 2.3 SLA 判据
| 方案 | 结论 |
|---|---|
| `status='new'` 且 `createdAt + graceHours` 已过 | ✅ 采纳：直观，首响=离开 new 或完成首跟，剩余状态语义即可判定 |
| 依据 activity 是否有 follow_up | 未选本期：状态字段已能表达首响，避免多做一次表关联 |

### 2.4 外部推送
- 本期**不做** webhook（企业微信/钉钉/邮件）。计划在步骤二独立 change 接入企业微信机器人。

## 3. 作用域（本次门禁覆盖 = step1 核心）
- 新增 `reminder-rules`（规则集合，可配置 due/sla + 适用阶段 + 阈值 + 启停）。
- 新增 `reminder-notices`（触发落一条，兼作去重与"待跟进"清单）。
- `LeadActivities.type` 新增 `reminder`（安全演进）。
- node-cron 调度 + 手动触发接口 `POST /api/v2/reminders/run`（管理员）。
- Dashboard 看板"待跟进"提醒点 + 样式。
- 构建期不启动定时器；TS 生产构建通过。

## 4. 不做（本期排除）
- 任何外部渠道推送（企业微信/钉钉/邮件 webhook）——步骤二。
- 自动改线索状态 / 自动分配 / 自动外呼。
- 规则叠加来源/标签等复杂条件与第三方订阅。
- 公开站 `apps/astro` 改动。

## 5. 风险与对策
| 风险 | 对策 |
|---|---|
| node-cron 在 dev HMR / 构建期重复触发 | `globalThis` 哨兵防重；`NEXT_PHASE=phase-production-build` 早退 |
| 扫描频率造成 DB 压力 | 默认每 30 分钟一次，单表全量扫描轻度 |
| 新集合建表与既有库列冲突 | 沿用"新增列安全演进"；冲突先清残留列再起 Payload |
| 提醒风暴打扰 | 同一 lead+rule+kind 未处理前不重复提醒（open 判重） |

## 6. 影响范围
- 后端/数据：新增 `reminder-rules` / `reminder-notices` 两集合；`LeadActivities` 增枚举；payload 注册 + onInit。
- 后台 UI：Dashboard 待办提醒点；`custom.scss` 样式。
- 接口：新增 `POST /api/v2/reminders/run`（内部、管理员）。
- 文档：REQUIREMENTS.md 新增 REQ-0002；requirements-issues.jsonl + CHANGELOG 同步。

## 7. 自检清单（完成后必过）
- [ ] 命名 camelCase 三层映射；字段双语 label
- [ ] 新增 node-cron 依赖对照红线（自宿主、非外部 CMS）通过
- [ ] API 统一 /api/v2 信封；错误不暴露 DB 栈
- [ ] 判重正确：未处理的同一规则不重复提醒
- [ ] 提醒不改线索状态；数据仍在自有 Postgres
- [ ] 自研文件 ≤1000 行、无兜底/双写/兼容写法
- [ ] 影响范围已说明（前端看板 / 后端 / 数据两集合）

## 8. 结论
- **ACCEPTED（2026-08-26）**。开工（绑定 change/lead-followup-reminders，流程 plan→verify→dev→review→commit→finish）。