/**
 * 英雄标题 DOM 抽取器（REQ-0003 非目标「不改公开站视觉与 DOM 结构」的机器核对面）。
 *
 * 为什么需要它：`scripts/astro-copy-render-text.mjs` 只比可见文本，`<span class="line">` 与
 * `{text}<br />` 抽出来的文本一模一样 ⇒ 换行机制被改掉它看不见。本脚本按字节抓 `<h1 class="hero-title">`
 * 的内部 HTML，切换前后各跑一次，`diff` 两个 JSON 即可判定结构是否被动过。
 *
 * 归一（只归一噪声，不归一结构）：
 *   1. 删 `data-astro-cid-*` 属性——Astro 的作用域样式哈希会随无关文件的改动而变，不是 DOM 结构。
 *   2. 空白游程压成单空格并 trim——模板缩进/换行造成的文本节点空白不是结构，但元素与顺序全保留。
 *
 * 用法：node scripts/astro-copy-hero-dom.mjs <distDir> <site> <outFile>
 *   - 从 <distDir> 抽 home/features/solutions/pricing 四页的 hero `<h1>`，写进 <outFile>（JSON，按 `<site>/<page>` 存）
 *   - <outFile> 已存在则合并（跨三站累积，与 render/_index.json 同一处置）
 *   - 缺文件、缺 `<h1 class="hero-title">` 一律非零退出并说明缺哪个，不跳过、不兜底
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const PAGES = [
  ['home', 'index.html'],
  ['features', 'features/index.html'],
  ['solutions', 'solutions/index.html'],
  ['pricing', 'pricing/index.html'],
]

const [distArg, siteArg, outArg] = process.argv.slice(2)
if (!distArg || !siteArg || !outArg) {
  console.error('用法：node scripts/astro-copy-hero-dom.mjs <distDir> <site> <outFile>')
  process.exitCode = 1
} else {
  run(resolve(distArg), siteArg, resolve(outArg))
}

/** 删 Astro 作用域哈希属性，再把空白游程压成单空格。 */
function normalizeHtml(inner) {
  return inner.replace(/\s*data-astro-cid-[a-z0-9]+/g, '').replace(/\s+/g, ' ').trim()
}

function run(distDir, site, outFile) {
  const store = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {}
  const missing = []
  for (const [page, rel] of PAGES) {
    const htmlPath = `${distDir}/${rel}`
    if (!existsSync(htmlPath)) {
      missing.push(htmlPath)
      continue
    }
    const html = readFileSync(htmlPath, 'utf8')
    const match = html.match(/<h1 class="hero-title"[^>]*>([\s\S]*?)<\/h1>/)
    if (!match) {
      missing.push(`${htmlPath}（没有 <h1 class="hero-title">）`)
      continue
    }
    store[`${site}/${page}`] = normalizeHtml(match[1])
  }
  if (missing.length > 0) {
    console.error(`[hero-dom] 缺产物，拒绝出结果：\n  ${missing.join('\n  ')}`)
    process.exitCode = 1
    return
  }
  writeFileSync(outFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  const keys = Object.keys(store).length
  const sha = createHash('sha256').update(readFileSync(outFile)).digest('hex').slice(0, 16)
  console.log(`[hero-dom] site=${site} 写入 ${dirname(outFile)} → 条目 ${keys}，sha256=${sha}`)
}
