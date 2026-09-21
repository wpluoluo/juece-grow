/**
 * 客户端 bundle 污染门禁（PROB-026 的机器对面，零手填参数）。
 *
 * 为什么需要它：Vite/Astro 只把 `PUBLIC_` 前缀的环境变量内联进客户端 bundle。`SITE_ID` 没有该前缀，
 * 所以任何被浏览器侧脚本**传递引到** `apps/astro/src/site.ts` 的 import，都会在页面运行时抛
 * 「缺少 SITE_ID」——整块 `<script>` 模块死掉、事件监听全丢，而 `astro build`、`tsc --noEmit`、
 * 文案 parity、可见文本与 hero DOM 逐字比对**全部为绿**（它们都只看服务端产物）。
 * 2.15 删掉 `site.ts` 的 `|| 'juece'` 兜底后，这条断裂就真实发生过一次，由 e2e 的 `lead.spec.ts` 抓到。
 *
 * 判定（三站产物 `dist` / `dist-erp` / `dist-yunque` 各自的 `_astro/*.js`）：
 *   1. 不得出现 `src/site.ts` 的运行时报错文案（`缺少 SITE_ID` / `Unknown SITE_ID`）⇒ 服务端站点解析没进浏览器；
 *   2. `Layout.astro` 的脚本 chunk 里 CMS 地址必须是已内联的字面量（不得残留 `import.meta.env.PUBLIC_CMS_ORIGIN`）
 *      ⇒ 客户端确实走 `src/lib/cmsOrigin.ts` 这条客户端安全路径。
 *   任一条不成立即非零退出并列出命中的 chunk，不跳过、不兜底。
 *
 * 用法：`node scripts/astro-copy-client-bundle.mjs`（零手填参数、与 cwd 无关；须先跑过三站构建）
 * 三站 dist 清单与「产物必须比 apps/astro/src 新」的断言只在 `scripts/astro-copy-dist-dirs.mjs` 写一份，
 * 本脚本 import 它（与 render-diff / hero-diff 共用，quality W-2 的修法）。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDistFreshness, resolveDistSites } from './astro-copy-dist-dirs.mjs'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITES = resolveDistSites(repoRoot)
const FORBIDDEN = ['缺少 SITE_ID', 'Unknown SITE_ID']

const freshness = checkDistFreshness(repoRoot)
for (const row of freshness.rows) console.log(`[dist-fresh] ${row}`)

if (freshness.problems.length > 0) {
  console.error(`[client-bundle] dist 新鲜度断言未过（${freshness.problems.length} 站）：\n  ${freshness.problems.join('\n  ')}`)
  console.error('判定=FAIL：产物不比 apps/astro/src 新 ⇒ 扫旧 bundle 证明不了任何事，先跑上面指明的构建入口')
  process.exitCode = 1
} else {
  let failed = false

  for (const { site, distRel, distDir, buildCmd } of SITES) {
    const astroDir = path.join(distDir, '_astro')
    if (!existsSync(astroDir)) {
      console.log(`${site} ${distRel}: 缺 _astro 目录 —— 未构建，先跑 ${buildCmd}`)
      failed = true
      continue
    }
    const chunks = readdirSync(astroDir).filter((f) => f.endsWith('.js'))
    const hits = []
    let layoutChunk = null
    for (const name of chunks) {
      const text = readFileSync(path.join(astroDir, name), 'utf8')
      for (const marker of FORBIDDEN) {
        if (text.includes(marker)) hits.push(`${name} 含「${marker}」`)
      }
      if (name.startsWith('Layout.astro_astro_type_script')) layoutChunk = text
    }
    const inlined =
      layoutChunk !== null &&
      !layoutChunk.includes('import.meta.env.PUBLIC_CMS_ORIGIN') &&
      /["']https?:\/\/[^"']+/.test(layoutChunk)
    const ok = hits.length === 0 && inlined
    if (!ok) failed = true
    console.log(
      `${site} ${distRel}: client_js=${chunks.length} 禁止串命中=${hits.length} CMS地址已内联=${inlined} ` +
        `Layout脚本chunk=${layoutChunk === null ? '缺失' : '有'} 判定=${ok ? 'OK' : 'FAIL'}`
    )
    for (const h of hits) console.log(`  - ${h}`)
  }

  if (failed) {
    console.log('判定=FAIL：服务端模块被客户端脚本传递引到，浏览器运行时会抛错（见 PROB-026）')
  } else {
    console.log('判定=OK：三站客户端 bundle 均不含服务端站点解析，CMS 地址已内联')
  }
  process.exitCode = failed ? 1 : 0
}
