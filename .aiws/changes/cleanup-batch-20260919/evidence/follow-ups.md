# 本批发现的后续问题与处置 · cleanup-batch-20260919

> 真值：`.aiws/issues/problem-issues.jsonl`（PROB-005..016 逐条含定位与证据）。本文件只补「为什么当时不在本批修」与「修的时候要注意什么」，从 `tasks.md §6` 移交至此。
> 日期：2026-09-19（2026-09-20 更新：PROB-005/006 已随批修毕，PROB-015/016 登记并随批修毕）

## 一、当初为什么不随本批静默修，后来又为什么修了

本批范围是「清理」（死模型、兜底、空目录、真值漂移、测试缺口）。PROB-005/006 会**改变对外行为或写入语义**（错误码映射、审计字段），按 `AI_PROJECT.md` §3.1 与 `agents.md` §8 属独立门禁 + 双审查对象，故 2026-09-19 收口时只登记 + 用 `test.fail` 用例固化，不擅自扩大批次。

2026-09-20 owner 裁决「PROB-005 / 006 要不要各立一个项目 → 不用」，两条并为一个改动随本批落地，同时带出并修掉同轮的 PROB-015/016（见 §二）。修复后 `test.fail` 标记全部摘除，仓库内不再有 expected-fail 用例。

## 二、逐条

### PROB-005（P2, DONE 2026-09-20 随批）`/api/leads/assign` 对不存在 id 落 500，404 分支不可达

`apps/cms/src/collections/Leads.ts` 的 `findByID` 对不存在 id 抛 `APIError`，被端点外层 `catch` 统一转成 `500 LEAD_ASSIGN_FAILED` ⇒ 前面 `if (!lead)` 的 404 分支是死代码，同时违反「不把数据库异常原样抛前端」。
当时预判的修法：按 `code`/`name` 区分 `APIError` 与真实库异常，别把 `catch` 拓宽成万能兜底。
**实际处置**：改用 Payload 官方的 `disableErrors: true`（`findByID` 查不到返回 `null`，`payload/dist/collections/operations/findByID.js:105-109`），两条 `findByID`（线索 / 跟进人）都走 null 分流回 404；`catch` 只接数据库/系统异常并记 `req.payload.logger.error`。未引入按异常文本猜类型的分支。
实测：`57-assign-probe-after-fix.log` 分别回 `404 LEAD_NOT_FOUND` 与 `404 ASSIGNEE_NOT_FOUND`；`61-assign-500-branch-probe.log` 用超 int4 的 `leadId=2147483648` 仍回 500 且 CMS 日志出现 `[lead-assign] 分配失败` ⇒ 500 分支是活的，不是被 404 抢走。
测试：`leads-assign.spec.ts` 两条原 `test.fail` 用例转为真实断言，并新增 `ASSIGNEE_NOT_FOUND` 用例。

### PROB-006（P1, DONE 2026-09-20 随批）端点分配丢失审计操作人

同文件里 `req.payload.update(...)` 未透传 `req` ⇒ `afterChange` 中 `req.user` 为空 ⇒ `lead_activities.actor=null`，分配动作查不到发起人（对照：REST 写入路径 `actor` 正常落 admin id）。
**实际处置**：`update` 透传 `req`，与 Payload 自带 REST 更新 handler 同一传法（`payload/dist/collections/endpoints/updateByID.js:20` ⇒ `createLocalReq.js:91` 的 `req.user = user || req?.user || null`）；同时把响应面收敛为裸 id（PROB-015），确保不会把会话材料带进响应。
实测：修复前 `53-assign-probe-before-fix.log` `ACTOR_ROW id=197 actor_id=NULL`；修复后 `57-assign-probe-after-fix.log` `ACTOR_ROW id=201 actor_id=8`，与同线索 REST 写入路径的 actor 一致；`71-response-shape-probe.log` `assigned_rows=id=219 actor=8`。
测试：原 `test.fail` 标记摘除，改为用例「审计：经 /assign 端点分配写出的动态带发起人 actor」。

### PROB-007（P3, OPEN）`lead.spec.ts` 提交类用例无自清

4 条提交用例每次跑测在 dev 库净增 4 条 `leads` + 4 条 `lead_activities`（实测 12→16→20，本批收尾再跑两轮后为 28）。同批新增的三个 spec 均按快照差集自清并断言零残留。
属测试卫生，低危；修的时候照 `reminders.spec.ts` 的「先取 id 快照 → afterAll 差集删」写法即可，不需要动产品代码。

### PROB-008（P2, OPEN）`payload.config.ts:242` 连接串空串兜底

`connectionString: process.env.DATABASE_URI || ''`。与本批 CORS 同类，但 Payload 在构建期（`NEXT_PHASE` 非 production 时）也读该配置，直接抛错可能打断 `next build`，需要先设计可验证的口径（构建期与运行期分别断言什么）。因此未随本批修，不是遗漏。

### PROB-009（P2, OPEN）真值文件的归因合同指向不存在的 `.csv`，且漂移位于 AIWS 托管块内

`AI_PROJECT.md` 第 20/21/33/58/101 行与 `REQUIREMENTS.md:11` 把归因入口写成 `requirements-issues.csv` / `issues/*.csv` / `tools/requirements_contract.py validate`，本仓实际只有 `.jsonl` 且无该 python 工具。
本批曾直接更正，`aiws validate .` 立即判为托管块 sha256 漂移（`AIWS_MANAGED_BEGIN:ai-project:core` 覆盖第 3–103 行；`requirements:contract` 块覆盖第 3–12 行），已回退并重新 `change sync`（哈希链留在 `.ws-change.json`）。
正解只有两条：`aiws update` 重新生成托管块，或 owner 决定修改托管模板。**手改不是选项。**

### PROB-010（P1, DONE 本批内）`scripts/backup.mjs` 内置默认连接串 + 失败回显口令

已删默认并在缺连接串时 `exit=1`；失败分支改为回显去掉口令的 `protocol://user@host:port/db`。实测：无 uri → exit=1；带假口令触发失败分支，输出 grep 口令 0 次。
残留（已闭环）：`4a7d807` 起该口令字面量在 git 历史里 ⇒ **owner 2026-09-20 裁决不轮换**，工作树不再改动，此项不再追问。仍然成立的只有一条未验证事实：本机无 `pg_dump`，成功导出分支未在本机跑通（历史备份由装有 `pg_dump` 的机器产出）。

### PROB-011（P2, OPEN）`aiws change validate --check-scope` 的四处机读约束

为 H2 补真跑门禁时撞到（源码位置：`@aipper/aiws-spec/templates/workspace/.aiws/tools/ws_change_check.py` 的 `parse_scope_patterns_from_plan` / `scope_check_from_plan`）：

1. `## Scope` / `### In Scope` 下**整条 bullet 被当成一个路径**，只在「反引号包裹全条」时剥掉反引号，并截断到第一个 `（`/`(`。因此「`apps/cms/.env.example`、`scripts/cms-run.sh`：说明文字」这种写法产出一个永不匹配的垃圾 pattern —— **已声明的文件反被报越界**。本批最初的 Scope 段全是这种写法，`--check-scope` 报了 20 个文件。
2. 条目数 >12 直接判 `scope is too broad (18 items > 12)`。两条规则合起来迫使 allow-list 收敛到目录粒度（`apps/cms/`、`apps/e2e/`）。
3. 默认 `--strict` **不含** `--check-scope`/`--check-evidence`，所以「无 scope 越界」这句话不能靠默认 strict 过关来背书。
4. 越界清单来自「工作树里所有未跟踪 + 已改动文件」，**不看归属**：agent 自己的 scratch 只要落在 gitignore 之外（本批实测 `.aiws/.aiws/**`，由验证脚本把仓库根算少一层写出）就会被当成本批改动的文件报出来。处置：scratch 一律放 gitignore 覆盖的路径（本仓 `.aiws/tmp/` 内）；出现幽灵越界项时先用 `git status --porcelain` 确认那是不是未跟踪残留，别急着改 plan 的 Scope。

本批处置：plan 的 Scope 已重写成机读格式（一条一路径，人读说明分离到表格），并在段首把这两条规则写进文档；带 flag 的复跑输出与残留记在 `verify-before-complete.md` §A-13/§A-14。

残留风险（为什么不 DONE）：
- allow-list 现在是**上界**而不是精确清单——`apps/cms/` 前缀会连带放过 `payload.config.ts` 等本批不该动的文件，目录级门禁拦不住"顺手改了范围外的 cms 文件"。精确性仍靠 `git status` 人工核对 + spec-review 的 Out-of-Scope 表。
- `.aiws/memory-bank/**`（你在先的 8-31 产物）会被持续报越界。这是工具的**正确行为**（它确实不属于本批），但也说明：只要工作树里留着无关改动，`--check-scope` 就永远不可能全绿——别把它当成"可忽略的告警"。
- 正解在上游：pattern 支持行内说明/`#` 注释、条目上限可配或允许按 glob 折叠。建议在 aiws 侧提 issue。

### PROB-012（P3, DONE 本批内）e2e 冷缓存首跑假红

`rm -rf apps/cms/.next` 后的首轮 `pnpm --filter e2e test` 会把 `lead.spec.ts` 前 3 例报成 30s 超时——付的是 Turbopack 首请求路由编译（实测 ~42–48s），不是功能。
已修：`apps/e2e/setup/global-setup.ts` 跑测前预热 4 个端点（`/api/v2/leads` 用 GET 拿 405，编译同模块且不写数据），并把 5 处 origin 字面量收敛到 `apps/e2e/helpers/origins.ts`。
冷启动实测：`56 passed / 2 skipped`、exit=0，见 `verify-before-complete.md` §A-15。

**有意未做**：不把「起 CMS/Astro dev」并入 playwright `webServer`。启动入口真值在 `AI_WORKSPACE.md` 与 `scripts/cms-run.sh`，并入等于造第二条启动路径（双写），与本批去兜底口径冲突。因此 `globalSetup` 在服务没起时**跳过预热并直接返回**，让用例自己的连接错误说明「dev 未启动」——这是唯一报错路径，不在此处造假象。

### PROB-013（P3, OPEN 工具侧）`aiws change evidence` 非幂等

本批收口时连跑两次 `aiws change evidence cleanup-batch-20260919`（第二次是为了验证 `Evidence_Path` 是否保留手工追加的 `verification.jsonl`）。结果：每次运行都新建一套**以本次 UTC 时间戳命名**的工件（`change-status` / `change-validate-strict` / `aiws-validate-stamp` / `change-sync-stamp` / `collaboration-summary` / `delivery-summary`），并把它们**追加**进 `proposal.md` 与 plan 的 `Evidence_Path`——既不去重也不回收上一轮。字段因此从 10 项涨到 16 项；若按"一套盖戳工件只留最新"清理，就会立刻死链。

处置（已完成）：删第二次运行的 6 个盖戳工件，`Evidence_Path` 重写为「人工三件 + 首轮机器六件 + `verification.jsonl`」共 10 项，并用 `.aiws/tmp/cleanup-batch-20260919/check-evidence-path.mjs` 逐项核对在盘存在（死链 `=0`，见 dev-log §8.4）。
操作规则（给下一轮）：**收口阶段该命令只跑一次**，跑完不再复跑；若必须复跑，先删上一轮盖戳工件或立即校对该字段。
正解在上游：追加前按 basename 去重，或整体重写该字段而非增量 append。与 PROB-011 同属 aiws 工具侧，不在本仓代码范围，故不随本批"顺手修"。

### PROB-014（P3, OPEN）`apps/e2e` 无 tsconfig / typecheck 入口

`apps/e2e/package.json` 只有 `test: playwright test`，包内没有 `tsconfig.json`。Playwright 用 esbuild 转译 TS，**不做类型检查** ⇒ helper 与 spec 的类型错误（返回值形状写错、字段名拼错后取到 `undefined`）只在运行时以断言失败或假绿表现。

触发点：提交后独立审查轮清掉 `cmsRest.ts` 的两条死兜底（`relId(...) ?? 0`、`res.body.doc ?? res.body`）时做的类型收窄，只由全量 e2e 绿灯证明，**未经编译器证明**（同 §F-8）。

正解（独立 change）：给 `apps/e2e` 建 tsconfig（`module: ESNext` + `types: ["node"]`），把 `pnpm --filter e2e exec tsc --noEmit` 并入 `AI_WORKSPACE.md` 的 `gate_cmd`。不在本批做的原因：会新增 devDependency 与第二条验证入口，属"新增能力"而非"清理"，且要与本批既定的零参数验收口径对齐。

### PROB-015（P2, DONE 2026-09-20 随批）`/api/leads/assign` 成功响应直出整份用户文档（含他人 `sessions[]`）

发现方式：修 PROB-006 时看 `/assign` 的成功响应体，`data.owner` 是填充后的用户对象，带出被分配人的 `sessions[{id(uuid), createdAt, expiresAt}]`。当时**没有**被测试拦住，因为仓库的响应泄漏白名单只查 `hash/salt/token/password` 四个键（`leads-assign.spec.ts` 正向用例），漏了 `sessions`。
性质核对：`sessions` 关系字段只序列化 id/时间戳，不含 `token`（`apps/cms/src/payload-types.ts:267-273`），所以不是直接可用凭据；但任意有项目写权限的调用方可枚举他人的会话标识与有效期，属不该有的响应面。根因是 `req.payload.update` 未传 `depth`，默认深度做了关联填充。
处置：`update` 加 `depth: 0`，成功响应收敛为 `{id, owner:<裸 id>}`。断言从「不含某几个敏感键」（黑名单，会漏）改成「键集恰为 `['id','owner']` 且 `typeof owner==='number'`」（白名单 + 类型），一旦端点漏掉 `depth: 0` 立即红。`sites-clone.spec.ts` 正向用例同口径补断言克隆响应键集恰为 `['id','name']`。
实测：`71-response-shape-probe.log` → `assign_body={"success":true,"data":{"id":200,"owner":8}}`、`body_has_sessions=false`、`owner_type=number`。

### PROB-016（P2, DONE 2026-09-20 随批）`/api/sites/clone` 对不存在的 `sourceId` 落 500，且 `catch` 无日志

与 PROB-005 同一类缺陷（`Sites.ts` 的 `findByID` 未关默认抛错 ⇒ `NotFound` 被外层 `catch` 混成 `500 SITE_CLONE_FAILED`），差别是这里的 `catch` 连日志都不记，库异常在服务端不可查。发现方式：修完 assign 后按同类模式扫其余自定义端点。
处置：`disableErrors: true` + null → `404 SOURCE_NOT_FOUND`；`catch (err)` 记 `req.payload.logger.error({ err }, '[site-clone] 复制失败')` 后仍回统一 500 信封。Sites 集合没有审计 afterChange 钩子，故 PROB-006 那类 actor 问题在此不适用（已核实）。
测试：新增用例「负向：sourceId 指向不存在的站点 → 404 SOURCE_NOT_FOUND」，并用「调用前后本文件 TAG 命中站点数不变」断言没落下副本（源站名本身含 TAG，绝对值断言会被前面用例的留观记录干扰）。
实测：`71-response-shape-probe.log` `clone_nonexistent_http=404`；`72-e2e-final.log` 全量 60 用例 58 passed / 2 skipped。

**同轮未修的边界**：`/assign` 与 `/clone` 都是「先查后写」，若在两次调用之间记录被删，仍会落到 500 而不是 404。这是并发窗口不是逻辑死分支，两条路径都无数据破坏，改成事务属于另一量级的改动，未随批扩大（登记于本段，不另立 PROB；真要修请先立门禁）。

## 三、库侧遗留事实（R5）

本地 dev 库 `payload_migrations` 存在 `batch=-1` 的 `dev` 行，盘上基线迁移 `20260830_122948` 从未记账 ⇒ `payload migrate` 被 Payload 的数据丢失门禁拒跑。本批的 `drop_lead_activity` DDL 因此是经 `psql` 单事务执行其自身 `up` 落库的，**本地账本里没有这条迁移行**。这不是能靠重跑修掉的疏漏，而是「dev-push 库与迁移账本本就不一致」的既成事实，处置见 `release-prerequisites.md` §2(b)。
