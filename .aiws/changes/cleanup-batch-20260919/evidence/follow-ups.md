# 本批发现但未随批修的问题 · cleanup-batch-20260919

> 真值：`.aiws/issues/problem-issues.jsonl`（PROB-005..013 逐条含定位与证据）。本文件只补「为什么不在本批修」与「修的时候要注意什么」，从 `tasks.md §6` 移交至此。
> 日期：2026-09-19

## 一、为什么不随本批静默修

本批范围是「清理」（死模型、兜底、空目录、真值漂移、测试缺口）。以下三项会**改变对外行为或写入语义**（错误码映射、审计字段），按 `AI_PROJECT.md` §3.1 与 `agents.md` §8 属独立门禁 + 双审查对象，混进清理批会让回滚边界失真。已用 `test.fail` 用例固化，跑测即持续暴露，不会烂在账上。

## 二、逐条

### PROB-005（P2, OPEN）`/api/leads/assign` 对不存在 id 落 500，404 分支不可达

`apps/cms/src/collections/Leads.ts` 的 `findByID` 对不存在 id 抛 `APIError`，被端点外层 `catch` 统一转成 `500 LEAD_ASSIGN_FAILED` ⇒ 前面 `if (!lead)` 的 404 分支是死代码，同时违反「不把数据库异常原样抛前端」。
修的时候：按 `code`/`name` 区分 `APIError` 与真实库异常，别把 `catch` 拓宽成万能兜底。
暴露证据：`apps/e2e/tests/leads-assign.spec.ts` 用例「已知缺陷：不存在的 leadId 应返回 404 LEAD_NOT_FOUND（当前落到 500）」。

### PROB-006（P1, OPEN）端点分配丢失审计操作人

同文件里 `req.payload.update(...)` 未透传 `req` ⇒ `afterChange` 中 `req.user` 为空 ⇒ `lead_activities.actor=null`，分配动作查不到发起人（对照：REST 写入路径 `actor` 正常落 admin id）。
修的时候：透传 `req`（或显式 `user`），并确认不会把会话 token 带进响应；改完该 expected-fail 用例会转为「unexpectedly passed」而报错——那是预期的红，需同批把 `test.fail(true, …)` 摘掉。
暴露证据：`leads-assign.spec.ts` 用例「已知缺陷：经 /assign 端点的分配丢失审计操作人（actor 应为发起人）」。

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
残留（须 owner 拍板）：`4a7d807` 起该口令字面量已在 git 历史里；本机无 `pg_dump`，成功导出分支未在本机跑通（历史备份由装有 `pg_dump` 的机器产出）。

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

## 三、库侧遗留事实（R5）

本地 dev 库 `payload_migrations` 存在 `batch=-1` 的 `dev` 行，盘上基线迁移 `20260830_122948` 从未记账 ⇒ `payload migrate` 被 Payload 的数据丢失门禁拒跑。本批的 `drop_lead_activity` DDL 因此是经 `psql` 单事务执行其自身 `up` 落库的，**本地账本里没有这条迁移行**。这不是能靠重跑修掉的疏漏，而是「dev-push 库与迁移账本本就不一致」的既成事实，处置见 `release-prerequisites.md` §2(b)。
