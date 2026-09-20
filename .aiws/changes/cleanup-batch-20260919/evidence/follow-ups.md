# 本批发现的后续问题与处置 · cleanup-batch-20260919

> 真值：`.aiws/issues/problem-issues.jsonl`（PROB-005..022 逐条含定位与证据）。本文件只补「为什么当时不在本批修」与「修的时候要注意什么」，从 `tasks.md §6` 移交至此。
> 日期：2026-09-19（2026-09-20 两次更新：① PROB-005/006 随批修毕 + 登记并修毕 PROB-015/016；② 提交后独立审查轮登记 PROB-017..022，其中级联审计与恒真死兜底当场修掉）

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
处置：`update` 加 `depth: 0`，成功响应收敛为 `{id, owner:<裸 id>}`。断言从「不含某几个敏感键」（黑名单，会漏）改成白名单 + 类型；两条断言的钉法不同，别说成一样：`typeof owner === 'number'` 才是钉住 `depth: 0` 的那条（漏掉 `depth: 0` 时键集仍是 `['id','owner']`，但 `owner` 变回用户对象），键集断言 `['id','owner']` 钉的是「端点改为直出整条线索」这类回归。`sites-clone.spec.ts` 正向用例同口径补克隆响应键集恰为 `['id','name']` 的断言（该端点回的是自己构造的对象，故此条只防直出整份站点文档，不防深度问题）。
实测：`71-response-shape-probe.log` → `assign_body={"success":true,"data":{"id":200,"owner":8}}`、`body_has_sessions=false`、`owner_type=number`。

### PROB-016（P2, DONE 2026-09-20 随批）`/api/sites/clone` 对不存在的 `sourceId` 落 500，且 `catch` 无日志

与 PROB-005 同一类缺陷（`Sites.ts` 的 `findByID` 未关默认抛错 ⇒ `NotFound` 被外层 `catch` 混成 `500 SITE_CLONE_FAILED`），差别是这里的 `catch` 连日志都不记，库异常在服务端不可查。发现方式：修完 assign 后按同类模式扫其余自定义端点。
处置：`disableErrors: true` + null → `404 SOURCE_NOT_FOUND`；`catch (err)` 记 `req.payload.logger.error({ err }, '[site-clone] 复制失败')` 后仍回统一 500 信封。Sites 集合没有审计 afterChange 钩子，故 PROB-006 那类 actor 问题在此不适用（已核实）。
测试：新增用例「负向：sourceId 指向不存在的站点 → 404 SOURCE_NOT_FOUND」，并用「调用前后本文件 TAG 命中站点数不变」断言没落下副本（源站名本身含 TAG，绝对值断言会被前面用例的留观记录干扰）。
实测：`71-response-shape-probe.log` `clone_nonexistent_http=404`；`72-e2e-final.log` 全量 60 用例 58 passed / 2 skipped。

**同轮未修的边界**：`/assign` 与 `/clone` 都是「先查后写」，若在两次调用之间记录被删，仍会落到 500 而不是 404。这是并发窗口不是逻辑死分支，两条路径都无数据破坏，改成条件更新/同事务重读属于另一量级 ⇒ 已登记 **PROB-019**（见下），修之前先立门禁。

### 以下六条由 2026-09-20「提交后独立审查轮」提出（逐条经主 session 回码核实），全部 OPEN

### PROB-017（P3, OPEN）`/assign` 的 `leadId` 只校验正整数、不校验上界

`apps/cms/src/collections/Leads.ts:152`。传 `2147483648`（越出 Postgres int4）时 `findByID` 抛的是校验错而不是 `NotFound`，`disableErrors` 管不到 ⇒ 仍回 `500 LEAD_ASSIGN_FAILED`。当时没被测试拦住的原因：404 用例用的是库内绝不会出现的正常位 id。
为什么不在本批修：要修就得给 `/assign`、`/clone`（以及后续端点）共用一套含上界的 id 校验，属输入契约设计而非清理，做一半会留下两种口径。
修的时候注意：先决定语义——「越界的 id」应当是 400（参数非法）还是 404（必然不存在），别顺手两者都写；`61-assign-500-branch-probe.log` 目前只被当作「500 分支未死」的证据，修完后该探针要改成断言 400/404。

### PROB-018（P2, OPEN）负责人被清空记成 `type=assigned` / `detail=已分配跟进人`

`apps/cms/src/collections/Leads.ts` 的 `afterChange` 只按 `prev.owner !== lead.owner` 分流，owner 由有变无也进 assigned 分支 ⇒ 成员被移除、用户被删除这类「清主」在线上看板上写着「已分配跟进人」，只有 `meta.owner=null` 能区分。
为什么不在本批修：`LeadActivities.ts:50-56` 的 `type` 无 `unassigned` 档，加档位＝改 Postgres enum ⇒ 按 AGENTS.md §7 属 schema 演进，要单独迁移与双审查，不混进清理批。
修的时候注意：本批已把这类写入的**审计发起人**补上（`Memberships.ts`/`Users.ts` 透传 `req`），所以修标记时不必再动 req 传参；`leads-assign.spec.ts` 的清主用例目前按 `meta.owner===null` 选行并注释声明不为 `assigned` 标记背书，加档后要改成按类型选行。

### PROB-019（P2, OPEN）`/assign` 与 `/clone` 的读后写竞态仍回 500

见上一段。修的时候注意：条件更新（`where` 带 id 且判 0 行）或同事务重读都改变事务边界，需要先确认 Payload 本地 API 的事务透传行为，别用「捕获异常再判类型」的方式假装修好。

### PROB-020（P2, OPEN）`access.ts` 三处 `findByID` 未关默认抛错却写了 null 分支

`apps/cms/src/access.ts:112-113`（`membershipScopedManage` 的 `m?.project`）、`:118-119`（`isProjectMemberOf` 的 `if (!user) return false`）、`:141-142` 与 `:152`（`leadScopedWrite` 的 `lead?.project` / `String(lead?.owner)`）：`findByID` 不传 `disableErrors` 时对不存在的 id 必抛 `NotFound` ⇒ 这些可选链/null 分支恒不可达，是 AGENTS.md §4 禁止的死兜底。安全性未削弱（抛错即拒绝，fail-closed 成立），失真的是状态码（越权探测不存在的 id 得到 500 而非 403/404）。
为什么不在本批修：改的是权限判定路径，任何行为变化都要独立门禁 + C6 那类越权用例重跑，清理批不承担。
修的时候注意：这三处应统一为「查不到即拒绝（返回 false）」而不是照搬端点里的 404 口径——access 函数返回 false 已是拒绝语义，抛错只会把拒绝伪装成服务器故障；同时别把 `isProjectMemberOf` 里对 `users` 的查询与对 `memberships` 的 `find` 混为一谈（后者本来就不抛）。

### PROB-021（P3, OPEN）六处 `/api/v2/*` 的 `catch` 静默回 500 不留日志

`apps/cms/src/app/api/v2/content/articles/route.ts:124`、`api/v2/reminders/run/route.ts:21`、`api/v2/webhooks/chatwoot/route.ts:83` 与 `:117`、`api/v2/stats/leads/route.ts:213`、`api/v2/leads/route.ts:122`。本批给 `Leads.ts:248`、`Sites.ts:130` 补了 `logger.error`，于是仓库变成「两处留痕、六处不留」的半套口径。
为什么不在本批修：一次扫全才有意义，逐点补会让口径漂移；且 `webhooks/chatwoot` 的 catch 承担「不向外部回调方暴露内部细节」的职责，补日志时要确认不把对方 payload 整体打进日志。
修的时候注意：统一走 `req.payload.logger.error({ err }, '[tag] ...')`，别引入 `console.error`（`Leads.ts` 的 `afterChange` 里就还有一处 `console.error`，顺手一起收）。

### PROB-022（P2, OPEN）两个自定义端点手写信封，未复用 `lib/envelope.ts` 的 `ok/err`

`apps/cms/src/collections/Leads.ts:138-252` 与 `Sites.ts:34-134` 约 22 处 `Response.json({success…})` 直写，绕开了 `apps/cms/src/lib/envelope.ts:39-49` 的 `ok/err`（那里同时承载 CORS 白名单与本批做的 fail-fast）⇒ 信封字段、错误码风格、响应头三条路径两份实现，属 §4 禁止的双写。
为什么不在本批修：复用 `ok/err` 会一次性改变这两个端点全部响应的头与状态码语义（包括 `Allow-Origin` 是否出现），需独立验证与双审查；另外这两条路径本身不在 `/api/v2/*` 前缀下（AGENTS.md §6 的对外统一前缀只约束公开接口），立项时要先决定是「留在后台命名空间但复用信封」还是「迁 v2」。
修的时候注意：`/api/leads/assign` 的失败分支目前带自定义 code（`LEAD_NOT_FOUND` 等），迁到 `err()` 时保持 code 不变，否则本轮刚加的 404 断言会以「code 变了」而非「行为变了」的方式红。


## 三、库侧遗留事实（R5）

本地 dev 库 `payload_migrations` 存在 `batch=-1` 的 `dev` 行，盘上基线迁移 `20260830_122948` 从未记账 ⇒ `payload migrate` 被 Payload 的数据丢失门禁拒跑。本批的 `drop_lead_activity` DDL 因此是经 `psql` 单事务执行其自身 `up` 落库的，**本地账本里没有这条迁移行**。这不是能靠重跑修掉的疏漏，而是「dev-push 库与迁移账本本就不一致」的既成事实，处置见 `release-prerequisites.md` §2(b)。
