# Spec Review · cleanup-batch-20260919

> 轴：Spec（需求/范围/流程一致性）。评审对象：工作树 vs HEAD(c9cbc2d)。日期：2026-09-19
> 方式：只读复核（`git diff` / `git status` / `grep` / 读文件 / `sha256sum` / 读 `.aiws/tmp` 日志工件）。未连库、未跑 build/e2e、未启服务、未读 `apps/cms/.env` 与 `.aiws/secrets/**`。

## 结论

**有 HIGH blocker，不可直接进入 `aiws verify-bc` / finish。** 计数：**HIGH 2 / MEDIUM 5 / LOW 5**。

5 项目标（真值收敛、删死模型、CORS 去兜底、结构清理、e2e 补 3 场景）**代码实体全部真实交付**，且未越界改动 Out of Scope 文件；HIGH 全部集中在「产物声称 vs 工作树/工件不符」这一类：①`verify-before-complete.md` §E 声称已修的凭据文件原子写没实现；②勾选的 `aiws validate`/`--strict` 通过声明不覆盖当前工作树（真值文件在最后一次 sync 之后又被改）。MEDIUM 集中在「本批自己要求改正的断言只改了一部分文档」与「两项 In Scope 子交付未落地」。均为文档/流程级，**不需要改业务代码**即可清完。

## 逐条核对（tasks.md 勾选 → 证据）

| 项 | 声称 | 实际证据（文件:行 / 命令输出） | 判定 |
|---|---|---|---|
| 0.1 阅读并遵守三份真值 | 遵守 | 无反证；两份被改真值的编辑均落在托管块之外：`REQUIREMENTS.md:3-12`（块）vs 改在 `:27+`；`AI_WORKSPACE.md:45-206`（块）vs 改在 `:31-40` | ✅ |
| 0.2 `aiws validate .` 起点+交付前各一次 | 跑过 | `.aiws/tmp/aiws-validate/` 唯一工件 `20260825-153731223Z.json`（8-25），本批无工件 | ❌ 见 H2 |
| 0.3 真值变化后 `change sync` | 跑过 | `metrics.json` `truth_sync` ×4（末次 `2026-09-19T12:11:27Z`）+ `.aiws/tmp/change-sync/20260919-{094935,115828,120101,121127}Z-*.json` | ⚠️ `AI_WORKSPACE.md` 在末次 sync 后再被改（见 H2） |
| 0.4 proposal 主索引绑定 | 填齐 | `proposal.md:26-32`：`Change_ID`/`Req_ID`/`Problem_ID`/`Contract_Row`/`Plan_File`/`Evidence_Path` 六项俱全 | ✅ |
| 0.5 计划绑定与 proposal 一致 | 一致 | `.aiws/plan/2026-09-19-cleanup-batch.md:7-16` 与 `proposal.md:26-32` 逐字段同值 | ✅ |
| 1.1 REQUIREMENTS 验收按实测补齐 | REQ-0001/0002 移已完成 + 勾选 | `REQUIREMENTS.md:35-63` REQ-0001（6 条 `[x]`）、`:65-93` REQ-0002（7 条 `[x]`）；勾选态与 `.aiws/requirements/requirements-issues.jsonl` 的 `Impl_Status=DONE` 一致 | ⚠️ 3 条勾选只有代码证据、无自动化测试（见 M5 注） |
| 1.2 同步 `requirements-issues.jsonl` **与** `problem-issues.jsonl` | 两份都同步 | `problem-issues.jsonl` 9 行 ✓；`git status --porcelain .aiws/requirements/` 只列 `CHANGELOG.md` ⇒ **`requirements-issues.jsonl` 一字未改**，其 `Evidence` 仍指 8-26 旧归档、`Updated_At` 仍为 8-25/8-31、`Tests` 仍写不存在的 `pnpm --filter @juece/e2e exec playwright test` | ❌ 见 M4 |
| 1.3 CHANGELOG 删模板行 + 追加 | 完成 | diff：`-\| YYYY-MM-DD \|…` → `+\| 2026-09-19 \| 同步 REQUIREMENTS.md 真值…`；行文与 `REQUIREMENTS.md` 实际改动一致（13 条勾选 ✓、双 `## Backlog` 合并 ✓、两条 ✓ 前缀 ✓、各 1 行证据指针 ✓） | ✅ |
| 1.4 删 `PROB-000` 模板种子行 | 删后台账 9 行全真 | diff `-1/+9`：首行 `PROB-000（示例问题（模板种子）…）` 已被 9 条真实记录替换 | ✅ |
| 2.1 真值收敛 | 合并 + 迁移区 | 同 1.1 | ✅ |
| 2.2 CORS 配置先行（三处） | `.env.example`/`cms-run.sh`/`docs/08` | `apps/cms/.env.example:9`（三站 + `localhost:4321` + `127.0.0.1:4321`）✓；`scripts/cms-run.sh:11` 的 `: "${PUBLIC_CORS_ORIGINS:?}"` 位于 `docker run`(`:26`) 之前 ✓、`:19` 写入 `cms.env` ✓；`docs/08-deployment.md:101` 新增条目 ✓ | ✅（注释语义另计 M1） |
| 2.3 CORS 去兜底 | 无默认、无 dev 分支、单路径 | `apps/cms/src/lib/envelope.ts:3-22`：唯一来源 `process.env.PUBLIC_CORS_ORIGINS` → `split/trim/filter` → 空集 `throw`；`if (!origin) return null` 在 throw 之后，无任何 dev 判断；全仓 `DEFAULT_CORS_ORIGINS` 零代码引用（仅 `.aiws` 文档留痕） | ✅ |
| 2.4 死模型删除 + 迁移 | 删字段、再生成类型、drop 迁移 | `git diff Leads.ts` 删 `activity` 数组字段块 33 行（旧 `:378-410`，hunk `@@ -378,33 +378,0 @@`）；`grep activity apps/cms/src/payload-types.ts` → 0 命中；新增 `migrations/20260919_093340_drop_lead_activity.ts`(+`.json`) 并在 `migrations/index.ts:2,10-14` 注册；**新 `.json` 与基线 `.json` 深比仅 2 处差异：`REMOVED tables.public.leads_activity` + `REMOVED enums.public.enum_leads_activity_type`**（纯减法，无夹带） | ✅ |
| 2.5 注释修正 | 改指实际实现 | `Leads.ts:64-65` 现指向「本 afterChange 钩子即唯一写入路径…模型见 `collections/LeadActivities.ts`」；`grep -rn leadActivity apps/cms` → 0 命中（`src/lib/` 确无 `leadActivity.ts`） | ✅ |
| 2.6 删 6 个空目录 | 六目录清除 | `ls`：`apps/cms/src/components`、`src/app/api/dev-seed`、`src/app/api/v2/sites/clone`、`src/app/dashboard`、根 `src/` 均已消失；`apps/cms/scripts` 按 In Scope（`proposal.md:81`）重建且非空（仅 `create-e2e-admin.ts`）；`git ls-files` 这些路径 0 文件 ⇒ 未删任何入库文件 | ✅ |
| 2.7 reminders spec | 判重/落账/只读/鉴权 | `apps/e2e/tests/reminders.spec.ts`：`:122-160` due+sla 各 1 条（`created>=2` + `notices` 恰 2 + `dueAt` 语义逐项核对）、`:162-177` 第二次 `created===0` 且两表不翻倍、`:179-194` 5 字段与扫描前逐项等值 + 前置成立性自检、`:196-198` 未登录 403；`.aiws/tmp/.../e2e-final-2.log:30-33` 四例 `ok`，行号（122/162/179/196）与当前文件完全一致 | ✅ |
| 2.8 leads-assign spec + 2 条 expected-fail | 正向 + 负向 + 固化真实缺陷 | 9 用例（`:105,138,146,150,160,166,176,185,197`）；`e2e-final-2.log:21-27` 七例 `ok`、`:28-29` 两例 `x`（expected-fail） | ⚠️ 台账/任务的行号引用（182/194）已漂移 3 行，见 L1 |
| 2.9 sites-clone spec | 可查/白名单/重置/跨项目/负向/自清 | 7 用例（`:96,128,146,170,178,184,192`）与 `e2e-final-2.log:52-58` 行号一致；`COPIED_FIELDS`(`:41`) 逐项与源站比对、`status=draft`/`isTemplate=false` 重置断言(`:112-113`)、跨项目落盘(`:146-168`)、afterAll 删项目后按 `project` 断言 0 站 + 克隆体 `404` 实读(`:125`) | ✅ |
| 2.10 本地 `.env` 补齐 | 已补 | 禁读 `apps/cms/.env`（不在评审范围）；旁证：C5 五例与三新 spec 需白名单命中才可能全绿 | ⚠️ 无法核实 |
| 2A.1 analysis 等效产物 | INTAKE 落盘 | `.aiws/plan/2026-09-19-cleanup-batch.intake.md` 存在（含决策树/实测事实） | ✅ |
| 2A.2 不用 patch 草案 | 记录决定 | `.aiws/changes/cleanup-batch-20260919/patches/` 与 `analysis/` 均为空目录（仅目录骨架） | ✅ |
| 2A.3 双审查落盘 | 两份 | `review/quality-review.md`(24.6 KB) + 本 `review/spec-review.md`；schema 迁移按 `agents.md` §8 走双审查 ✓ | ✅（本报告补齐后即闭合） |
| 3.1 `pnpm --filter cms build` | `exit=0`/11.8s/10-10/无 cron 输出 | `.aiws/tmp/cleanup-batch-20260919/cms-build.log`：`✓ Compiled successfully in 11.8s`、`Finished TypeScript in 1616ms`、`✓ Generating static pages … (10/10)`、路由表含 `ƒ /api/v2/reminders/run` 且**无** `/api/dev-seed`、`/dashboard`；另有 `cms-build-2.log`（20:10，最终态复跑） | ✅ |
| 3.2 e2e 全量两次一致 | 58/56/2 + 2 个 `x` | `e2e-final.log:7,68-69`（19:16）与 `e2e-final-2.log:69`（20:17）均 `Running 58 tests using 1 worker`→`2 skipped`/`56 passed`；只有后者行号与当前 spec 一致 ⇒ 最终态确有通过记录 | ✅ |
| 3.3 psql 计数 0 + 零残留 | 表已删、造数 0 | 需连库 ⇒ 本审查禁止。旁证：`quality-review.md:14-15` 独立 `SELECT` 证实 21 张表仅余 `lead_activities`、`pg_type` 无该枚举；三个 spec 的 afterAll 零残留断言在 `e2e-final-2.log` 中为 `ok` | ⚠️ 无法独立核实 |
| 3.4 负向 CORS（语义修正） | 首个请求 500、无堆栈 | `.aiws/tmp/.../cors-failfast-dev.log:25-33`：`Pulling schema from database ✓` → 服务已 Ready → 栈 `Error: PUBLIC_CORS_ORIGINS 未配置或为空 … at allowedOrigin(envelope.ts:14) ← corsHeaders(:27) ← err(:47) ← GET(app/api/v2/content/articles/route.ts:125)`；`cors-failfast-response.txt` 为 0 字节 ⇒ **进程启动成功、错误只在请求期**，本条陈述为真 | ✅ |
| 3.5 `aiws validate .` && `change validate --strict` 均通过（含「无 scope 越界」） | 通过 | `metrics.json` 末三条 validate：`12:00:14Z ok:true`、`12:01:13Z ok:true`、`12:11:33Z ok:true`，但每条均 `check_evidence:false`、`check_scope:false`、`allow_truth_drift:false`；仓库级 validate 无本批工件；且 `AI_WORKSPACE.md` 在 `12:11:27Z` sync 之后（mtime 20:14）再被改，当前 sha `0fcb28ff…` ≠ 基线 `f789d61f…` | ❌ 见 H2 |
| 3.6 AGENTS.md §9 逐条过 | 全过 | 独立复核：最大新文件 `reminders.spec.ts` 236 行、`Leads.ts` 380 行（≤1000 ✓）；`git status` 不含任何 `package.json`/`pnpm-lock.yaml` ⇒ 零新依赖 ✓；业务字段 camelCase（`nextFollowUpAt`/`assigneeId`/`sourceId`）✓；新断言全走统一信封且 `cmsRest.ts:156-164` 硬断「失败信封不带 data」「message 不含堆栈列号」✓；无新对外 API（`/api/v2/*` 面未变）✓；线索仍在自有 Postgres ✓。「无兜底」仅对本批两个目标成立（`payload.config.ts:242` 的 `DATABASE_URI \|\| ''` 仍活，已登记 PROB-008，符合 design D-5 的范围纪律） | ✅ |
| 4.1 证据落 tmp | 落盘 | `.aiws/tmp/cleanup-batch-20260919/` 22 个工件（build/dev/e2e 日志、负向响应、探针脚本） | ✅ |
| 4.2 生成持久证据 | 生成 | `evidence/verify-before-complete.md`（20:08，`§A` 10 行命令 + `§B` 自检 + `§C` 数据侧 + `§D` 本地/线上分层 + `§E` triage + `§F` 残留风险）；`REQUIREMENTS.md`/`CHANGELOG.md` 的指针因此不再是死链（quality-review M4 已消） | ✅ |
| 4.3 双审查 + HIGH triage 收敛 | 逐条处置 | §E 十项「已在本批修掉」中：1(design/proposal/plan R1)✓、2(.env.example/R2 语义)⚠️部分、3(AI_WORKSPACE 入口)✓、4(AI_PROJECT 回退 + PROB-009)✓（哈希链可证，见下）、5(slug like 恒真断言→按 id 实读 404)✓`leads-assign.spec.ts:99-102`、7(REQUIREMENTS 治理注记)✓`:31`、8(台账 DONE/新增)✓、9(tasks 3.1-3.4 改实测/勾 2.7-2.9/§6 增补)✓、10(不粉饰迁移通道)✓；**6（凭据文件原子写）❌ 未实现** | ❌ 见 H1 |

### 关键声明的独立取证（正面）

- **`AI_PROJECT.md` 改了又回退**（PROB-009 / `proposal.md:93`）：`.ws-change.json` 的 `sync_events` 给出完整哈希链——基线 `41ef47fd…` →（11:58:28）`8dee5eee…`（那次 .csv→.jsonl 手改）→（12:01:01）回到 `41ef47fd…`；当前盘上 `sha256(AI_PROJECT.md)=41ef47fd…` 且 `git status` 未列该文件 ⇒ **回退为真，Out of Scope 未被破坏**。
- **迁移 `down` 是忠实重建**：`20260919_093340_…ts:11-23` 与基线 `20260830_122948.ts:5,19-27,294,334-335` 逐对象镜像（枚举 4 值、5 列、FK `ON DELETE cascade`、`_order`/`_parent_id` 两个索引，名称一致）。
- **变更绑定合规**：当前分支即 `change/cleanup-batch-20260919`（`git rev-parse --abbrev-ref HEAD`），与 `main`/`c9cbc2d` 同点，满足 `agents.md`「变更绑定 change/<id>」。
- **`playwright_test_cmd` 现为可跑命令**：`AI_WORKSPACE.md:31` `pnpm --filter e2e test` ↔ `apps/e2e/package.json:2` `"name":"e2e"` + `"scripts.test":"playwright test"`；`build_cmd`/`astro_build_cmd`/`db:up` 亦对得上根 `package.json` 脚本。

## 发现

### HIGH

**H1 · 凭据文件「原子写」被声明为已修，代码里没有**
- 位置：`.aiws/changes/cleanup-batch-20260919/evidence/verify-before-complete.md:59`（§E 第 6 条：「`create-e2e-admin.ts` 非原子写、可能覆盖既有账号条目 → 先校验条目唯一性、临时文件 + rename 原子落盘」）↔ `apps/cms/scripts/create-e2e-admin.ts:79-97`。
- 问题：`writeSecrets()` 仍是 `mkdirSync` + `writeFileSync(SECRETS_FILE, JSON.stringify(body))` 一步直写；`node:fs` 只 import 了 `existsSync, mkdirSync, readFileSync, writeFileSync`（`:16`），**全文件无 `renameSync`、无临时文件**。条目唯一性校验确实做了（`:120-122` >1 即抛错），但「临时文件 + rename 原子落盘」这一半没做。
- 影响：这是 §E「已在本批修掉」清单里的虚假完成声明；实际失败模式（写一半中断 → gitignored 凭据文件损坏；顶层非 interface 键被整体重写丢弃）仍在。凭据文件是唯一登录入口，损坏后 `pnpm --filter e2e test` 会整体退化为 skip（quality-review M6），验证通道被静默掏空。
- 建议：二选一——把 §E 第 6 条改成「仅做了条目唯一性校验，原子写另案」并同步 `tasks.md §6` 登记一条 PROB；或按声明补上 temp+rename 后复跑 build（不需要改任何产品代码）。**当前状态不得进 `verify-bc`**（证据文件本身失真）。

**H2 · 勾选的 validate 门禁不覆盖当前工作树；仓库级 validate 无工件**
- 位置：`tasks.md:53`（`- [x] 3.5`，「期望：均通过，无 scope 越界」）+ `evidence/verify-before-complete.md:17`（§A 第 8 行：「`✓ aiws validate` / `ok: change validated`」，证据列写「本文 §E」而 §E 并无该输出）。
- 取证：① `.aiws/tmp/aiws-validate/` 唯一工件是 `20260825-153731223Z.json`（8-25），本批**没有**仓库级 validate 工件（`tasks 0.2` 亦勾 `[x]`）；② `metrics.json` 末次 validate 为 `2026-09-19T12:11:33Z`（本地 20:11:33），而 `AI_WORKSPACE.md` mtime 20:14、`sha256=0fcb28ff…`，`synced_truth_files.AI_WORKSPACE.md.sha256=f789d61f…` ⇒ **最后一次 sync/validate 之后真值文件又被改**，在 `allow_truth_drift:false` 下当前树未经该门禁；③ 每条 validate 的 `check_evidence:false`、`check_scope:false` ⇒ 「无 scope 越界」不是这次 strict validate 证明的东西（quality-review L4 已指出门禁开关未开）。
- 影响：`agents.md` 把「提交前 `aiws validate .`」与「review 完成 → `aiws verify-bc`」当硬门禁；勾了 3.5 而工件不支持，等于把门禁留成空签。真值漂移一旦带着未 sync 的文件进入 commit，`aiws change validate --strict` 会在 finish 时才炸（或被人用 `--allow-truth-drift` 绕过）。
- 建议：所有编辑定格后重跑 `aiws change sync` → `aiws validate .` → `change validate --strict`，把三条命令的**实际 stdout 尾部**贴进 §A 第 8 行并留 tmp 工件；若 `--strict` 能开 `--check-evidence/--check-scope`，开一次并把结果一并留档（否则在 3.5 明确写「scope/evidence 未由工具校验，人工核对见本审查」）。

### MEDIUM

**M1 · 「启动期 vs 请求期失败」的语义修正只落了一半文档，一处仍写在入库的部署脚本里**
- 位置（仍声称「启动即抛错/启动失败」，与工作树矛盾）：
  - `scripts/cms-run.sh:10` 注释「（CMS 启动也会因缺该变量抛错）」——**入库产物**，且被同批日志直接反证（`cors-failfast-dev.log:25-28` 显示进程已 `Ready`）。
  - `proposal.md:127` 验证计划「负向启动立即抛错」——与同文件 `:99`/`:107`（已改成「首个 `/api/v2/*` 请求 500」）自相矛盾。
  - `.aiws/plan/2026-09-19-cleanup-batch.md:63,66`「期望启动即抛错」「负向启动失败点明确」。
  - `.aiws/goals/G-001-cleanup-batch.md:16`「缺失即启动抛错」、`:44` 完成判据 3「CMS 启动即抛错」——该判据按当前实现**不可能满足**。
  - `.aiws/changes/.../tasks/tasks.jsonl:27`（task-27）同上。
  - `.aiws/issues/problem-issues.jsonl` **PROB-002 的 Notes**：「再删默认并缺 env 即启动抛错」——台账 DONE 行内的语义仍是错的。
  - `evidence/dev-log.md:123,176` 保留「缺失即启动失败」「启动即抛错」，且 `:123` 引用的是已被改掉的旧 `.env.example` 注释文本。
- 影响：`evidence:55` 把这条列为「已修（[S6/H6]）」，但只改了 `.env.example` + proposal R2 两处；读者从 goals/台账/部署脚本会得到相反结论（以为容器起不来→会在 docker 层面排查，而真实症状是表单/内容接口 500）。
- 建议：以 `envelope.ts` 的实际行为为唯一口径，一次性扫齐上列 7 处（含 `cms-run.sh` 注释与 PROB-002 Notes），措辞统一为「部署侧 `cms-run.sh` 的 `:?` 在 `docker run` 前终止；进程内为**首个 `/api/v2/*` 请求 500**（`err()` 亦会抛，故失败响应不带信封、无堆栈）」。

**M2 · goals 产物仍写着「删表迁移将在下次生产部署自动生效，属既有事实」**
- 位置：`.aiws/goals/G-001-cleanup-batch.md:38`（「Payload 未关 `migrations.autoRun`，服务启动即跑待执行迁移 —— 删表迁移将在下次生产部署自动生效，属既有事实」）。
- 问题：这正是 quality-review H2 判定为错、并被本批在 `design.md:34`、`proposal.md:51,106`、`plan:53`、`tasks §5.5` 全部改写的那条断言；`migrations.autoRun` 在 payload 3.88 里根本不存在（quality-review:41）。goals 是本批声明的协同产物（`proposal.md:139` 把它列进 Evidence 清单），且未跟踪 → 会随本批入库。
- 影响：唯一还写着「生产会自动跑破坏性 DROP」的本批产物，方向危险：运维可能因此不做 tasks §5.1 的行数核实与备份，或在相反方向误判发布风险。
- 建议：把 `:38` 整条改写成与 `design.md:34` 同口径（生产无 `prodMigrations` ⇒ 不会自动执行；本地账本亦不含该迁移行），并同步 `:44` 判据。

**M3 · 两项 In Scope 子交付未落地（部署侧发布前置说明 / AI_WORKSPACE 启动前置）**
- 位置：`proposal.md:77`「`docs/08-deployment.md` - 生产关键项补 PUBLIC_CORS_ORIGINS **与发布前置说明**」↔ 实际 diff 只加了 `:101` 一条 CORS bullet；`grep leads_activity|payload migrate docs/08-deployment.md` → 0 命中；§7 发布清单第 4 步仍是「迁移（若有）+ 启动」（`:148`），`:141` 仍是 dev-push 口吻。另：`proposal.md:78` 认领的 `AI_WORKSPACE.md` 入口补齐已做，但 quality-review 列为「本批必修（一行）」的 M2（在启动前置里点名 `PUBLIC_CORS_ORIGINS`）未做——`grep PUBLIC_CORS_ORIGINS AI_WORKSPACE.md` → 0 命中，而 `health_check`(`:33`) 现在间接依赖该变量。
- 影响：In Scope 声称的「发布前置」只存在于 `tasks.md §5`（change 目录内，运维不会去翻）；照 `AI_WORKSPACE.md` 起服务的新机/新人会遇到「health 永不转绿」且文档没指路。
- 建议：`docs/08-deployment.md` §7 第 4 步补一行「本批 `20260919_093340_drop_lead_activity` 在生产**不会自动执行**，须在维护窗口显式跑（并先核 `leads_activity` 行数 + `payload_migrations` 记账 + `scripts/backup.mjs` 备份）」；`AI_WORKSPACE.md` 的 `start_cmd`/`e2e_prerequisites` 点名 `PUBLIC_CORS_ORIGINS`。

**M4 · 需求合同行未同步：`tasks 1.2` 勾了但文件没动，且合同里的验证命令不可跑**
- 位置：`tasks.md:22`（1.2 声称同步两份 jsonl）、`proposal.md:134`（声称回填 `Updated_At` 与 Evidence 路径）↔ `.aiws/requirements/requirements-issues.jsonl` 无 diff（`git status` 只列 `CHANGELOG.md`）。现状：`REQ-0001.Evidence=.aiws/changes/phase1-skeleton/evidence/…`、`REQ-0002.Evidence=.aiws/changes/archive/2026-08-26-lead-followup-reminders/evidence/…`、两条 `Tests` 均为 `pnpm --filter @juece/e2e exec playwright test`。
- 问题：①`REQUIREMENTS.md` 现在指向本批证据文件、合同行指向旧归档 ⇒ 同一事实三处不一（本批 Goals 第一条就是「三处不矛盾」，`design.md:16`）；②`@juece/e2e` 这个包在本仓不存在（`apps/*/package.json` 只有 `astro`/`cms`/`e2e`），本批已为此改掉 `AI_WORKSPACE.md` 的入口，却在 `proposal.md:120`、`plan:62`、`intake:77`、`goals:43,55`、`tasks.jsonl:25` 与合同 `Tests` 字段里留着同一条不可跑命令。
- 建议：给合同两行补 `Updated_At` + 本批 `Evidence` 路径（或明确「沿用 8-26 归档证据」并写在哪一条上），并把 `Tests` 改成 `pnpm --filter e2e test`；顺带扫掉上面列出的 6 处旧命令。

**M5 · `tasks.md` 自称的机读数据源已失真（勾选与状态两套账）；另有 3 条勾选验收无自动化证据**
- 位置：`tasks.md:1`「Data source: `tasks/tasks.jsonl` — machine-readable task list」↔ `.aiws/changes/.../tasks/tasks.jsonl` 实为 **36 行、全部 `status:"pending"`**、`verification:[]`，而 `tasks.md` 有 **44 条**（31 `[x]`/13 `[ ]`，缺 §5.4/5.5 与整个 §6）。同一清单两处真值、且其中一处全是「未做」。
- 附带（勾选强度）：`REQUIREMENTS.md:58`（DB 异常返回 `LEAD_CREATE_FAILED`）、`:60`（`/articles/[slug]` 渲染已发布文章）、`:90`（看板展示待办提醒数量/清单）三条被勾为「按实测」，但本批 e2e 与既有 spec 均未覆盖：`grep -rn "articles/" apps/e2e/tests` 只有 REST 详情断言、无任何 `LEAD_CREATE_FAILED` 触发用例。代码侧证据是有的（`app/api/v2/leads/route.ts:123`、`components/Dashboard.tsx:63,209` 真的在做 `reminder-notices` 计数），所以这不是虚构交付，而是**「实测」一词超出了实测范围**——`REQUIREMENTS.md:63,:93` 的 hedge（「不代表复验已完成」）与 `tasks.md:21`「按实测勾选」互相抵消。
- 建议：要么把 `tasks.jsonl` 同步为唯一权威并回填状态，要么删掉 `tasks.md:1` 的 data-source 声明（禁止双写口径也应适用于自己的台账）；把上述 3 条勾选注明「代码核实 / 沿用 8-26 归档证据」，与本轮真跑过的 10 条区分开。

### LOW

**L1 · expected-fail 用例的行号引用漂移**：`problem-issues.jsonl` PROB-005/006、`tasks.md:74,75`、`quality-review.md:128` 均写 `leads-assign.spec.ts:182/194`，当前实际是 `:185`/`:197`（`test.fail` 在 `:186`/`:198`）——上一轮 `quality-review.md` 的 M3 修复插入 `:99-102` 后整体位移，`e2e-final-2.log:28-29` 可证。另 PROB-008 Notes 写 `payload.config.ts:240`，实际 `DATABASE_URI || ''` 在 `:242`（`:240` 是 `postgresAdapter({`）。建议台账引用**测试标题**而非行号。

**L2 · PROB-009 的缺陷范围写小了**：只登记 `AI_PROJECT.md` 的 5 处 `.csv` 漂移，但 `REQUIREMENTS.md:12`（同一类 `AIWS_MANAGED` 块，块范围 `:3-12`）也写着 `requirements/requirements-issues.csv` 与 `tools/requirements_contract.py validate`。走 `aiws update` 修 `ai-project:core` 不会连带修 `requirements:contract`。建议 PROB-009 的 Notes 补上该处，避免「修完仍留一处假路径」。

**L3 · 未声明的范围外编辑：memory-bank 夹带 8-31 的无关条目**：`.aiws/memory-bank/.index.yaml` +11 行新增 `decision://analysis/chatwoot-offline`，正文 `.aiws/memory-bank/decision/analysis/chatwoot-offline.md` mtime **2026-08-31 12:46**，与本清理批无关，且未出现在 `proposal.md` In Scope。属工作流产物（非产品代码），但会随本批提交并带 `disclosure: boot`（影响下次会话注入）。建议拆独立 chore 提交或在 handoff 说明无关性。

**L4 · 证据指针指向「修正前」那一次跑测**：`verify-before-complete.md:12-13` 的证据列写 `e2e-final.log`（19:16，对应改断言之前的 spec 行号），最终态记录在 `e2e-final-2.log`（20:17）。另 §F-4（`:85`）称「本轮实测未设 `REMINDER_CRON_EXPRESSION`」，与 `dev-log.md:522,581,677-678` 记录（多次跑测显式设 `0 0 1 1 *`）冲突。建议指针改指 `-final-2`，并把 cron 条件按 run 分别写清。

**L5 · 迁移 SQL 的描述与交付形态不符**：`proposal.md:51` 与 `plan:46` 写「`DROP TABLE IF EXISTS leads_activity`」，实际 `20260919_093340_…ts:5-6` 是 `DROP TABLE "leads_activity" CASCADE; DROP TYPE …`（无 `IF EXISTS` ⇒ 非幂等，重复执行会报错；CASCADE 连带索引/约束，覆盖面与描述一致）。另 `plan:45` 承诺的 `resolveCorsOrigins()` 函数名未出现（逻辑内联进 `allowedOrigin()`，行为等价）。建议 proposal 按实际 SQL 复述，避免下一次部署照抄「可重复执行」的假设。

## 范围外改动 / Out of Scope 未被动

Out of Scope **全部未被触碰**（逐条核 `git status --porcelain` + `git diff`）：

| Out of Scope 项 | 核实结果 |
|---|---|
| `apps/astro/**` | 改动集内 0 文件 ✓ |
| `reference/**` | 0 文件 ✓ |
| `collections/{LeadActivities,ReminderRules,ReminderNotices}.ts` | 0 文件 ✓（提醒规则双语 label 仍完整，`:46-109`） |
| `apps/cms/src/payload.config.ts` | 0 文件 ✓，`DATABASE_URI \|\| ''` 原样留在 `:242`（PROB-008 另案，符合 design D-5 的范围纪律） |
| `AI_PROJECT.md` | **哈希等于基线** `41ef47fd…`（`.ws-change.json` sync_events 记录「改 → 回退」全过程）✓ |
| `infra/**`、`docker-compose*.yml`、`Dockerfile.cms` | 0 文件 ✓ |

In Scope 认领过的越界（`apps/cms/scripts/create-e2e-admin.ts`、`apps/e2e/helpers/cmsRest.ts`、`apps/e2e/setup/global-setup.ts`、`playwright.config.ts`）与 `proposal.md:81-83`（`:85` 越界说明）的声明一一对应 ✓；`.aiws/secrets/test-accounts.json` 与 `apps/cms/.env` 经 `git check-ignore -v` 确认分别为 `.gitignore:4`、`.gitignore:6` 覆盖，未入库 ✓。

**未声明的工作树编辑**：仅 `.aiws/memory-bank/.index.yaml`（+11 行）与 `.aiws/memory-bank/decision/analysis/chatwoot-offline.md`（8-31 旧文件）→ 见 L3。**无未认领的产品代码改动**。

## 未能核实之处（诚实列出）

1. **3.3 的库侧事实**：`leads_activity` 计数 0、`e2e提醒%/e2e分配%/e2e站点%` 零残留、`users=3/projects=3/memberships=0/reminder_notices=0` —— 需连 `127.0.0.1:5434`，本审查禁止；只有 quality-review 的独立 `SELECT` 记录与 spec 内 afterAll 断言通过这两层旁证。
2. **3.1 / 3.2 是否由「当前文件状态」再跑一次**：禁止 build/跑测。我以日志内报告器打印的 `spec.ts:行号` 与当前文件行号逐条比对（reminders 与 leads-assign 的最终态只有 `e2e-final-2.log` 对得上）判定 20:17 那次覆盖最终树，但**未复跑**。
3. **仓库级 `aiws validate .` 本批是否真跑过**：无工件不等于没跑（可能该子命令不 stamp）；我只能证「无工件」+「8-25 那次有工件」。
4. **`apps/cms/.env` 是否已补 `PUBLIC_CORS_ORIGINS`（tasks 2.10）**：禁读该文件；仅由 C5/新 spec 全绿间接推断。
5. **`.aiws/secrets/test-accounts.json` 与 `e2e-admin` 账号真实状态**：禁读；H1 的「顶层键是否真会丢」因此无法用读盘证实（`create-e2e-admin.ts:80-94` 的重写语义是盘上代码事实）。
6. **线上 `leads_activity` 行数、`payload_migrations` 记账、是否存在含该表的备份**：本批自认未执行（`tasks §5.1/5.4`、`evidence §D` 右列、`quality-review H1` 同结论）；我未复核 `backups/` 是否含该表。
7. **迁移 `down` 的真实可回滚性**：只做了与基线 `up` 的逐对象文本镜像核对，未在任何库执行过（`evidence §F-3` 亦自陈）。
8. **PROB-005/006 两条 expected-fail 在「人为修好后」是否会转红**：与 quality-review L7 同——语义（`test.fail(true,…)` + runner 含 "Expected to fail, but passed"）与源码形态一致，但我未做正向对照实验。
9. **`aiws` 工具内部行为**（`--strict` 为何不带 evidence/scope 校验、`truth_sync` 的 changed 判定粒度）：未读工具源码，仅以 `metrics.json`/`.ws-change.json` 的记录为准。

---

## 6. 2026-09-20 追加规范审查（GATE-005 修复轮的流程与真值归因）

> 轴：Spec（范围 / 归因 / 门禁）。评审对象：`735bc09` 与其后的审查轮工作树。方式：只读核对（`git show --stat`、`grep`、读工件），未跑 build/e2e（其实测在 `quality-review.md §7.3`）。

### 6.1 本轮真实存在的流程缺口（不是文档措辞问题）

**HIGH**：PROB-006 是 P1 审计写路径变更，台账 Notes 自述「需独立门禁 + 双审查」，但落地时 `docs/gates/` 只有 GATE-001..004，`review/quality-review.md` 与 `review/spec-review.md`（即本文件）最后一次改动停在 `e14c684`，两份对 `PROB-015/016`、`2026-09-20` 零命中 ⇒ 「双审查」指向的是不覆盖本轮的旧工件。`aiws verify-bc` 只校验 Evidence_Path 里的文件**是否存在**，不校验内容是否覆盖当轮 ⇒ 它连续报 `ok: all gates passed (tier=strict)` 属结构上空签，不是本轮改坏了什么。

**处置（已落地）**：补 `docs/gates/GATE-005-assign-clone-error-and-audit-fix.md`（含方案对比 A/B/C、7 项修复清单、5 项「为什么不改」、风险回滚、自检项）+ `quality-review.md §7`（逐条发现与处置）+ 本节；PROB-005/006 台账 Notes 增指 GATE-005。
**根因级结论（写给下一批）**：审查工件的「在盘」不等于「覆盖本轮」。凡在本 change 内追加改动，必须同轮改写 review 两份，否则 finish 时的证据链是断的——建议把这条并入 ws-finish 自检（不在本批改工具，PROB-011/013 已代表工具侧缺陷）。

### 6.2 真值与归因同步核对（本轮 7 处）

| 工件 | 本轮是否改齐 | 核对方式 |
|---|---|---|
| `.aiws/issues/problem-issues.jsonl` | 是：005/006→DONE（指 GATE-005）、新增 017..022 共 22 行、去掉 005/006 的重复归因与时态矛盾 | 脚本回读打印 `rows=22 重复ID=0 归因次数=1`，连跑两次 `appended=6 → 0` |
| `docs/gates/GATE-005-*.md` | 新增（owner 裁决原文照抄进状态行） | 与裁决文本逐字比对 |
| `.aiws/plan/2026-09-19-cleanup-batch.md` | 是：Scope 前言的 `apps/cms/` 改动枚举由七处改**九处**（补 `Memberships.ts`/`Users.ts`）、范围说明表补 `Memberships`/`Users`/`GATE-005` 三行、`docs/` 括注补 GATE-005、Plan 第 8 步改写为「两轮审查」；台账范围 `PROB-001..022` | `plan-verify` exit=0；`## Plan` 仍 ≤8 步（未新增第 9 步）、In Scope 仍 ≤12 条 |
| `proposal.md` | 是：目标 / 方案概述 / In Scope 行 / 协同 review 段 / 验证计划 / 真值清单六处 | `change validate --strict` exit=0 |
| `tasks.md` | 是：新增 2.15/2.16、3.2/3.3/3.7 按实测改写、1.2/1.4/5.2 的台账范围与 OPEN 归集刷新到 PROB-001..022 | `change tasks validate` 绿 |
| `evidence/*`（verification.jsonl、verify-before-complete、follow-ups、dev-log） | 是：台账追加至 50 条、§A-20/21/22、005/006 段落改 DONE、§8.7 计数笔误改正 + 新增 §8.8 | 每条记录指向 `.aiws/tmp/.../{67..85}` 工件 |
| `.aiws/requirements/CHANGELOG.md` | 是：本轮共两行——错误码与响应面契约变更一行（2.14）、审计留痕外延 + 死权限判断精简一行（2.15） | 与代码实际返回逐字对照（`SOURCE_NOT_FOUND`/`ASSIGNEE_NOT_FOUND`/`LEAD_NOT_FOUND`、`{id,owner}`；`assigned_actor_null=0`） |

`REQUIREMENTS.md` 本轮**不需**改：无新增需求，REQ-0001/0002 状态未变（真值收敛已在 §1 完成）。

### 6.3 范围裁决

* 改动文件全部落在 plan 的机读 allow-list 内（`apps/cms/`、`apps/e2e/`、`docs/`、`.aiws/**` 对应条目）⇒ 加强门禁 `--strict --check-evidence --check-scope` 的越界清单仍只有用户在先的两条 `.aiws/memory-bank/` 产物（`exit=2` 是设计预期，不是失败）。
* owner 裁决「不用各立一个项目」被忠实执行：一个提交、一个门禁、一份回滚单位。
* 审查带出的 6 项新缺陷**没有**被静默塞进本批：`PROB-017/018/019/020/021/022` 单独立行、各自写明「为何不随批」（schema 迁移 / 权限语义 / 跨文件重构 / 并发量级），只有「同一根因的级联审计」（#3）与「恒真死兜底」（#5）属同批改范围而当场修。
* 上一节 §5 未证实项 8（`test.fail` 修好后是否转红）随本轮失效：两条 `test.fail` 已摘除、`grep -rn "test.fail" apps/e2e/tests/` 无命中，该项不再需要对照实验。

### 6.4 仍未闭合的（诚实清单）

1. `finish`/`push` 未做（owner 只批到「提交吧」）。
2. 线上仍按裁决未动：`leads_activity` 是否存在于生产未核实，`payload migrate` 不单独开窗口。
3. 「500 分支未死」的证据是**手工探针**（`61`），无自动化用例（注入真实库异常需破坏库）；已在 `quality-review §7.2 #10` 记为接受不做。
4. PROB-007 仍在放大 dev 库线索数（`leads_total` 63 → 67，每轮 e2e +4，见 `83-db-after-reviewfix2.txt`），本批三个新 spec 自身零残留。
