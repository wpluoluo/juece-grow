# P8 · 交付门禁 3.2 / 3.3 实跑，以及一处「门禁入口」口径错误的修正

Change: `astro-page-copy-cms` · 轮次：P8 · 日期：2026-09-21
归因：`REQ-0003`（附带 `PROB-027`：本轮自查出的门禁入口缺陷）
前置轮次：P1–P7 已交付（快照基线 / schema / 迁移 / 端点 / 导入 / parity / 读路径切换 / 去兜底 / e2e / 客户端 bundle 回归结案）

---

## 1. 本轮做了什么

| 项 | 内容 |
|---|---|
| tasks 3.2 | `pnpm --filter cms build` → `cms_build_exit=0`（`191`） |
| tasks 3.3 | 三站 `astro:build` / `:erp` / `:yunque` → 各 `exit=0`（`193`/`194`/`195`）；`node scripts/build.mjs` → `build_mjs_exit=0`（`196`） |
| 产物门禁复跑 | 客户端 bundle `197`、parity `198`、渲染文本 `199` 全 `exit=0`；hero DOM 抽取器裸跑 `200` **`exit=1`** ⇒ 暴露口径错误 |
| 缺陷修正 | 新增零参数门禁 `scripts/astro-copy-hero-diff.mjs` → `201` `exit=0`；咬合力自测 `202` `exit=0` |

## 2. 3.2 的前置动作与一个流程坑

`next build` 与 `next dev` 共用 `apps/cms/.next`，并发会互相覆盖 ⇒ 必须先让出 `:3000`。

- harness 的 `TaskStop` 只杀掉了 `pnpm cms:dev` 外壳，`next dev` 子进程（PID 61392）仍在监听 ⇒ 端口没放干净。
- 判据不是「任务状态显示 killed」，而是 `curl` 连不上：`cms_probe_after:000` + `curl_exit=7`（connection refused）。
- 用 `taskkill /PID 61392 /F /T`（Git Bash 下须 `MSYS_NO_PATHCONV=1`，否则 `/PID` 被当路径转换掉；被 harness 的 UNC 校验拦过一次）放掉整棵树。
- 构建后重启 dev 并复核：`/api/v2/health` → `{"success":true,"data":{"status":"ok"}}`。dev 启动日志（`192`）按 §7.2 口径不入台账。

**3.2 判据达成**：`✓ Compiled successfully in 26.1s`、`✓ Generating static pages (11/11)`，且生产路由清单里出现 **`/api/v2/content/pages`** —— 新端点进了生产构建，不只是 dev 下存在。

## 3. 3.3 的判据：退出码必须是「真 0」

`scripts/build.mjs:24-38` 有一条 Windows/Node24 libuv 崩溃白名单（退出码 `3221226505` 且 `dist/index.html` 存在即放行）。本轮按 P-V3 的口径不接受白名单命中：

- 日志 `196` 里 `[build] astro 页面已生成，忽略退出阶段的 libuv 环境崩溃。` **零命中** ⇒ astro 那步是真 0；末尾 `[build] 构建全部通过。` + `build_mjs_exit=0`。
- 三站日志（`193`/`194`/`195`）逐文件 `grep -c ECONNREFUSED` = **0 / 0 / 0**。
- `build.mjs` 内部又跑了一次 `pnpm cms:build`，当时 dev 正在跑；两轮 `.next` 写入未致失败，跑完 `/api/v2/health` 仍 200（这一点是实测事实，不代表推荐做法——推荐顺序仍是「停 dev → 建 CMS → 起 dev → 建三站」，本轮就是照这个顺序走的）。

## 4. 由 dist 重新生成触发的第四道门禁复跑（以及它抓到的口径错误）

`build.mjs` 会把 `apps/astro/dist` 重建，所以四道产物门禁当场复跑：

| 门禁 | 日志 | 结果 |
|---|---|---|
| `node scripts/astro-copy-client-bundle.mjs` | `197` | 三站各 `client_js=1 禁止串命中=0 CMS地址已内联=true Layout脚本chunk=有 判定=OK`，`client_bundle_exit=0` |
| `node scripts/astro-copy-parity.mjs` | `198` | `合计比对 12 个 (site,page)，端点侧叶子字符串 1374` + `12/12 逐字一致`，`parity_exit=0` |
| `node scripts/astro-copy-render-diff.mjs` | `199` | `差异 0 条` + `12/12 三站四页可见文本逐字一致`，`render_diff_exit=0` |
| `node scripts/astro-copy-hero-dom.mjs`（裸跑） | `200` | **`hero_dom_exit=1`**，输出只有用法行 |

`200` 不是新缺陷，是**账本写错了**：REQ-0003 `Tests` 与 tasks 3.4 把 `astro-copy-hero-dom.mjs` 记成「零参数门禁」，但它从设计起就是 `<distDir> <site> <outFile>` 三参数的**写入型抽取器**（P1 采基线时用它，P5 复测时也用它）。`119`/`134`/`135`/`167` 那几轮「零差异」是手拼三站参数 + `diff` 得到的，台账里那行的 `command` 甚至写成 `<dist|dist-erp|dist-yunque> <juece|erp|yunque> …（三站串联）+ diff` —— 任何人复制都跑不出来。按「官方入口必须零手填参数复现绿灯」的验收口径，这是缺陷，登记为 **PROB-027** 并当场修（见第 5 节），不是只记一笔台账。

## 5. 修法：新增零参数包装器，抽取器保持唯一实现

`scripts/astro-copy-hero-diff.mjs`（85 行，零参数）只做两件事：**编排**（按三站各调一次抽取器）与**比对**（12 条逐键比字符串）。HTML 解析与 `data-astro-cid-*` 归一仍只有 `astro-copy-hero-dom.mjs` 一份实现 ⇒ 无第二套解析路径、无兜底、无白名单。

一个必须写下来的陷阱：抽取器对已存在的 `outFile` 是**合并**语义（`store = existsSync(outFile) ? parse(...) : {}`）。包装器若不先 `rmSync(postFile, { force: true })`，就会拿上一轮残留凑满 12 条 ⇒ 假绿。脚本头注释与本档都记了这一条。

**实测**：
- `201` `hero_diff_exit=0` → `[hero-diff] 12/12 三站四页 hero <h1> 内部 DOM 与切换前基线逐字节一致（基线 12 条…）`
- `202`（`.aiws/tmp/astro-page-copy-cms/202-hero-diff-negative.mjs`）→ 往 `apps/astro/dist/index.html` 的 hero `<h1>` 注入一个多余 `<span class="probe-injected">` 后：`[hero-diff] 差异 1 条：✗ juece/home`、退出码 **1**；`finally` 里逐字节还原并断言内容等 ⇒ 复跑回 **0**。脚本自身 `hero_diff_negative_exit=0`。

## 6. 五处工件同步与 `REQ_SYNC`

- `tasks.md`：3.2 / 3.3 勾选并补实测；3.4 追加「P8 更正」；**新增 3.12**（hero DOM 零参数门禁）。
- `plan/2026-09-20_10-04-01-astro-page-copy-cms.md`：Verify 表 P-V3 补「libuv 白名单命中即判不通过」+ P8 实测；**新增 P-V9 行**；步骤 8 门禁范围改 `P-V1..P-V9`；**新增风险 R7**（把抽取器当验收入口）。修 R7 时一度把 R6 的标题串进了 R7 正文，已在同轮发现并还原（两处现在是独立条目）。
- `design.md`：Test Seams 引言改「第 5、6 条不打接缝」；第 2 条不再声称文本 diff 覆盖 DOM 不变；**新增第 6 层**（P-V9 产物层守卫·DOM 结构）；D6 的 2.14 段补「抽取器不是验收入口」。
- `proposal.md`：验证命令清单加 `astro-copy-hero-diff.mjs`；期望结果补 3.2/3.3/3.3-P-V9 的 P8 实测。
- **另修两处文档漂移**（实测核对过才改）：`proposal.md` 验证前置与 `plan` 的前置都写着「`apps/cms/.env` 含 `PUBLIC_CMS_ORIGIN`」，实测 `cut -d= -f1` 显示该键在 **`apps/astro/.env`**，CMS 侧对应键是 `PUBLIC_CORS_ORIGINS` ⇒ 两处按真值改齐。

**自己引入并已修掉的缺陷（`206`，登记为失败行）**：`append-req0003-p8-sync.mjs` 首版为防「盲改不认识的合同行」加了前置断言，但只认 P6 措辞 ⇒ 第一次跑成功后 `Tests` 已是 P8 版，复跑反而抛「Tests 字段不是 P6 那一版（缺 hero-dom 那段），拒绝盲改」，同步脚本失去可重放性（而这正是它必须有的性质）。修法：断言同时容纳「P6 版」与「已迁移的 P8 版」，只有两者都不是才拒绝 ⇒ 复跑落回两路 `no-op`（`207`）。与 P5 那轮「去重键只按 command」同属一类：**幂等性质必须在脚本自身可证，不能靠人记得「跑一次就好」**。

`REQ_SYNC: SYNCED` —— REQ-0003 合同行的 `Tests` 字段由「`astro-copy-hero-dom.mjs`（零参数）」改为「`astro-copy-hero-diff.mjs`（零参数；内部调抽取器）」，并追加 CHANGELOG 行；本轮同时改了 `REQUIREMENTS.md` 吗？没有——盖章真值文件的验收文字未点名门禁脚本，不需 `aiws change sync`，但 REQ-0003 合同行改了 ⇒ 交付轮（3.8）仍按完整链跑 `sync → validate → change validate --strict`。

## 7. 台账入账

`evidence/verification.jsonl` 由 **121 行 → 139 行 → 142 行 → 144 行 → 145 行**（分三段 appender，因 appender 不能登记自己的日志）：

- `append-verification-p8.mjs` → `appended=18 total=139`（`210`），复跑 `no-op：18 条已全部在册`（`211`）。18 条 = 3.2 一条（`191`）、3.3 四条（`193`/`194`/`195`/`196`）、重建产物后的三道绿门禁（`197`/`198`/`199`）、`200` **失败行**（hero DOM 裸跑 expected 0 / got 1，PROB-027 取证）、新门禁与其咬合力（`201`/`202`）、PROB-027 入账与复跑（`203`/`204`）、合同行同步三条（`205` 绿 / `206` **失败行**=同步脚本首版不可重放 / `207` 修后 no-op）、两条校验（`208`/`209`）。
- `append-verification-p8b.mjs`（appender 不能登记自己的日志 ⇒ 第二段）→ 首跑 `appended=3 total=142`（`213`）、复跑 `no-op`（`214`）；随后补两条「全部工件改完后的复校」（`216` `aiws validate .` / `217` `change validate --strict`）再跑 → `appended=2 total=144 sha256=c48b0f670c0c3ed8`（`218`），复跑 `no-op：5 条已全部在册，台账仍 144 行`（`219`）。**为什么要复校并登记**：`208`/`209` 那两条是在 tasks/plan/proposal/design 与证据文档改完之前跑的，只证明当时的自洽。
- `append-verification-p8c.mjs`（第三段，只 1 条）→ `appended=1 total=145`（`222`）、复跑 `no-op：1 条已全部在册，台账仍 145 行`（`223`）。登记的是 `221-uncovered-rows.mjs`：**本轮自己抓自己的一处过度声称**——本节原先写「144 = glob 覆盖 134 + 10 行（本轮实数过）」，实际只是 `139+5` / `129+5` 的算术推断，从没按 `(command, artifact)` 键数过。补脚本实测 `ledger=144 covered=134 uncovered=10`（`221`）⇒ 断言成立，但依据换成了测量；同时把台账 `142` 行 note 里同一口径的「本轮单独数过」改写成实测措辞（该改写在登记 `221` 之前落盘，故 `221` 行记录的是更正后的状态）。
- **审计口径的一个细节**：新增这两行一开始写成 `ROWS.push(...)`，随即改回数组字面量内部——审计器 `114` 是用正则取 `const ROWS = [...]` 再 `new Function` 求值的，`push` 进去的行不会被解析 ⇒ 变成「声明了但没人核」的盲区（脚本里留了注释钉这条）。
- 审计器 `114-audit-ledger-coverage.mjs`（按 `command + artifact` 反查每只 appender 声明的行是否真进了台账）：12 只 `append-verification-*.mjs` 逐批 `missing=0`（declared 依次为 15/5/5/20/8/6/21/9/22/18/5/1，合计 135），末行 `AUDIT ledger_rows=145 missing_total=0`（`212`/`215`/`220`/`225`）。
- 本轮顺带复核了主 appender 的一个真实风险：18 条声明里有 **4 条命令与往轮逐字节同名**（`pnpm astro:build` / `:erp` / `:yunque`、`aiws change validate … --strict`），若是修掉的那版「只按 command 去重」就会把这 4 条静默吞掉 ⇒ 实际 `appended=18` 与声明条数相等，键含 artifact 的修复未回退。
- **未入账**：`192`（CMS dev 启动日志，非命令工件）、`hero-dom-post.json` 与 `render-post/`（门禁产物）、`213`/`214`/`218`/`219`/`220`（第二段 appender 自身的运行与审计日志）、`222`/`223`/`224`/`225`（第三段 appender 自身的运行、复算与审计日志）——沿用 P6/P7 的「不自我登记」口径。
- 审计口径的边界（防误读）：它证明的是 **declared ⊆ 台账**（防静默丢失），不含反向。反向由 `221-uncovered-rows.mjs` 逐条按 `(command, artifact)` 键实测：`ledger=144 covered=134 uncovered=10`（`221`），该行入账后端账长出 1 行 ⇒ 复算为 `ledger=145 covered=135 uncovered=10`（`224`）。那 **10 行 uncovered** 全是 P1 轮（日志 `20`–`32`）由早期未按 `append-verification-*.mjs` 命名规则落盘的 appender 登记的产物，不是本轮丢失。

## 8. 剩余缺口（不在本轮掩盖）

1. ~~**3.5 / 3.6 未跑**~~ → **P9 已跑毕**：端到端自助改稿（e2e 常驻用例 `234` + 产物层重建回环 `238`）与死端口负向构建（`227` 首跑 → 修 PROB-028 → `230`/`232`/`233` 绿，并固化为零参数门禁 3.13）。实测细节、ECONNRESET 残留与恢复路径见 `evidence/selfservice-and-negative-build-p9.md`。**顺带更正本行首版的操作假设**：3.6 并没有临时改 `.env`——Vite `loadEnv` 下进程环境变量优先，只把死端口注入子进程环境即可，含令牌的配置文件全程未动。
2. ~~**下一轮把 `astro-copy-hero-diff.mjs` 串进 3.3 的构建链当固定后置步**~~ → **该判断是 P8 的错判，就地撤回**：hero-diff 比对的是**导入前**基线的逐字节 DOM，它锁的是「本次迁移没顺手改结构」这一件事；上线后产品在后台改稿是**预期行为**，任何一次合法改稿都会让它变红 ⇒ 它是**迁移期守卫**，不是常驻构建门禁。串进 `scripts/build.mjs` 会把「交付正确性」和「日常运营」绑死，下次构建必然红并逼人去删基线。P9 的边界已写进 REQ-0003 `Tests` 与 tasks 3.5 末段。真正的常驻缺口是「改稿后产物与端点是否一致」，那由 3.1 的 parity 与 e2e 第 6 组承担。
3. **抽取器与包装器之间仍无编译期保护**（P8 遗留，仍未做）：`astro-copy-hero-dom.mjs` 与 `astro-copy-hero-diff.mjs` 的契约（三参数顺序、对已存在 outFile 的**合并**语义）只写在两份注释里，改签名只会在运行时炸。本 change 未处理（.mjs 无类型检查入口，补它要引依赖，超出边界）⇒ 移交后续。
4. **`apps/e2e` 无 typecheck 入口**（P7 遗留）：仓内无 `@types/node`，补它等于加依赖 ⇒ 超出本 change 边界，交付说明里作为后续项。
5. **`tasks.jsonl` 26 条全 `pending`**（P7 遗留）：与 `tasks.md` 构成第二份未维护真值 ⇒ 交付时必须同步或删除（禁双写）。
