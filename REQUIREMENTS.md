# REQUIREMENTS.md

<!-- AIWS_MANAGED_BEGIN:requirements:contract -->
本文件是工作区需求的唯一真值来源。AI 在制定计划与执行测试时必须以此为准。

约束：
- 不写入任何 secrets（token、账号、内网端点等）
- `aiws update` 只维护本托管块；其余内容由项目自由编辑

相关合同：
- `requirements/requirements-issues.csv`：需求拆解执行合同（校验：`python3 tools/requirements_contract.py validate`）
<!-- AIWS_MANAGED_END:requirements:contract -->

本文件是当前项目的需求与验收标准唯一真值来源。请按以下约定维护：

## 如何编写需求

每条需求使用唯一 `Req_ID`（形如 `PROJ-001`），包含：

- **背景 / 问题**：为什么需要
- **目标**：要达成什么（可验证）
- **非目标**：明确不做哪些（防范围蔓延）
- **验收标准**：可机器或人工验证的条目

已完成的需求保留在历史区并标记 `✓`；新增需求追加到 Backlog 区。

## Backlog

> 工程治理项（死模型清理、兜底收敛、e2e 缺口、部署契约变更等）不作为需求条目登记，统一走 `.aiws/issues/problem-issues.jsonl`（PROB 编号以该台账当前内容为准，逐轮追加，不在本文重复声明区间），按 `AI_PROJECT.md` §3.1「问题修复」路径归因。

## 已完成

### ✓ REQ-0001：Phase1 工程骨架（单站点可发文、表单线索入池）

- 状态：已完成（change 归档于 2026-08-26，见 `.aiws/changes/archive/2026-08-26-phase1-skeleton/`）
- 验收：全部通过

**背景 / 问题**
- 仓库前身为纯文档仓库，无任何可运行工程。无法发文章、无法收表单线索，多产品增长平台无法落地。

**目标**
- 建立 monorepo（`apps/astro` 公开站 + `apps/cms` Payload 后台），Postgres 自持线索数据。
- 单站点可发布文章并在公开站静态渲染。
- 表单提交可将线索写入自有 Postgres 线索池。

**非目标**
- 多项目/多域名挂站（Phase 2）
- 去重合并/归因/CRM 插件（Phase 2）
- 富文本 Lexical 前端渲染组件（先以结构化字段/列表代替正文）
- Chatwoot 收件箱接入（Phase 3）
- 任何外部 CMS / 内容 SaaS

**验收标准**
- [x] `docker compose up -d postgres` 起容器，cms 与 astro 在 host 运行，`DATABASE_URI=localhost:5434` 连通 Payload 建表
- [x] `GET /api/v2/health` 返回 `{ success: true, data: { status: 'ok' } }`
- [x] `POST /api/v2/leads`，缺 phone 且缺 wechat 时返回校验错误信封（`error.code=VALIDATION`）；非法/空 projectId 返回 `MISSING_PROJECT`；非法 JSON 返回 `INVALID_JSON`；DB 异常返回 `LEAD_CREATE_FAILED`(500)（其中 `LEAD_CREATE_FAILED`(500) 为代码核实：`apps/cms/src/app/api/v2/leads/route.ts:123`；本轮 e2e 未构造 DB 异常）
- [x] 合法提交（phone 或 wechat 至少填一）后线索落库 `leads` 表，返回 `{ success: true, data: { id } }`
- [x] 公开站首页渲染 Payload 已发布文章列表，并展示留资表单；`/articles/[slug]` 渲染已发布文章（`/articles/[slug]` 详情页本轮 e2e 仅有 REST 详情断言，页面渲染沿用 8-26 归档证据）
- [x] Playwright 烟测覆盖：健康信封、首页渲染、表单→Lead 落库、API 直投、非法请求边界、OPTIONS/CORS

复验证据：见 `.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md`（本批次 2026-09-19 重跑 `pnpm --filter cms build` + Playwright e2e；此处仅声明证据路径，结论由主 session 在 `aiws verify-bc` 时收口，不代表复验已完成）

### ✓ REQ-0002：线索跟进提醒自动化（到期 + 首次跟进 SLA，核心）

- 状态：已完成（change 归档于 2026-08-26，见 `.aiws/changes/archive/2026-08-26-lead-followup-reminders/`）
- 验收：全部通过

**背景 / 问题**
- 现有 `nextFollowUpAt` 字段已存在但无机制消费，跟进全凭人工记忆，逾期/漏跟无提醒。
- new 线索长时间无人首响、长期停在未跟进状态，无信号让跟进人感知。

**目标**
- 支持在后台配置提醒规则（到期提醒 / 首次跟进 SLA），由 node-cron 定时扫描命中线索。
- 命中后写 `reminder-notices`（后台"待跟进"清单）+ 追加 `LeadActivities`（`reminder` 事件），看板展示待办提醒点。
- 承诺：同一线索同一规则在未处理前不重复提醒；提醒不改变线索本身状态。

**非目标**
- 外部渠道触达（企业微信/钉钉/邮件 webhook 推送）—— 后续独立 change 接入。
- 自动改线索状态 / 自动分配 / 自动外呼 —— 仅提醒，不代执行动作。
- 提醒规则的第三方订阅与复杂条件编排（如叠加来源+多标签）—— 先支持项目范围+适用阶段。

**验收标准**
- [x] 后台可配置规则：`reminder-rules` 集合含 type(due/sla)、适用阶段、sla 超时阈值(小时)、归属项目(空=全局)、启停，且字段均有中英双语 label
- [x] 到期提醒：`nextFollowUpAt` 已过且阶段为进行中(new/contacted)的线索命中，未处理前不重复提醒
- [x] 首次跟进 SLA：状态仍为 `new` 且创建超过阈值小时未跟进(pre)线索命中
- [x] 命中后生成 `reminder-notices`（线索+类型+接收人+状态 open/done）并追加 `LeadActivities` 事件 `reminder`
- [x] 提供 `/api/v2/reminders/run`(POST，管理员) 手动触发扫描，返回 `{ success, data:{ created } }`
- [x] 看板展示待办提醒数量/清单；后台 `reminder-notices` 集合即"待跟进"列表（代码核实：`apps/cms/components/Dashboard.tsx:63,209` 实做 reminder-notices 计数；后台列表由本轮 reminders.spec 经 REST 断言）
- [x] CMS 生产构建通过 TS 校验；调度在构建期不启动定时器

复验证据：见 `.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md`（本批次 2026-09-19 重跑 `pnpm --filter cms build` + Playwright e2e；此处仅声明证据路径，结论由主 session 在 `aiws verify-bc` 时收口，不代表复验已完成）

### ✓ REQ-0003：公开站页面文案入 CMS（每页一个结构化集合 + 首页 hero/CTA 可排序）

- 状态：已完成（change `astro-page-copy-cms`，交付于 2026-09-21；归档由 `aiws change finish` 在提交后执行，故暂无 `.aiws/changes/archive/...` 路径）
- 验收：8/8 已勾。**成色分两档**：第 1、6 格按括号内标注的口径勾（机器对面未覆盖的部分已点名并各自登记 PROB），其余 6 格为机器逐字/产物级对面。逐格对面与判定见 `.aiws/changes/astro-page-copy-cms/evidence/verify-before-complete.md` §2

**背景 / 问题**
- 三站（觉策 / ERP / 云雀）四页（首页 / 功能 / 方案 / 价格）的营销文案硬编码在 `apps/astro/src/content/{home,features,solutions,pricing}.ts`（1933 行）与 `apps/astro/src/site.ts`（179 行）里，改一个字都要走代码评审 + 重新构建发版，运营无法自助改稿。
- 文章类内容早已在 Payload 后台管理，页面文案是最后一块仍在代码里的内容。

**目标**
- 运营在 Payload 后台即可修改三站四页的文案，并对首页 hero 与 CTA 区块做增删与排序；改完重新构建公开站即生效，不需要改代码。
- 建模形态（owner 2026-09-20 裁决）：**每页一个结构化集合**，字段与现有 TypeScript 类型一比一，保留编译期字段校验；**不**建通用 `PageBlocks` 区块表。

**非目标**
- 不做整页拖拽可视化搭建、不做页面模板市场。
- 不做多语言（i18n）文案版本——三站即三套文案，不额外做语言切换。
- 不改公开站视觉与 DOM 结构（迁移前后渲染结果逐字一致）。
- 不做发布审批流与定时发布。

**验收标准**
- [x] 后台存在首页/功能/方案/价格四类页面内容集合，字段与页面文案 TS 类型一比一对应（类型真值在 `apps/astro/src/types/pages/*.ts`，2026-09-20 由 `content/*.ts` 抽出），且字段均有中英双语 label。一比一允许三处受控形变（见 change 的 design D4 / D8③，唯一实现处 `apps/cms/src/lib/pageCopyProjection.ts`）：① `hero.titleA`+`titleEm` 折成与首页同形的 `titleLines[]{text, emphasis}` 可重复组；② `FeaturePanel.kind` 由 Payload `blocks` 的 `blockType` 承载，不另存判别键；③ 公开端点出响应前做读侧归一——剥掉 Payload 的框架记账键（行/块的 `id`/`blockName`/`_order`，记录根的 `project`/`status`/`createdAt`/`updatedAt`）并把未填可选字段的 `null` 折回「键不存在」，使响应体逐字等于 Astro 类型形态（12 份导入前快照的 `null` 与空串叶子数为 0，故该归一不会擦除任何真实文案）。**成色**：「一比一」＝机器对（`node scripts/astro-copy-coverage.mjs` 的路径差集 `A\B=0`，日志 `370`）；「双语 label」目前只有 grep 计数（四集合 `en:` 出现 115/94/33/41 次）而无逐字段断言 ⇒ 缺口登记为 **PROB-045**，本格按此成色勾
- [x] 首页 hero 与 CTA 可在后台增删条目并调整顺序，公开站按后台顺序渲染（常驻 e2e `apps/e2e/tests/page-copy.spec.ts` 第 7 组：一次写入「追加一行 + 删一行 + 全部倒序」，`h1.hero-title > span.line` 与 `.cta-rows .cta-row h3` 逐位等于后台数组序，`finally` 整份复原并深比；日志 `383`）
- [x] 一次性导入脚本把三站 × 四页现有文案导入并发布；导入前后公开站渲染文本逐字比对无差异（差异清单为空）（`scripts/import-astro-copy.ts` 幂等复跑 `created=0 updated=12`；`node scripts/astro-copy-render-diff.mjs` → `12/12 三站四页可见文本逐字一致`，日志 `379`）
- [x] 后台修改一条已发布文案 → 重新构建 → e2e 断言该字符串在对应公开页出现（原字符串消失）（dev 层常驻用例日志 `383`；产物层因 `output: 'static'` 只能一次性回环，日志 `238`）
- [x] 构建期 CMS 不可达时 `astro:build` 以非零码失败并给出可读错误；不产出空白区块，也不回退到代码内的旧文案（负向用例覆盖）（`node scripts/astro-copy-cms-unreachable.mjs` 四条判定，日志 `374`；红侧自证：PROB-028 修复前该门禁即报「可读错误命中=false」）
- [x] 三站四页的 SEO 三件套构建后逐页齐全：标题 / 描述在后台可配（一比一镜像出来的 `meta.{title,description}` 即唯一载体，**不另设 `seoTitle`/`seoDescription` 覆写字段**——那会是零消费者的第二套载体，AGENTS.md §4 禁双写）；canonical 由构建期页面 URL 派生（存库会与实际部署域名产生第二真值），过 AGENTS.md §9 自检。**成色**：源码级机器对（`node scripts/astro-copy-agents9.mjs` 断言 Layout 落 `<title>`+`meta description`+`link canonical` 且四页 `meta` 取自 CMS 4/4，日志 `371`）；**产物级未固化**——渲染文本抽取器在提取前删 `<head>`，构建产物里 12 页的 title/description 落地值不在任何门禁内 ⇒ 登记为 **PROB-039**（与 PROB-041 配成「基线退役」P2 对），本格按此成色勾
- [x] `apps/astro/src/content/*.ts` 与 `site.ts` 中已被 CMS 接管的文案字段删除，不留代码内兜底副本（AGENTS.md §4 禁双写）。边界：本需求只搬「页面文案」；站点级品牌 / 导航 / 备案号（`site.ts` 的 Site 记录）不在范围内，`site.ts` 侧只要求去掉 `SITE_ID` 缺失时静默按主站构建的兜底（实际删除 1937 行；`|| 'juece'` 全仓命中 0、`apps/astro/src/content/` 目录已消失、缺 `SITE_ID` 即抛，日志 `371`）
- [x] `pnpm --filter cms build`、三站 `pnpm astro:build`、`pnpm --filter e2e test` 全部 exit=0（最终态日志 `375`/`376`/`377`/`378`/`383`/`384`；`build.mjs` 的 libuv 白名单未命中，即真 0 退出）

复验证据：见 `.aiws/changes/astro-page-copy-cms/evidence/verify-before-complete.md`（九道门禁 P-V1..P-V9 的实测日志编号、八格验收的逐条对面、以及「未验证/未执行」清单都在该文）；命令级证据在 `evidence/verification.jsonl`（318 行，每行的 artifact 已按字节镜像进 `evidence/logs/`）。线上发布动作**未执行**（本 change 全程只连本地容器库），前置清单见 `evidence/release-prerequisites.md`
