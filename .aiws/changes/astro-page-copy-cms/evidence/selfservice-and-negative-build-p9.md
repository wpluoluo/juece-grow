# P9 · 3.6 负向构建与 3.5 端到端自助改稿：一处「失败路径不可读」的缺陷，与一次测试数据残留的完整恢复

Change: `astro-page-copy-cms` · 轮次：P9 · 日期：2026-09-21
归因：`REQ-0003`（附带 `PROB-028`：本轮自查出的失败路径可读性缺陷）
前置轮次：P1–P8 已交付（快照基线 / schema / 迁移 / 端点 / 导入 / parity / 读路径切换 / 去兜底 / e2e / 客户端 bundle 回归 / 交付构建门禁 + PROB-027 结案）

---

## 1. 本轮做了什么

| 项 | 内容 | 实测 |
|---|---|---|
| tasks 3.6 | CMS 不可达的负向构建（死端口） | `227` 手跑 → 三条性质只成立两条 ⇒ 登记并修 `PROB-028` → 门禁 `228` **红**（自证咬合力）→ `230`/`232`/`233` 绿 |
| 新增持久门禁 | `scripts/astro-copy-cms-unreachable.mjs`（98 行，零参数） | `230` `neg_gate_exit=0` |
| 产品代码修复 | `apps/astro/src/lib/payload.ts` 加 `connectFailure()`（127 行） | `229` `pnpm astro:typecheck exit=0`；`231` 拿到修后的完整报错 |
| tasks 3.5（dev 层） | `apps/e2e/tests/page-copy.spec.ts` 第 6 组「后台自助改稿」（文件 213 行） | `234` `1 passed (53.9s)`；全量 `243` `68 passed / 2 skipped` |
| tasks 3.5（产物层） | `235-rebuild-selfservice.mjs` 改稿 → 重建 → 断产物 → 复原 → 重建 | 首跑 `235` **红**（`ECONNRESET` 残留）→ `236` 复原 → `238` `RESULT 3.5-rebuild=OK` |
| 恢复路径 | `236-restore-pricing-hero.mjs`（从 git-tracked 快照复原，可重放） | `236b` `restore_exit=0`；`237` parity `12/12` |
| 最终态复跑 | 三站全部重建后跑四道门禁 | `248`/`249` 各 `exit=0`；`250`/`251`/`252`/`253` 各 `exit=0` |

前置探针 `226`：死端口 `59999` `curl` 连不上（`deadport_exit=7`，前提成立）、`/api/v2/health` 与 `:4321` 均 200（两个 dev 进程在跑）。

## 2. 3.6：`fetch failed` 不是「可读错误」

三条验收性质里，`227` 实测有两条当场成立：构建退出码 `1`；失败后 `apps/astro/dist` 内 HTML 计数 **0**（即不会发布空白区块）。第三条——「给出可读错误」——不成立：全文只有

```
TypeError: fetch failed
  Caused by: connect ECONNREFUSED 127.0.0.1:59999
```

说不出是「文章列表」还是「页面文案」、说不出哪个 URL 与站点，也不表述「有没有回退」。对照同目录 `lib/cmsOrigin.ts` 缺键时那句指到唯一正确入口的中文报错，失败路径的口径不一致。

根因不在控制流（异常确实抛出去了），在文本：Node 的 undici 把底层原因挂在 `err.cause`，而 Astro 打印只取 `err.message`。修法只改写错误文本——`connectFailure(url, label, err)` 生成「哪份数据 + 完整 URL + 底层原因 + 构建期硬失败不回退旧文案 + 该去确认 CMS 与 `PUBLIC_CMS_ORIGIN`」，并以 `{ cause: err }` 保留原异常；两个调用点各包一层 `try/catch`，其余三条失败路径（非 2xx / `success!==true` / 缺 `data.copy`）原样不动。**没有**新增吞异常的分支，也没有加兜底（AGENTS.md §4）。

修后同一条命令的输出（`231`）：

```
站点 juece 的文章列表 拉取失败：请求 http://127.0.0.1:59999/api/v2/content/articles?site=juece
未建立连接（connect ECONNREFUSED 127.0.0.1:59999）——构建期硬失败，不回退代码内旧文案。
请确认 CMS 已启动，且 apps/astro/.env 的 PUBLIC_CMS_ORIGIN 指向该地址。
```

门禁 `scripts/astro-copy-cms-unreachable.mjs` 把「可读」钉成判定项（要求输出含「不回退」），因此它**先在 `228` 红过一次**（`可读错误命中=false`、`neg_gate_exit=1`）——这是 PROB-027 那条口径的第 (b) 半：红的一侧也必须自测过，否则门禁可能是空跑。

## 3. 为什么没动 `.env`（以及怎么证明覆盖生效）

本 change 的硬约束是「`.env` 与 secrets 只追加不改写」。原计划（tasks 3.6 首版措辞、plan P-V6 首版）写的是「临时改 `.env` 一行 → 跑 → 改回」，实跑发现根本不必：Vite 的 `loadEnv` 里**进程环境变量优先于 `.env`**，于是门禁把死端口只注入 `spawnSync` 的子进程环境，配置文件全程零写入（脚本里没有对该文件的写调用）。

但「用了 env 覆盖」本身可能不成立（若哪天优先级反过来，测试就会打向真 CMS 并拿到 200 而假绿）。所以判定③要求**死端口号 `59999` 出现在构建输出里**——用报错反证覆盖确实生效。

## 4. 一个环境事实：失败构建的退出码会被改写

`231` 实测：同一条失败构建有时以 `3221226505`（bash 侧看到 `127`）而不是 `1` 结束——退出阶段的 libuv 崩溃会改写码值（本机 Node 24 / Windows 的已知现象，与 `scripts/build.mjs:31` 那条白名单同源）。结论：**负向门禁只判「非零」**，判精确码会造出一只随机闪红的门禁。正向构建仍按 3.3 的口径「白名单命中不算绿」——两边不冲突：负向要的是「有没有失败」，正向要的是「是不是真成功」。

## 5. 门禁的副作用：它会清空 `dist`

Astro 在构建开始就清空 `outDir`，而这条门禁跑的是**失败**构建 ⇒ 跑完 `apps/astro/dist` 为空。后果：任何读 `dist` 的门禁（render-diff / hero-diff / client-bundle）紧接着跑都会硬失败（缺 HTML 即非零，不会假绿）。固定顺序写进脚本头与 tasks 3.13：**跑本条 → `pnpm astro:build` 重建 → 再跑那三道**。

## 6. 3.5 为什么要拆两层

REQ-0003 验收第 4 条是「后台改一条已发布文案 → 重建 → 断言新串出现、旧串消失」。`output: 'static'` 让这句话有两个不同的判定面：

- **dev 层**：`:4321` 按请求重渲染 ⇒ 后台改完当场可见。这层进了常驻 e2e（`page-copy.spec.ts` 第 6 组），因为它是产品目标本身（运营自助改稿的日常体验）。用例细节：`where slug=juece-grow` → project id → `where project equals` 精确锁定那一行（各要求恰 1 条）；PATCH 时传回**整个** `hero` 对象（Payload 对嵌套组是替换语义，不依赖深合并）；`finally` 无条件用改前的 `hero` 写回，并把整份 copy `JSON.stringify` 与改前快照深比——防「改一个字段连带损坏别的字段」。
- **产物层**：交付出去的是构建产物，只有重建后才变。这层由一次性回环脚本证（PATCH 标记串 → `pnpm astro:build` → 断 `dist/pricing/index.html` 新串命中且旧串零残留 → 复原 → 再重建 → 旧串回来）。没把它做成常驻门禁的原因：它要写真实数据行并跑两次构建，属交付期取证而非日常回归。

## 7. `finally` 也会失败：测试数据残留与恢复路径

`235` 首跑没跑完：约 90s 的构建期间 REST 连接空闲，被 Next dev 单方面断掉（`ECONNRESET`），恰好在 `finally` 的复原 PATCH 上抛 ⇒ 退出码 1，且**库里留下测试串**（`3.5 重建自测 1789928555087 的`，长度 27）。

这不是断言失败，是恢复动作本身没有容错。处置分三步：

1. **先恢复现场，且恢复路径脱离本次运行可独立执行**：新增 `236-restore-pricing-hero.mjs`，从 git-tracked 的导入前快照 `evidence/snapshot-pre-import/pricing.juece.json` 把 `hero.description` 写回（`236b` `RESULT=OK`，长度回到 57），随即 `237` parity `12/12` ⇒ 除那一个字段外无连带损坏。
2. **让 235 可重放**：连接类失败（按 `err.cause.code` 判定）重试三次；失败信息直接指向 236；开工先断言现值不是测试串（是则拒跑，避免把恢复脚本当清理脚本用）。`238` 绿，且日志里能看到重试真的触发了一次。
3. **恢复脚本自己也要测**：`236` 首版是红的（`restore_exit=127`）——它拿 REST 读回的 `hero` 与快照做结构比对来判定「是不是要复原的那一行」，而 REST 会给数组行补 `id` ⇒ 假阴性、停手不写。现版改成「按 `where` 精确定位 + 经公开端点验证复原结果」，并留 NOOP 分支保证可复跑。

真值层同步：`235` 首跑失败时**没有**先把库改脏再报绿；残留登记为 ledger 里的失败行，不覆盖。

## 8. 两处自我更正（都不是产品缺陷，但都会误导下一轮）

1. **`239`–`242` 那轮四道门禁不算最终态。** 当时只有 `dist`（juece）在 3.5 回环里被重建，`dist-erp`/`dist-yunque` 仍是 P8（`194`/`195`）的产物——而 PROB-028 改的 `lib/payload.ts` 是三站共用模块，等于用陈旧产物给三站发绿。补跑 `248`（erp，`astro_build_erp_exit=0`）/ `249`（yunque，`astro_build_yunque_exit=0`，两日志 `ECONNREFUSED` 计数 0），再重跑 `250` render-diff / `251` hero-diff / `252` client-bundle / `253` parity，四道全 `exit=0`。**以 250–253 为判定面**，tasks 3.5 与 proposal 的引用已改齐。
2. **`PROB-028` Notes 首版把新门禁写成「本 change 唯一新持久脚本」。** 实测本 change 在 `scripts/` 下已新增 7 只持久脚本（`git status` 全为未跟踪），那是未核实的记忆式断言；已在台账原行内就地更正为「P9 新增的持久门禁脚本」并保留错报说明。同轮 `wc -l` 复核了该行引用的三个行数（98 / 127 / 213）与问题台账行数（28）。

## 9. 真值与工件同步（Requirement Sync Gate）

| 工件 | 改动 |
|---|---|
| `.aiws/requirements/requirements-issues.jsonl` | REQ-0003 `Tests` 末段重写：删去「e2e 含 CMS 不可达负向用例」这句**不存在的覆盖**，改指 `astro-copy-cms-unreachable.mjs` + `pnpm --filter e2e test`（含第 6 组自助改稿）；给 hero-diff 标「迁移期守卫、不串常驻构建链」。脚本 `append-req0003-p9-sync.mjs`，`246` 更新、`247` 复跑 `no-op` ⇒ 幂等已证 |
| `.aiws/requirements/CHANGELOG.md` | 追加 1 行（P9 合同行同步；按整行去重） |
| `.aiws/issues/problem-issues.jsonl` | 追加 `PROB-028`（`DONE`/`P2`/`REQ-0003`），台账 27 → **28 行**；`244` 追加、`245` 复跑 `no-op` |
| `tasks.md` | 3.5 / 3.6 勾选并写实测；新增 **3.13**（负向构建零参数门禁）；**3.10** 由未勾选转为已勾选（台账 190 行 + 双向覆盖实测，见 §11） |
| `plan` | P-V5 / P-V6 按实测改写、P-V9 补边界；新增风险 **R8**（fail-closed 的可读性那一半）、**R9**（跨长构建的写测试必须有独立恢复路径）；R1 的「≈1171 个文本单元」按实测换成 1374 个叶子字符串 |
| `design.md` | Test Seams 第 3、4 条改写（两层判据 / 常驻负向入口 + 四条判定）、第 6 条补迁移期守卫边界 |
| `proposal.md` | 实现步骤 7 补 P9 落地；验证命令把「手拼 env 跑构建」换成零参数门禁；期望结果补 `228`–`253` 实测；问题台账计数 27 → 28 |
| `evidence/delivery-build-gates-p8.md` | §8 第 1 条改为「P9 已跑毕」；**第 2 条「把 hero-diff 串进构建链」就地撤回**（它是迁移期守卫，合法改稿必红），并把被误删的原句另一半（抽取器与包装器契约无编译期保护）恢复为独立缺口第 3 条 |

`REQ_SYNC: SYNCED` —— REQ-0003 的 8 条验收标准本身未变（第 4、5 条由本轮转为已证），改的只是合同行 `Tests` 里的验收入口与措辞；`REQUIREMENTS.md` 的验收勾选与「移入已完成」按 4.2 在交付轮统一做。

## 10. 剩余缺口（不在本轮掩盖）

1. **`235` / `236` 是一次性脚本，留在 `.aiws/tmp/`（gitignored）**。它们证的是「SSG 产物随后台改稿而变」这条交付期性质，不进常驻链；若将来要做「重建后产物一致性」的常驻门禁，需把它固化并解决「不许写真实数据行」的问题（另立需求，不在本 change）。
2. **`ECONNRESET` 只在 dev 复现**：`next dev` 会单方面断开空闲连接，故所有跨长操作的脚本都要自带重试与独立恢复路径（R9）。这条属环境事实，不改产品代码。
3. **`apps/e2e` 无 typecheck 入口**（P7 遗留）：仓内无 `@types/node`，补它等于加依赖 ⇒ 超出本 change 边界。
4. **`tasks.jsonl` 26 条全 `pending`**（P7 遗留）：与 `tasks.md` 构成第二份未维护真值 ⇒ 交付时必须同步或删除（禁双写）。
5. **抽取器与包装器的契约无编译期保护**（P8 遗留，本轮未做）。

## 11. 入账（tasks 3.10）与收口校验

| 步 | 命令 | 实测 |
|---|---|---|
| P9 主入账 | `node .aiws/tmp/astro-page-copy-cms/append-verification-p9.mjs` | `appended=39 total=184`（`254`）；复跑 `no-op：39 条已全部在册`（`255`） |
| 同轮补账 | `node .aiws/tmp/astro-page-copy-cms/append-verification-p9b.mjs` | `appended=6 total=190`（`260`）；复跑 `no-op`（`261`、改注后 `264`） |
| 正向覆盖 | `node .aiws/tmp/astro-page-copy-cms/114-audit-ledger-coverage.mjs` | `AUDIT ledger_rows=190 missing_total=0`（`262`；`256` 时为 184 行、`265` 改注后复算仍 0） |
| 反向覆盖 | `node .aiws/tmp/astro-page-copy-cms/221-uncovered-rows.mjs` | `ledger=190 covered=180 uncovered=10`（`263`）——10 条全是 P1 轮 `gen-verification-p1.mjs` 直写的日志 20–32，与 P8c 的 `135/145` 同数 ⇒ 本轮没新增无源行 |
| 校验器 | `aiws validate .` / `aiws change validate astro-page-copy-cms --strict` | `✓ aiws validate` `validate_exit=0`（`258`）/ `ok: change validated` `strict_exit=0`（`259`） |

39 行里刻意包含三枚红侧，不是为了好看：**`228`**（门禁在 PROB-028 修复前必须红，`expected=0` ⇒ `status=failure`）、**`235`**（脚本缺连接层重试导致 `ECONNRESET` 残留，`failure`）、**`236`**（复原脚本首版的假阴性守卫，`failure`）。另两枚红按「设计即期望」登记：`227` 手拼负向构建（`exit=1`/`expected=1`）、`231` 修后对照（`exit=127`/`expected=127`，判据是「非零」，见 §4）。

**口径限制（写给下一轮）**：appender 写不进自己的日志，所以本轮的 `260`/`261`/`262`/`263`/`264`/`265` 六份日志尚未入账，须由交付轮的 `append-verification-p10.mjs` 补登——P8 的同类残留（`213`–`225` 十份）正是本轮 `append-verification-p9.mjs` 的 A 类补账内容。这意味着「台账覆盖率 100%」在任何时刻都不成立，成立的是 `missing_total=0`（声明过的行都在册）+ 未入账行数已知。
