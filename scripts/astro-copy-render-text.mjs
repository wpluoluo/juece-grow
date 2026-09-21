/**
 * 渲染后可见文本基线抽取器（tasks P1-b / plan 第 1 步）。
 *
 * 从一次 astro build 的 dist 产物里，抽取三站四页「肉眼可见」的纯文本，作为
 * 「文案搬进 CMS 再搬出来」逐字比对的回滚基线。抽取算法固定（见下），与源码解耦：
 * 第 7 步改造后用同一脚本、同一算法重跑，产物应与本基线完全一致。
 *
 * 算法（对每个 HTML 按顺序）：
 *   1. 删 <head>...</head> 整段（含 title/meta/script/style）。
 *   2. 删 HTML 注释 <!-- ... -->。
 *   3. 删成对的 <script>/<style>/<svg>/<template>/<noscript> 区块（不区分大小写、非贪婪、跨行）。
 *   4. 把 <br>/</p>/</div>/</li>/</h1..h6>/</tr>/</section>/</article>/</header>/</footer>/</nav> 替换成换行。
 *   5. 删剩余所有标签。
 *   6. 解码实体（&amp; &lt; &gt; &quot; &#34; &#39; &apos; &nbsp; &mdash; &ndash; &hellip; &copy; 与数字形式）。
 *   7. 逐行：连续空白压成单空格、trim、丢弃空行。
 *   8. 输出 UTF-8、LF、文件末尾单个换行。
 * 不做任何「按内容过滤」：动态内容（如首页 CMS 文章、页脚年份）照原样落盘。
 *
 * 用法：node scripts/astro-copy-render-text.mjs <distDir> <site> <outDir>
 *   - 从 <distDir> 抽 home/features/solutions/pricing 四页，写 <outDir>/<site>/<page>.txt
 *   - 同时把统计合并进 <outDir>/_index.json（边抽边写，可跨多次调用累积三站）
 *   - 缺任一 HTML → 非零退出并说明缺哪个（不跳过、不兜底）
 * 不写死仓库路径；gitRev 通过对脚本所在仓库执行只读 `git rev-parse HEAD` 取得。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_ORDER = ['juece', 'erp', 'yunque']
// page → dist 内的 HTML 相对路径（布局已实测存在）
const PAGES = [
  ['home', 'index.html'],
  ['features', 'features/index.html'],
  ['solutions', 'solutions/index.html'],
  ['pricing', 'pricing/index.html'],
]

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  copy: '\u00A9',
}

/** 按固定算法把 HTML 字符串转成可见纯文本（LF、末尾单换行）。 */
function htmlToVisibleText(html) {
  let s = html
  // 1. head 整段
  s = s.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
  // 2. HTML 注释
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // 3. 成对的内容型/装饰型区块
  for (const tag of ['script', 'style', 'svg', 'template', 'noscript']) {
    s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
  }
  // 4. 块级闭合标签 → 换行
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/(?:p|div|li|h[1-6]|tr|section|article|header|footer|nav)>/gi,
      '\n',
    )
  // 5. 删剩余标签
  s = s.replace(/<[^>]*>/g, '')
  // 6. 解码实体（单遍替换，避免 &amp;#39; 被二次解码）
  s = s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)
      ? NAMED_ENTITIES[body]
      : match
  })
  // 7. 逐行规整
  const lines = s
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/[\s\u00A0]+/g, ' ').trim())
    .filter((line) => line.length > 0)
  // 8. LF + 末尾单换行
  return `${lines.join('\n')}\n`
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

function statsOf(text) {
  const lines = text.slice(0, -1).split('\n').length // 去掉末尾换行再数
  return { sha256: sha256(text), lines, chars: text.length }
}

/** 脚本所在仓库根：scripts/ 的上两级。执行只读 git rev-parse 取 HEAD。 */
function currentGitRev() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const r = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    throw new Error(`git rev-parse HEAD 失败：${r.stderr || r.status}`)
  }
  return r.stdout.trim()
}

function main() {
  const [distDir, site, outDir] = process.argv.slice(2)
  if (!distDir || !site || !outDir) {
    console.error('用法: node scripts/astro-copy-render-text.mjs <distDir> <site> <outDir>')
    process.exit(1)
  }
  if (!SITE_ORDER.includes(site)) {
    throw new Error(`未知 site "${site}"；期望之一：${SITE_ORDER.join(', ')}`)
  }

  const dist = resolve(distDir)
  const out = resolve(outDir)

  // 先确认四份 HTML 都在，再落盘（缺任一 → 非零退出，不产半套基线）
  const missing = PAGES.filter(([, rel]) => !existsSync(join(dist, rel))).map(([, rel]) => rel)
  if (missing.length) {
    throw new Error(`缺少 HTML：${missing.map((rel) => join(dist, rel)).join(', ')}`)
  }

  const siteOutDir = join(out, site)
  mkdirSync(siteOutDir, { recursive: true })

  const indexFile = join(out, '_index.json')
  const index = existsSync(indexFile)
    ? JSON.parse(readFileSync(indexFile, 'utf8'))
    : { generatedFor: 'astro-page-copy-cms', purpose: 'pre-import rendered visible-text baseline', distDirs: {}, files: {} }

  index.generatedFor = 'astro-page-copy-cms'
  index.purpose = 'pre-import rendered visible-text baseline'
  index.gitRev = currentGitRev()
  index.extractCommand = 'node scripts/astro-copy-render-text.mjs <distDir> <site> <outDir>'
  index.extractorSha256 = sha256(readFileSync(fileURLToPath(import.meta.url), 'utf8'))
  index.distDirs[site] = distDir

  const written = []
  for (const [page, rel] of PAGES) {
    const html = readFileSync(join(dist, rel), 'utf8')
    const text = htmlToVisibleText(html)
    const target = join(siteOutDir, `${page}.txt`)
    writeFileSync(target, text, 'utf8')
    const st = statsOf(text)
    index.files[`${site}/${page}`] = { file: `${site}/${page}.txt`, site, page, ...st }
    written.push(`${site}/${page}.txt lines=${st.lines} chars=${st.chars}`)
  }

  // 规范化 files 顺序（site→page 固定序），保证索引与调用顺序无关、可复现
  const orderedFiles = {}
  for (const s of SITE_ORDER) {
    for (const [page] of PAGES) {
      const key = `${s}/${page}`
      if (index.files[key]) orderedFiles[key] = index.files[key]
    }
  }
  index.files = orderedFiles

  writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  console.log(`extracted site=${site} -> ${out}`)
  for (const line of written) console.log(`  ${line}`)
}

try {
  main()
} catch (err) {
  console.error(`[astro-copy-render-text] ERROR: ${err.message}`)
  process.exit(1)
}
