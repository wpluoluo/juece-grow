# P11-c 证据：把只活在 gitignored tmp 里的验证面固化成零参数持久门禁 + 台账日志入库镜像

> Change: `astro-page-copy-cms` ｜ 来源：独立审查 spec H-1 / H-2 / H-3 + quality HIGH-3（附带 W-2 的修法）
> 时间：2026-09-21（本地工作树，分支 `change/astro-page-copy-cms`，改动全程未提交）
> 本轮日志：`.aiws/tmp/astro-page-copy-cms/297…308`（12 份，退出码均由命令自身落盘，未过管道）
>
> **范围声明：只新增/改动 `scripts/` 与 `.aiws/changes/astro-page-copy-cms/evidence/`（新增 `logs/` + 本文件）。
> 未改 `apps/` 任何代码、未改 `tasks.md`/`design.md`/`plan/`/`REQUIREMENTS.md`、未改 `.aiws/tmp/` 里任何既有脚本（台账 190 条指针的历史工件保持原样）。
> 未跑任何构建命令（`pnpm --filter cms build` / `astro:build*` / `node scripts/build.mjs`），未跑 `astro-copy-cms-unreachable.mjs`（它会清空 `apps/astro/dist`）；本轮只跑只读门禁。
> 未动数据库、未 `git add`、未 `commit`、未打印任何密钥值。**没有为了让门禁变绿而重建任何 dist。**

## 1. 文件清单（新增 4 / 改动 3，共 7 只，全部 ≤1000 行 · AGENTS.md §4）

| 文件 | 行数 | 性质 | 来源 |
|---|---|---|---|
| `scripts/astro-copy-coverage.mjs` | 179 | 新增（固化） | `.aiws/tmp/astro-page-copy-cms/63-coverage-check.mjs`，逻辑逐字搬 |
| `scripts/astro-copy-agents9.mjs` | 172 | 新增（固化） | `.aiws/tmp/astro-page-copy-cms/268-agents9-selfcheck.mjs`，仅改 repoRoot / 头注释 / `LIMIT` |
| `scripts/astro-copy-dist-dirs.mjs` | 83 | 新增（共享模块） | 三站 dist 清单 + 新鲜度断言，只此一份实现 |
| `scripts/astro-copy-evidence-archive.mjs` | 96 | 新增（门禁） | 台账 artifact → `evidence/logs/` 镜像核对，零参数、只读 |
| `scripts/astro-copy-render-diff.mjs` | 131 | 改动 | 接共享模块（去 `existsSync(distDir)`）+ 并入 cap-tone 断言（原一次性脚本 142） |
| `scripts/astro-copy-hero-diff.mjs` | 85 | 改动 | 接共享模块（去本地 SITES 硬编码 + 去 `existsSync(distDir)`）|
| `scripts/astro-copy-client-bundle.mjs` | 75 | 改动 | 接共享模块（去 `OUT_DIRS` 硬编码，改为 distDir 派生 `_astro`）|

搬移的三处允许改动之外无任何逻辑改动：`repoRoot` 由 tmp 的上 4 级（`63`）/ 上 3 级（`268`）改为 `scripts/` 的上 1 级；头注释运行口径改为 `node scripts/xxx.mjs`（零手填参数）；**未新增任何白名单**。
实测无残留：`grep -rn "node .aiws/tmp" scripts/` = 0 命中；`grep -rnE "dist-erp|dist-yunque" scripts/` 只返回 `astro-copy-dist-dirs.mjs:19,20` 的清单本体 + 三处注释/文档文字（render-diff 头注释、client-bundle 头注释、cms-unreachable 头注释）⇒ 真实的三站清单已收敛到一处（quality W-2 修完）。

## 2. 任务 1：覆盖度门禁固化（spec H-2）

```
node scripts/astro-copy-coverage.mjs   →  297-coverage-promoted.log   coverage_exit=0
```

关键输出（与历史日志逐字对齐）：

```
### home      slug=page-home      dumpPaths=76 schemaPaths=89 …
### features  slug=page-features  dumpPaths=43 schemaPaths=53 …
### solutions slug=page-solutions dumpPaths=20 schemaPaths=26 …
### pricing   slug=page-pricing   dumpPaths=22 schemaPaths=29 …
  + plans[].currency
SUMMARY A\B total=0
```

**一致性证明（实测，非声称）**：`diff .aiws/tmp/astro-page-copy-cms/140-recapture-coverage.log 297-coverage-promoted.log` → 无输出（两文件逐字节相同）。即：`A\B total=0` 与 pricing 的合法残差 `B\A` 恰 1 条 `plans[].currency` 都在持久版里复现。

## 3. 任务 2 + 任务 1：§9 自检固化，阈值改回真值 1000（spec H-3）

| 命令 | 日志 | 退出码 |
|---|---|---|
| `node scripts/astro-copy-agents9.mjs`（`LIMIT = 1000`） | `298-agents9-promoted-limit1000.log` | **1** |
| `node .aiws/tmp/astro-page-copy-cms/268-agents9-selfcheck.mjs`（原件，`LIMIT = 1500`，复跑对照） | `299-agents9-tmp-original-limit1500-recheck.log` | **1** |
| `node scripts/astro-copy-agents9.mjs`（新增两只脚本后复跑） | `307-agents9-final-after-new-scripts.log` | **1** |

- **改动仅两处**：`const LIMIT = 1000`（原 `1500`，AGENTS.md §4 真值）与断言标签文案 `§4 自研文件 ≤1000 行`。
- **搬移保真证明**：`diff 299 298`（各自去掉 git 的 CRLF `warning:` 行后，两份各 26 行）→ 只有 2 行不同，都是 `≤1500` / `≤1000` 这一处文案（标签行 + 末尾失败清单行），其余 24 行逐字相同 ⇒ 除阈值外逻辑无漂移。
- **实测自研最大行数（门禁口径 `split('\n').length`）**：`apps/astro/src/pages/features.astro = 595`，次高 `apps/astro/src/layouts/Layout.astro = 530`、`apps/astro/src/pages/solutions.astro = 486`。
  ⇒ **1000 这个阈值本身不会放红任何自研文件**（595 < 1000 < 1500），历史 268 日志打印的 `最大 apps/astro/src/pages/features.astro=595` 与本轮实测一致。
- **退出码不是 0 的唯一原因与阈值无关**（这是我判断你方案不成立之处，详见 §8.1）：

```
  FAIL §4 自研文件 ≤1000 行 :: apps/cms/src/migrations/20260920_195201_page_copy_project_unique_index.json=8098
自检 3.9：1 条不成立
```

  该文件是 P11-a（`evidence/project-uniqueness-p11.md` §2.1）用 `payload migrate:create` 生成的 drizzle 快照，**晚于** 268 那次运行（268 的 `generated` 豁免清单只有 4 项：`payload-types.ts` + `20260920_121115` 的 `.ts`/`.json` + `migrations/index.ts`）。
  对照实验证明与 1000/1500 无关：tmp 原件（`LIMIT=1500`）在本轮同样 `exit=1`、同样点名这同一条 8098 行的文件（299 的 `FAIL §4 自研文件 ≤1500 行 :: …page_copy_project_unique_index.json=8098`）。
  实测算条数（298）：`OK` 18 条 + `FAIL` 1 条 = **19 条断言**，另有 4 条「跳过（生成物）」行。审查简报里写的「12 条断言」偏少，实测以本行计数为准。全绿的 18 条含验收第 6 条 `§9 SEO 三件套在 Layout 落地` + `四页 title/description 均取自 CMS copy.meta :: index/features/solutions/pricing 4/4`。
  **我没有替它把新迁移加进豁免清单**（任务 1(c)「不许新增白名单」+ 任务 2「生成物豁免清单不变」），把这一条留给你拍板。

## 4. 任务 3：cap-tone 产物断言并入既有产物门禁

判定：**并入 `scripts/astro-copy-render-diff.mjs`，不新造脚本。** 理由：142 那份检查读的是 `dist/features/index.html` 的字面 class 计数与 `dist/_astro/*.css` 里的编译后选择器，**不需要任何独立基线文件**（期望值是常量 1/4/0 与「选择器至少命中 1 个 css」），而它的产物面（三站 dist）与 render-diff 完全同一份 ⇒ 按你给的分支条件落在「并入」这一侧。

- 实现：新增 `checkCapTone({ site, distRel, distDir }, failures)`，逐字保留 142 的判定与阈值；在每站循环里**先**跑 cap-tone，再跑抽取器（抽取器 exit≠0 会 `continue`，放后面就会漏判）。
- 未新造第二份 HTML 解析实现：`astro-copy-render-text.mjs` 的抽取器会把标签整段删掉（拿不到 class）、`astro-copy-hero-dom.mjs` 只抓 `<h1 class="hero-title">` 内部（拿不到 `cap-tag`），两者都覆盖不到这条判定；142 原样用的是「字面串计数 `text.split(needle).length - 1` + CSS 文件名正则」，压根不解析 DOM ⇒ 与既有抽取器互不重复，脚本头注释已把这点写明。
- 实跑（`node scripts/astro-copy-render-diff.mjs` → `300-render-diff-freshness-and-cap-tone.log`，`render_diff_exit=0`）：

```
[cap-tone] juece   cap-tag yb=1 cap-tag=4 缺陷串 cap-tagyb=0 编译后选择器命中=features.DcrV5jsl.css
[cap-tone] erp     cap-tag yb=1 cap-tag=4 缺陷串 cap-tagyb=0 编译后选择器命中=features.DcrV5jsl.css
[cap-tone] yunque  cap-tag yb=1 cap-tag=4 缺陷串 cap-tagyb=0 编译后选择器命中=features.DcrV5jsl.css
[render-diff] 12/12 三站四页可见文本逐字一致 + 三站 cap-tag 配色类断言成立（差异清单为空）
```

  与历史 `142-check-cap-tone.log`（403 字节）三行输出逐字相同，含命中的 CSS 文件名 `features.DcrV5jsl.css`。
  被断言的源码修复面复核：`apps/astro/src/pages/features.astro:128` 现为 `` <span class={`cap-tag${cap.tagTone ? ' ' + cap.tagTone : ''}`}> ``（本轮未改，仅读取确认门禁确实咬住它）。

## 5. 任务 4：dist 新鲜度断言（一处实现、三站链条共享）

`scripts/astro-copy-dist-dirs.mjs` 导出三样：`DIST_SITES`（site → dist 相对路径 → 构建入口名）、`resolveDistSites(repoRoot)`（加绝对路径与 `buildCmd`；**入口名真值取自根 `package.json` scripts**：`astro:build` / `astro:build:erp` / `astro:build:yunque`，若键不在即抛错而不是猜）、`checkDistFreshness(repoRoot)`（返回 `{ rows, problems }`）。
判据：`apps/astro/src` 下文件最大 mtime 必须**严格早于**每个 dist 目录内文件最大 mtime；缺目录同样计为问题（点名该站 + 要跑的命令）。目录不存在用 `null` 显式返回并由调用方判红，不使用「默认 0」这类兜底。
`render-diff` / `hero-diff` / `client-bundle` 三只全部 import 它并各自在开头打印 `[dist-fresh]` 行、`problems` 非空即以 1 退出；三只原本各写一份的 dist 清单与 `existsSync(distDir)` 分支已收掉（`client-bundle` 保留的是 `_astro` 子目录存在性——那是另一个目录、另一条判定，且现在由 distDir 派生）。

**实测新鲜度结论：三站当前全部新鲜（未重建，与你的历史实测一致）**

| 目录 | 目录内文件最大 mtime | 文件数 |
|---|---|---|
| `apps/astro/src` | `2026-09-20T18:13:36.765Z` | 28 |
| `apps/astro/dist` | `2026-09-20T18:27:03.630Z` | 50 |
| `apps/astro/dist-erp` | `2026-09-20T18:46:18.164Z` | 44 |
| `apps/astro/dist-yunque` | `2026-09-20T18:46:35.264Z` | 44 |

```
node scripts/astro-copy-render-diff.mjs   → 300-…log   render_diff_exit=0
node scripts/astro-copy-hero-diff.mjs     → 301-…log   hero_diff_exit=0
node scripts/astro-copy-client-bundle.mjs → 302-…log   client_bundle_exit=0
```

三只的 `[dist-fresh]` 三行完全相同且均判定 `新鲜`；hero-diff 的成功行与历史 `296-hero-diff-final.log` 逐字相同，render-diff 的比对判定与历史 `295-render-diff-final.log` 一致（`差异 0 条`），client-bundle 三站 `禁止串命中=0 CMS地址已内联=true`。

**为什么不用 `gitRev`**（写进证据，脚本里只留一行注释）：`scripts/astro-copy-render-text.mjs:142` 记录的 `gitRev` 是**提取时的 `HEAD`**，而本 change 的改动全程未提交 ⇒ 基线与本轮的 `HEAD` 相同、工作树却不同，比较 `gitRev` 分辨不出产物新鲜度（只有 mtime 能）。

**断言不是空门禁（负向自证）**：`node /d/Temp/astrocopy-freshness-probe.mjs F:/juece-grow` → `303-dist-freshness-negative-probe.log`，`negative_probe_exit=0`（= 探针自己通过）。它在 `D:\Temp` 造一座假仓（跑完 `rmSync` 删除，未在仓库内留任何文件），把三站分别置为「新鲜 / 与源码同刻 / 目录不存在」，然后把**真门禁脚本**复制进假仓执行：

```
  ! erp：产物不新于源码（apps/astro/dist-erp 最大 mtime 2026-09-20T18:13:36.765Z ≤ apps/astro/src 最大 mtime …）⇒ 该站须重建：pnpm astro:build:erp
  ! yunque：缺构建产物 apps/astro/dist-yunque ⇒ 先跑 pnpm astro:build:yunque
gate_exit=1
断言：problems=2(true) 点名 astro:build:erp(true) 点名 astro:build:yunque/缺产物(true) 新鲜站不报(true) 门禁退出码=1(true) ⇒ 负向探针=PASS
```

## 6. 任务 5：台账证据镜像 + 归档门禁（spec H-1）

镜像前先做 basename 唯一性检查（实测）：台账 **190 行 / 190 条 artifact 指针 / 190 个不同 artifact 路径**，其中指向 `.aiws/tmp/astro-page-copy-cms/` 的 **190 条**、非 tmp 指针 **0 条**；`basename` 两两不相等（**撞名 0 组**）；190 个原件全部仍在 tmp，合计 **198727 字节**、最大 `157-e2e-page-copy.log = 14954 字节`。⇒ 无需改名或加前缀，全部按原文件名复制进 `.aiws/changes/astro-page-copy-cms/evidence/logs/`（实测 `archived_files=190 archived_bytes=198727`，与原件合计相同）。

```
node scripts/astro-copy-evidence-archive.mjs   → 304-evidence-archive-run1.log      archive_exit=0
node scripts/astro-copy-evidence-archive.mjs   → 305-evidence-archive-rerun-idempotent.log   archive_rerun_exit=0
```

```
[evidence-archive] 台账行数=190 无 artifact 行=0 不同 artifact=190 归档目录=.aiws/changes/astro-page-copy-cms/evidence/logs
  台账行 sha256 与原件一致=190 原件已清理（仅断言归档件存在）=0 问题=0
```

计数口径：**present=190 / missing=0**（缺归档件 0 条）、sha 一致 190 条、原件已清理而只核归档件的 0 条（这一类会如实打印、不静默跳过）。
判定项：① 每行有 `artifact`；② 不同 artifact 的 basename 不相等（撞名 ⇒ 镜像互相覆盖，直接红）；③ `evidence/logs/<basename>` 存在；④ 原件仍在则 sha256 必须相等。任一不满足即非零退出并逐条列出行号与路径。
**零副作用实测**：脚本只 `readFileSync`/`existsSync`，无任何写文件调用；第二次运行的日志末尾附了 `evidence/logs` 的目录内容摘要（`find … -type f -exec sha256sum {} + | sort | sha256sum`）在门禁跑前/跑后各取一次，两次同为 `00bf58d87eb0dc0cd6d25aacf7e8146ceaf338f7402ed8ef88528a5058f04356` ⇒ 重复跑不产生副作用（190 份归档件内容不变，`files=190`）。
归档门禁同样做了负向自证：`node /d/Temp/astrocopy-archive-probe.mjs F:/juece-grow` → `306-evidence-archive-negative-probe.log`，`negative_probe_exit=0`；假台账 4 行分别构造「镜像一致 / 缺镜像 / 镜像 sha 不等 / 原件已清理」，真门禁复制进假仓跑出 `gate_exit=1`、`问题=2`、`原件已清理（仅断言归档件存在）=1` 并点名 `b-missing-mirror.log` 与 `c-sha.log` ⇒ 缺件与篡改都咬，原件消失那类只计数不误红。
（订正说明：306 第一次跑时探针自己的期望串写成 `缺归档件 logs/…`，而门禁打印的是完整相对路径 `.aiws/changes/…/evidence/logs/…`，故该轮记为 false；**门禁行为未变**，只修探针后重跑覆盖 306。）

## 7. 本轮日志台账（297–308）

| 日志 | 命令 | 退出码键 | 值 |
|---|---|---|---|
| `297-coverage-promoted.log` | `node scripts/astro-copy-coverage.mjs` | `coverage_exit` | 0 |
| `298-agents9-promoted-limit1000.log` | `node scripts/astro-copy-agents9.mjs` | `selfcheck_exit` | 1 |
| `299-agents9-tmp-original-limit1500-recheck.log` | `node .aiws/tmp/astro-page-copy-cms/268-agents9-selfcheck.mjs` | `selfcheck_exit` | 1 |
| `300-render-diff-freshness-and-cap-tone.log` | `node scripts/astro-copy-render-diff.mjs` | `render_diff_exit` | 0 |
| `301-hero-diff-shared-manifest.log` | `node scripts/astro-copy-hero-diff.mjs` | `hero_diff_exit` | 0 |
| `302-client-bundle-shared-manifest.log` | `node scripts/astro-copy-client-bundle.mjs` | `client_bundle_exit` | 0 |
| `303-dist-freshness-negative-probe.log` | `node /d/Temp/astrocopy-freshness-probe.mjs F:/juece-grow` | `negative_probe_exit` | 0（内含 `gate_exit=1`） |
| `304-evidence-archive-run1.log` | `node scripts/astro-copy-evidence-archive.mjs` | `archive_exit` | 0 |
| `305-evidence-archive-rerun-idempotent.log` | 同上（第二次） | `archive_rerun_exit` | 0 |
| `306-evidence-archive-negative-probe.log` | `node /d/Temp/astrocopy-archive-probe.mjs F:/juece-grow` | `negative_probe_exit` | 0（内含 `gate_exit=1`） |
| `307-agents9-final-after-new-scripts.log` | `node scripts/astro-copy-agents9.mjs` | `selfcheck_exit` | 1 |
| `308-gitignore-log-negation-probe.log` | `sh /d/Temp/gitignore-negation-probe.sh` | `gitignore_probe_exit` | 0（见 §8.2 修法验证） |

## 8. 我判断你方案不成立之处（按你要求：说明理由，不改设计）

### 8.1 「agents9 改 `LIMIT=1000` 后跑一次确认仍 `exit=0`」这个前提现在不成立
不是 1000 的锅，是 P11-a 之后多了一对 `migrate:create` 生成物没有进豁免清单（`20260920_195201_page_copy_project_unique_index.json` 8098 行；同批 `.ts` = 18 行·门禁口径，本身不红）。对照实验：tmp 原件 `LIMIT=1500` 在本轮同样红、同样点名这一条（299 里那行是 `FAIL §4 自研文件 ≤1500 行 :: apps/cms/src/migrations/20260920_195201_page_copy_project_unique_index.json=8098`）。
要么你把这两条生成物加进 `generated` 清单（性质与已豁免的 `20260920_121115` 完全同类，属白名单新增，所以我没动），要么改判据为「按 `apps/cms/src/migrations/**` 目录整体豁免」——后者不再需要逐个登记、也不会每加一次迁移就红，但那是改设计，同样等你拍板。**在清单扩掉之前，`node scripts/astro-copy-agents9.mjs` 就是 exit=1，这条门禁不能作为交付绿灯引用。**

### 8.2 「入库镜像」这一步会被 `.gitignore` 静默吃掉，H-1 实际未闭合
`git check-ignore -v` 实测：`.gitignore:18: *.log` 命中归档件；`evidence/logs/` 的 190 份里 **189 份是 `.log`、只有 1 份 `.json`**。用 dry-run 证明后果：

```
git add -n  -- .aiws/changes/astro-page-copy-cms/evidence/logs/   → 只会 add 1 个文件（23-articles-probe.json）
git add -n -f -- …                                                → 190 个
```

`git add <dir>` 对 ignored 文件是**静默跳过**，所以按常规提交流程走，归档目录进 git 的只有 1 份、台账 189 条指针换 clone 后照样失效，而 `astro-copy-evidence-archive.mjs` 仍会全绿（它核的是磁盘镜像，不是 git 可见性）。修法要动 `.gitignore` 或提交方式，超出本轮「只动 scripts/ + evidence/」的授权，我没做。可选：
1. `.gitignore` 加一条例外 `!/.aiws/changes/**/evidence/logs/*.log`。**已在临时仓验证（本仓 `.gitignore` 未改）**：`D:/Temp/gitignore-probe` 里 `git init` 后原样复制本仓 `.gitignore`，放 `evidence/logs/a.log` + `b.json` 两份 → 加例外前 `git add -n` 只列出 `b.json` 与 `.gitignore`（2 条），把例外追加到同一文件末尾后再跑则列出 3 条（`a.log` 也在内），`git check-ignore -v` 改判为命中 `!/.aiws/changes/**/evidence/logs/*.log`。全程见 `308-gitignore-log-negation-probe.log`（`gitignore_probe_exit=0`，临时仓跑完即删）。
2. 或提交时固定 `git add -f`（零配置，但每次都要记得，且新人 clone 后无提示）；
3. 若想让门禁自己咬这件事，可以给 `astro-copy-evidence-archive.mjs` 再加一条「归档件必须对 git 可见」的断言（`git check-ignore` 只读即可判），本轮按「不擅自加判定」留着。

### 8.3 四处小口径偏差 / 台账缺口（不影响门禁成立，登记备查）
- `astro-copy-client-bundle.mjs` 的头注释原写「用法：`cd apps/astro && node ../../scripts/…`」；该脚本的路径其实一直是自解析的，我把用法行改成 `node scripts/astro-copy-client-bundle.mjs`（与 cwd 无关，另两只同口径）。它原来在循环里硬编码一长串「先跑 pnpm astro:build / astro:build:erp / astro:build:yunque」的建议，本轮改为：三站入口名统一由 `astro-copy-dist-dirs.mjs` 的 `buildCmd` 给出（新鲜度断言点名 + 保留的 `_astro` 缺失分支同样引用它），同一条建议在仓内不再有第二份字面量。`_astro` 存在性检查本身保留（那是 dist 之外的另一个目录、另一条判定，且现在由 distDir 派生）。改后复跑 → `302-client-bundle-shared-manifest.log`，`client_bundle_exit=0`，输出与改动前逐字相同。
- 297 与历史 140 逐字相同，但 140 的**产生命令**是 tmp 版；台账里指向 140/63/142 那些行的 `command` 字段仍是 tmp 路径。持久入口是否要在台账里补记/改写由你决定（本轮不改台账）。
- 本轮新日志 297–308 未入账、也未镜像。**一旦台账追加指向它们，`astro-copy-evidence-archive.mjs` 会立刻红**（报「缺归档件」），届时须先把这几个文件复制进 `evidence/logs/` 再跑归档门禁 —— 这是设计如此，不是故障。
- **台账根本没记过 268 那次自检**（实测：`grep -c "268" .aiws/changes/astro-page-copy-cms/evidence/verification.jsonl` = 0）⇒ `.aiws/tmp/astro-page-copy-cms/268-agents9-selfcheck.log` 既没入账、也就没进本轮的 190 份镜像。任务 3.9 现在有了持久门禁（`scripts/astro-copy-agents9.mjs`），但台账对这一条验收仍然是空白，须由 P11-d 追加（追加时把 268 与 297–308 一起镜像进 `evidence/logs/`，否则归档门禁会红）。

## 9. 本轮未做 / 后续项

- 未跑构建（授权禁止）⇒ `apps/astro/dist{,-erp,-yunque}` 维持你上轮构建产物；三只 dist 门禁本轮全绿是**基于实测 mtime 的新鲜度**，若之后任何人改 `apps/astro/src/**` 而只重建主站，`erp`/`yunque` 那两行会立刻点名要跑 `pnpm astro:build:erp` / `pnpm astro:build:yunque`。
- 其余清单硬编码本轮按你指示未动，登记为后续项（实测命中面）：site 清单两份 —— `astro-copy-parity.mjs:29`（`SITES`）、`astro-copy-render-text.mjs:31`（`SITE_ORDER`）；`page → dist 内 HTML 相对路径` 映射两份 —— `astro-copy-render-text.mjs:33-38` 与 `astro-copy-hero-dom.mjs:21-26`（同一份映射的两次抄写）；`astro-copy-cms-unreachable.mjs:78` 只硬编码 `apps/astro/dist` 一只目录（它是负向构建脚本，本轮授权禁止运行）。
- 未做 `aiws validate .`、未做双审查 triage、未入账（P11-d 负责）。
- 三只探针在仓库外（`D:\Temp\astrocopy-{freshness,archive}-probe.mjs`、`D:\Temp\gitignore-negation-probe.sh`），不入库；它们造的假仓/假临时目录均在脚本尾部自行 `rmSync`/`rm -rf` 清理（本轮实测 `D:/Temp/gitignore-probe` 已删），完整输出分别落在 303 / 306 / 308，可据此原样重建。

## 10. AGENTS.md §9 自检（针对本轮改动面）

- 命名：新增文件全 camelCase 字段/变量，无 snake_case 泄漏；文件命名沿用既有 `astro-copy-*` 前缀。
- 依赖：零新依赖（只用 `node:` 内建），未引入任何外部 CMS/SaaS。
- 兜底/双写：`maxMtimeMs` 缺目录显式返回 `null` 并由调用方判红（无默认值兜底）；构建入口名不在根 `package.json` 里即抛（无猜测兜底）；三站清单与新鲜度判定各一份实现，三只门禁 import 同一份。
- 文件行数：新增/改动 7 只脚本全部 ≤179 行（`wc -l` 实测见 §1 表）。
- API/SEO/线索数据：本轮未触碰（`astro-copy-agents9.mjs` 的 §6/§7 断言本轮均为 `OK`，见 298/307）。
- 影响范围：仅验证面（门禁 + 证据镜像），不改变任何运行时行为；`apps/` 与数据库零改动。
