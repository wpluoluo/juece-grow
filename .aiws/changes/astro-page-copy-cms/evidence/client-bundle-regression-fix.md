# P6/P7 证据：e2e 读路径用例与客户端 bundle 回归（PROB-026）

- `Change_ID`: astro-page-copy-cms · `Req_ID`: REQ-0003 · `Problem_ID`: PROB-026
- `Change type`: frontend-logic（Playwright 门禁强制）＋ 测试资产
- 覆盖 tasks：2.17（e2e 读路径用例）、3.11（客户端 bundle 产物门禁）、2.15 的回归补偿
- 日志目录：`.aiws/tmp/astro-page-copy-cms/`，台账：`evidence/verification.jsonl`
- 全程只连本地容器库（`127.0.0.1:5434`）与本地 CMS（`:3000`）/ Astro dev（`:4321`），未触碰线上；`.env` 与 secrets 本轮**零写入**

## 1. 本轮做了什么

1. 由实现代理（subagent-first）新增 `apps/e2e/tests/page-copy.spec.ts`：5 个 `test(` 声明、参数化展开后 8 条实跑用例——跨站不串台、浏览器文本 == 端点 `copy`、四条 400 信封（匿名）、原生 REST 匿名 403、草稿不可见 404（探针自恢复）。
2. `apps/e2e/setup/global-setup.ts` 预热表补两条（`/api/v2/content/pages?site=juece&page=pricing`、`/pricing`）。Playwright 配置是 `workers:1` + 每条 `timeout:30_000`，Next/Astro 冷编译 ~48s ⇒ 不预热就会把首条用例撞成超时假红。
3. 该轮**抓到一处 P5（tasks 2.15）引入的产品回归**，当场按根因修毕并固化成门禁（§2–§5）。

## 2. 现象：五道门禁全绿，浏览器用例红

| 取证 | 结果 |
|---|---|
| `157-e2e-page-copy.log` | `65 passed / 2 failed`、`e2e_exit=1`；红的两条是 `lead.spec.ts:11` 与 `:18`，新增 8 条全绿 |
| `158-e2e-lead-only.log` | 收窄到 `lead.spec.ts` 单跑：`10 passed / 2 failed`、`e2e_lead_only_exit=1` ⇒ 与新 spec 无关 |
| `159-e2e-full.log` | 全量口径同一条回归：`65 passed / 2 failed`、`e2e_full_exit=1` |
| 同期服务端门禁 | `astro:typecheck` 0、三站构建各 0、parity `12/12`、render-diff `12/12`、hero-dom sha 未变 ⇒ **全部为绿** |

工具口径（登记一次，免得后人重踩）：`pnpm --filter e2e test -- <path>` **不过滤**——pnpm 把 `--` 原样透传给 `playwright test`，该命令实跑全量。收窄要用 `pnpm --filter e2e exec playwright test <path>`。

## 3. 根因（`158-lead-diagnose.mjs` → `158-lead-diagnose.log`，`diagnose_exit=0`）

Vite/Astro 只把 `PUBLIC_` 前缀的环境变量内联进客户端 bundle。`SITE_ID` 没有该前缀 ⇒ 浏览器侧 `import.meta.env.SITE_ID` 恒为 `undefined`。

`Layout.astro:297` 的客户端 `<script>` 为了拿 CMS 地址 `import ... from '../lib/payload'`，而 `lib/payload.ts` 顶部 `import { siteId } from '../site'` ⇒ 站点解析代码被打包进浏览器：

- **2.15 之前**：`site.ts` 的 `|| 'juece'` 兜底把它静默兜住（客户端永远按主站跑，看着"正常"）；
- **2.15 之后**（兜底按要求删除，禁兜底）：模块顶层直接抛 `缺少 SITE_ID：…` ⇒ 整块 `<script>` 模块死掉，表单/搜索/抽屉的事件监听一个都不注册。表现是「页面看着对，点了没反应」，且 `astro build`、`tsc`、所有文案门禁都不红。
- 该断裂**已进生产产物**：`dist/_astro/Layout.astro_astro_type_script_index_0_lang.*.js` 里能 grep 到那句中文报错（`grep_site_id_in_dist_exit=0`）。

即：删兜底不是问题，删兜底**暴露**了一直存在的图污染。线上未部署，故无线上影响面（见 `evidence/release-prerequisites.md` 的「线上未执行」口径）。

## 4. 修法（治根因，不加兜底、不改 DOM）

| 文件 | 改动 |
|---|---|
| `apps/astro/src/lib/cmsOrigin.ts`（新增 21 行） | 只读 `import.meta.env.PUBLIC_CMS_ORIGIN`，缺键/空值即模块级抛（可读文案指向 `.env` 的唯一正确键名）；导出 `CMS_ORIGIN` |
| `apps/astro/src/lib/payload.ts` | 让出该校验（不再 export `CMS_ORIGIN`），改为 `import { CMS_ORIGIN } from './cmsOrigin'` —— 服务端路径不重复实现 |
| `apps/astro/src/layouts/Layout.astro:297` | 客户端脚本改 `from '../lib/cmsOrigin'` |
| `apps/astro/src/pages/index.astro:3`、`articles/[slug].astro:6` | 拆 import：`CMS_ORIGIN` 走 `lib/cmsOrigin`，取数helper/类型走 `lib/payload` |

否决的替代方案（写进 design D6 的 P6 追加条）：

- `define:vars` 或 `data-cms-origin` 注入 DOM ⇒ 会新增属性，直接违反 REQ-0003 非目标第 3 条（DOM 逐字一致）。由 `167` 的 hero-dom 门禁与 sha 未变（`e582aa63e253effd`）证明本轮**确实没动 DOM**。
- 给 `SITE_ID` 加 `PUBLIC_` 前缀 ⇒ 把服务端站点解析变成浏览器可覆写的运行时输入，且要连带动三站脚本与 `astro.config.mjs`，风险大于收益。
- 保留 `lib/payload` 的 re-export 垫片 ⇒ 双写，AGENTS.md §4 禁止。

## 5. 复测链（退出码均由命令自身落盘）

| 日志 | 内容 | 退出码 |
|---|---|---|
| `162` | `pnpm astro:typecheck`（修复后） | `typecheck_exit=0` |
| `163` | `pnpm astro:build:juece` —— **我把脚本名打错了**，该入口不存在 | `build_juece_exit=1`（操作失误，非产品缺陷） |
| `164`/`165`/`166` | 三站构建 `astro:build:erp` / `:yunque` / `astro:build` | 各 `exit=0`，`166` 内 `grep -c ECONNREFUSED` = 0 |
| `167` | 三站 hero-dom 抽取 + 与导入前基线 diff | 三段 `extract_*_exit=0`、`hero_dom_diff_exit=0`，整表 sha 未变 |
| `168` | `node scripts/astro-copy-render-diff.mjs` | `render_diff_exit=0`，`12/12 逐字一致` |
| `170` | 全量 e2e | `e2e_full_exit=0`，`67 passed / 2 skipped`（红侧对照见 `159`） |
| `173` | 新门禁 `node scripts/astro-copy-client-bundle.mjs` | `client_bundle_gate_exit=0`，三站均「命中=0 / 已内联=true / 判定=OK」 |
| `174` | 新门禁咬合力自测（注入桩串 → 三站逐站报 FAIL 且退出码 1 → `finally` 还原 → 归零） | `client_bundle_negative_exit=0` |

## 6. 门禁固化与真值同步

- **新持久门禁** `scripts/astro-copy-client-bundle.mjs`（零参数，tasks 3.11 / 计划 P-V8）：查三站产物 `_astro/*.js`，① 不得含 `site.ts` 的报错文案（`缺少 SITE_ID` / `Unknown SITE_ID`），② `Layout` 脚本 chunk 的 CMS 地址必须是已内联字面量（不得残留 `import.meta.env.PUBLIC_CMS_ORIGIN`）。首轮一次性探针（`169`）跑出同结论后即固化成本脚本并删除 tmp 脚本 ⇒ 实现只有一份，台账登可复现的 `173` 而非 `169`。
- **问题台账**：`append-prob-026.mjs` 追加 `PROB-026`（P1，Status DONE，发现—根因—修法—复测—门禁全链），25 → 26 行；复跑 `no-op`（`175`/`176`）。
- **需求合同**：`append-req0003-p6-sync.mjs` 把 REQ-0003 `Tests` 的门禁清单由三道改称四道并补上新脚本，CHANGELOG 追加 1 行（`177`/`178` 复跑 `no-op`）。`REQUIREMENTS.md` 的验收措辞不列门禁脚本名 ⇒ 盖章真值未改，无需 `aiws change sync`。
- `REQ_SYNC: SYNCED`
- 五处工件已同步：`plan/2026-09-20_10-04-01-astro-page-copy-cms.md`（步骤 7 的校验落处修正、步骤 8 门禁范围改 P-V1..P-V8、Verify 表加 P-V8、新增风险 **R6**）、`proposal.md`（第 5/7 条与验证命令/期望结果）、`design.md`（D6 P6 追加条 + 否决方案 + Test Seams 第 5 层）、`tasks.md`（2.15 交叉引用、2.17 勾选、新增 3.11）、台账（PROB-026 / REQ-0003 合同行 / CHANGELOG）。

## 7. 台账入账口径（99 → 121 行）

`append-verification-p6.mjs` 共声明 22 行：`181` 首跑 `appended=19` → 补红绿对照的 `159` 后 `184` 再 `appended=1` → 工件同步复校（`187`/`188`）后 `189` 再 `appended=2`；每次复跑均 `no-op`（`182`/`185`）。只读审计器 `114-audit-ledger-coverage.mjs` 对 9 个 appender 逐批核对，`missing_total=0` 三次：`183` 报 `ledger_rows=118`、`186` 报 `119`、`190` 报 `121`。

本轮**不入账**的四类，理由逐条登记（不再静默丢弃）：

| 工件 | 不入账理由 |
|---|---|
| `156-astro-dev-start.log` | 长驻 dev server 的启动日志，没有退出码可言 |
| `157-astro-pricing.html`、`157-probe-{juece,erp}-pricing.json` | 诊断原始输出（供 §2 的红与「跨站不串台」肉眼核对），不是命令门禁 |
| `160-page-copy-status-recheck.log` | `recheck_exit=0` 在，但跑的是临时 curl 循环、日志里没落命令 ⇒ 命令不可复现。其结论（yunque 已复原 `published`）由 `170` 的草稿用例内部复断（置 draft → 404 → 复原 → 200）承担 |
| `161-e2e-tsc.log` | 只剩一行 `tsc_exit=0`，命令与配置都无法复原；且 `apps/e2e` 至今没有类型门禁（无 `tsconfig.json`、仓内未装 `@types/node` ⇒ 独立 `tsc` 必报 `TS2580 Cannot find name 'process'`，见 §8） |

## 8. 遗留（登记不 parked）

1. **`apps/e2e` 无类型检查入口**：包内只有 `{"test": "playwright test"}`，无 `tsconfig.json`，仓内无 `@types/node` ⇒ `helpers/cmsRest.ts:42-43` 的 `process` 无类型来源，独立跑 `tsc` 必红。这与 PROB-014/PROB-025 是同一类缺口。补它要新增 devDependency（`@types/node`），超出本 change 的「不新增依赖」边界 ⇒ 归入后续独立小批（与 3.9 自检项一并处理）。
2. **`tasks/tasks.jsonl` 26 条 `status` 全为 `pending`**，与实际进度（P1–P7 已交）脱节：本轮起 `tasks.md` 是唯一在维护的勾选真值。交付轮（3.10/4.x）要么同步它，要么删掉以免第二真值（AGENTS.md §4 禁双写）。
3. 本轮回归提醒的更广一层：**Astro 客户端脚本没有编译期防线**，任何 `import.meta.env.<非 PUBLIC_>` 进客户端都静默死，靠 e2e 兜底 ⇒ `173` 那道产物门禁已进 REQ-0003 `Tests`，后续 3.3 的全量构建门禁必须串上它（`node scripts/build.mjs` 复跑时一并跑）。
