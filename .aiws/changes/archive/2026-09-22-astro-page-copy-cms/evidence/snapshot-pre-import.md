# 证据：导入前快照与基线（P1 / tasks 2.1、2.1b）

> Change: `astro-page-copy-cms` · 生成时间 2026-09-20 · 基线 git rev `7279d55e91cb7994f604e4d3cec16f1af5ef9c66`（本 change 分支起点，`apps/astro` 当时零改动）
>
> 用途：本 change 把三站四页的文案从 `apps/astro/src/content/*.ts` 搬进 Payload 后台。这份快照是**唯一回滚依据**与**逐字比对的对照面**——第 7 步切完读路径后，用同一批脚本重放，输出必须与此处逐字一致（tasks 3.1 / 3.4）。

## 目录内容

```
snapshot-pre-import/
├── {page}.{site}.json      12 份内容 dump（page ∈ home|features|solutions|pricing，site ∈ juece|erp|yunque）
├── manifest.json           每份 dump 的源文件 sha256 / dump sha256 / 叶子字符串数 / 字符数
└── render/
    ├── {site}/{page}.txt   12 份渲染后可见文本基线
    └── _index.json         每份 txt 的 sha256 / 行数 / 字符数 + gitRev + 抽取器自身 sha256
```

## A. 内容 JSON dump（tasks 2.1）

- 生成器：`.aiws/tmp/astro-page-copy-cms/dump-content-sources.mjs`，命令 `node .aiws/tmp/astro-page-copy-cms/dump-content-sources.mjs` → 日志 `20-dump-content.log`，`exit=0`。
- 实测规模：**12 份 / 1374 个叶子字符串 / 13922 字符**，与规划轮对 `content/*.ts`（1933 行）的单元计数一致。单站单页区间 48（`pricing.yunque`）～140（`features.juece`）个单元。
- 取数方式：直接 `import` 四个模块的 `homeContent`/`featuresContent`/`solutionsContent`/`pricingContent`（都是 `Record<SiteId, …>`），`JSON.stringify(…, null, 2)` 落盘 ⇒ 键序即源码序，不做任何文本切分。
- **必须记录的实现约束**：`content/*.ts` 顶部 `import { siteId } from '../site'`，而 `site.ts:168` 读 Vite 专有的 `import.meta.env` ⇒ 纯 Node 直接 `import` 会 `TypeError`。生成器用 `node:module` 的 `registerHooks({resolve})` 把来自 `src/content/` 的 `'../site'` 解析到一个常量桩（`export const siteId = "juece"`）。桩值只服务被删掉的那行单例导出（`homeContent[siteId]`），**不参与本脚本取记录**（取的是 `record[site]` 逐站点显式取），因此不污染 dump 内容。
- 两项复核（主 session 亲自跑，不采信自述）：
  1. 确定性：复跑一次，`manifest.json` sha256 不变（`02f32a10…`）。
  2. 无转义损失：`features.ts:158` 那句内嵌 ASCII 双引号的文案在 `features.juece.json:188` 呈现为 `\"能跑\"`，读回可原样还原。

## B. 渲染后可见文本基线（tasks 2.1b）

前置状态（实测）：本地容器库 `juece-grow-postgres`（`127.0.0.1:5434`）在跑；CMS dev 在 `127.0.0.1:3000`，`GET /api/v2/content/articles?site=` 三站皆 `200`，已发布文章数 **juece 5 / erp 2 / yunque 2**（首页 blog 区块会渲染它们）。

构建（用仓库既有脚本，串行；退出码由命令自身重定向落盘，不过管道）：

| 命令 | 日志 | 退出码 |
| --- | --- | --- |
| `pnpm astro:build` | `24-build-juece.log` | 0（pagefind 索引 13 页） |
| `pnpm astro:build:erp` | `25-build-erp.log` | 0（pagefind 索引 10 页） |
| `pnpm astro:build:yunque` | `26-build-yunque.log` | 0（pagefind 索引 10 页） |

抽取器：`scripts/astro-copy-render-text.mjs`（持久脚本，第 7 步后原样重放做 3.4 比对）。
接口 `node scripts/astro-copy-render-text.mjs <distDir> <site> <outDir>`，`outDir` 必须是 `…/snapshot-pre-import/render`。算法固定：删 `<head>`/注释/`script|style|svg|template|noscript` 区块 → 块级闭合标签与 `<br>` 转换行 → 删剩余标签 → 解码实体（单遍，避免二次解码）→ 逐行压空白并丢空行 → UTF-8 + LF + 末尾单换行。**不做任何按内容的过滤**；缺任一 HTML 直接非零退出（已实测：路径写错时报 `缺少 HTML：…` 且不产出半套基线）。

实测规模：12 份 / **1269 行 / 20275 字符**；行数分布 `home` 106·97·97、`features` 95×3、`solutions` 163×3、`pricing` 66·65·64（依次 juece/erp/yunque）。

复核（主 session 独立重算，非采信脚本自述）：

1. 完整性：`render/` 下恰 12 个 `.txt` + `_index.json`，全部非零字节（最小 2622B）；逐文件重算 sha256 与 `_index.json` 记录一致（12/12，0 不匹配）。
2. 幂等：对同一 dist 重复重放共 **3 轮**（含抽取器去掉两处不可达兜底之后的一轮），12 份文本 sha256 与首轮完全一致 ⇒ 抽取器改动是行为中性的。
3. dump ↔ 渲染交叉核对（证明基线确实覆盖到被搬的文案）：`features.juece.json` 的「让智能体从「演示能跑」到「上线能用」」在 `render/juece/features.txt`；`render/juece/home.txt:13` 有「你的生意有三件正事」且 `erp/home.txt`、`yunque/home.txt` 各 0 次；`render/yunque/pricing.txt:18` 有「多数希望通过智能体提效的团队，从这一档开始」且为他站所无。
4. 站点隔离确实生效：`diff juece/features.txt erp/features.txt` 计 **152** 行差异。

## 已知噪音与处置规则（不过滤，按规则判定）

首页有两类非 `content/*.ts` 来源的文本，照原样留在基线里：

1. **blog 卡片行**（`getArticles()` 从 CMS 拉）：juece 5 组、erp/yunque 各 2 组，形如「项目名·日期+标题 / 摘要 / 系统管理员 阅读全文」（`render/juece/home.txt` 约 70–84 行）。
2. **页脚 `© 2026`**：由模板 `new Date().getFullYear()` 在构建期求值，各站 home 各 1 行。

处置规则：本 change 不删文章、不改 `getArticles` 调用，基线与重放面对同一本地库同一批已发布文章 ⇒ 这些行**应当逐字相同**。若 3.4 的比对在这里出现差异，判据是「DB 状态或读路径被动过」，属缺陷要查根因，**不允许**把这些行加进白名单或写进过滤逻辑（那正是 AGENTS.md §4 禁的兜底）。`features`/`solutions`/`pricing` 三页经核不含任何日期或文章动态行。

## 过程记录（不美化）

首轮重放时主 session 把 `outDir` 少写成 `…/snapshot-pre-import`（漏 `/render`），在快照目录根造出一套 12 份游离 `.txt` 与一个 `_index.json`。清理前已用 `cmp` 证明游离件与 `render/` 基线逐字节相同，随后删除；当前目录树只保留上表所列文件。

## 重放步骤（切换前后都适用）

```bash
pnpm db:up                                   # 容器 juece-grow-postgres 已在跑，幂等
pnpm cms:dev                                 # 需人工持有；构建期 Astro 会拉 CMS
node .aiws/tmp/astro-page-copy-cms/dump-content-sources.mjs
pnpm astro:build && pnpm astro:build:erp && pnpm astro:build:yunque
R=.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import/render
node scripts/astro-copy-render-text.mjs apps/astro/dist          juece   $R
node scripts/astro-copy-render-text.mjs apps/astro/dist-erp      erp     $R
node scripts/astro-copy-render-text.mjs apps/astro/dist-yunque   yunque  $R
```

注：`dump-content-sources.mjs` 在 `.aiws/tmp/`（gitignored）——它是一次性取证工具，不入库；`astro-copy-render-text.mjs` 在 `scripts/`，是交付物的一部分。第 7 步之后的比对用 `render/` 当前这套文本，`_index.json` 里的 `extractorSha256` 必须与盘上脚本一致，否则说明抽取器被改过、比对不成立。
