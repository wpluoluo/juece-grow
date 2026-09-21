/**
 * 渲染层逐字比对（tasks 3.4 / REQ-0003 验收第 3 条）。
 *
 * 零手填参数：三站 `astro build` 跑完后直接 `node scripts/astro-copy-render-diff.mjs`。
 * 做法 = 用**同一个抽取器** `scripts/astro-copy-render-text.mjs`（算法固定、与源码解耦）
 * 把 `apps/astro/{dist,dist-erp,dist-yunque}` 再抽一遍到临时目录，然后与
 * 「切换前基线」`evidence/snapshot-pre-import/render/{site}/{page}.txt` 逐字节比对。
 *
 * 判定：12 份文件任一不等即非零退出，并列出差异行数与首个不同行；不产出白名单、不按内容过滤
 * （动态内容——首页 CMS 文章行、页脚年份——两侧都照原样抽取，故应当逐字相同；
 *  若恰好在此处出差异，按「读路径或 DB 被动过」查根因，不要加忽略）。
 *
 * 本脚本另挂两条同为「产物级」的断言，避免再造一只只读 dist 的门禁：
 *  - dist 新鲜度（quality HIGH-3）：三站产物必须比 `apps/astro/src` 新，清单与校验只在
 *    `scripts/astro-copy-dist-dirs.mjs` 实现一次，hero-diff / client-bundle 共用同一份。
 *  - cap-tag 配色类（PROB-024，原一次性脚本 142 的判定搬入）：只数 HTML 里的字面 class 与
 *    编译后 CSS 选择器，不解析 DOM ⇒ 与可见文本抽取器（会删标签）互不重复。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDistFreshness, resolveDistSites } from './astro-copy-dist-dirs.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extract = join(repoRoot, 'scripts/astro-copy-render-text.mjs')
const baselineDir = join(
  repoRoot,
  '.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import/render',
)
const postDir = join(repoRoot, '.aiws/tmp/astro-page-copy-cms/render-post')

const SITES = resolveDistSites(repoRoot)
const PAGES = ['home', 'features', 'solutions', 'pricing']

function readText(file) {
  return readFileSync(file, 'utf8')
}

const occurrences = (text, needle) => text.split(needle).length - 1

/** PROB-024 的产物级证明：三站 features 页 class 拼接正确、缺陷串归零、作用域选择器随 CSS 发布。 */
function checkCapTone({ site, distRel, distDir }, failures) {
  const htmlPath = join(distDir, 'features/index.html')
  if (!existsSync(htmlPath)) {
    failures.push(`${site}：缺产物 ${distRel}/features/index.html（先跑三站构建）`)
    return
  }
  const html = readFileSync(htmlPath, 'utf8')
  const toneCount = occurrences(html, 'class="cap-tag yb"')
  const plainCount = occurrences(html, 'class="cap-tag"')
  const defectCount = occurrences(html, 'cap-tagyb')
  const cssDir = join(distDir, '_astro')
  const selectorHits = readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .filter((f) => /\.cap-tag\[data-astro-cid-[a-z0-9]+\]\.yb/.test(readFileSync(join(cssDir, f), 'utf8')))
  console.log(
    `[cap-tone] ${site.padEnd(7)} cap-tag yb=${toneCount} cap-tag=${plainCount} 缺陷串 cap-tagyb=${defectCount} ` +
      `编译后选择器命中=${selectorHits.length > 0 ? selectorHits.join(',') : '无'}`,
  )
  if (toneCount !== 1) failures.push(`${site}：带 tone 的 cap-tag 期望 1 条，实得 ${toneCount}`)
  if (plainCount !== 4) failures.push(`${site}：无 tone 的 cap-tag 期望 4 条，实得 ${plainCount}`)
  if (defectCount !== 0) failures.push(`${site}：仍有缺陷串 cap-tagyb ${defectCount} 处`)
  if (selectorHits.length === 0) failures.push(`${site}：产物 CSS 里没有 .cap-tag[cid].yb ⇒ 配色是死样式`)
}

// 产物比源码旧 ⇒ 本轮改动根本没进 dist，后面的比对与断言都是在替旧产物背书，直接红。
const freshness = checkDistFreshness(repoRoot)
for (const row of freshness.rows) console.log(`[dist-fresh] ${row}`)

if (freshness.problems.length > 0) {
  console.error(`[render-diff] dist 新鲜度断言未过（${freshness.problems.length} 站）：\n  ${freshness.problems.join('\n  ')}`)
  process.exitCode = 1
} else {
  // 基线必须齐 12 份，缺一份就是比对面无意义，直接红。
  const missingBaseline = []
  for (const { site } of SITES) {
    for (const page of PAGES) {
      if (!existsSync(join(baselineDir, site, `${page}.txt`))) missingBaseline.push(`${site}/${page}.txt`)
    }
  }
  if (missingBaseline.length > 0) {
    console.error(`[render-diff] 缺切换前基线：\n  ${missingBaseline.join('\n  ')}`)
    process.exitCode = 1
  } else {
    // 临时目录每次重建，避免上一轮残留被当成本轮产物。
    rmSync(postDir, { recursive: true, force: true })
    mkdirSync(postDir, { recursive: true })

    const failures = []
    for (const { site, distRel, distDir } of SITES) {
      checkCapTone({ site, distRel, distDir }, failures)

      const ran = spawnSync(process.execPath, [extract, distDir, site, postDir], {
        cwd: repoRoot,
        encoding: 'utf8',
      })
      if (ran.status !== 0) {
        failures.push(`${site}：抽取器 exit=${ran.status}\n${ran.stderr ?? ran.stdout}`)
        continue
      }
      for (const page of PAGES) {
        const base = readText(join(baselineDir, site, `${page}.txt`))
        const post = readText(join(postDir, site, `${page}.txt`))
        if (base === post) continue
        const baseLines = base.split('\n')
        const postLines = post.split('\n')
        const firstDiff = baseLines.findIndex((l, i) => l !== postLines[i])
        failures.push(
          `${site}/${page}.txt：${baseLines.length} 行 vs ${postLines.length} 行` +
            (firstDiff === -1
              ? '（行数同、内容异，见下）'
              : `；首个不同行 #${firstDiff + 1}\n    切换前: ${baseLines[firstDiff]}\n    切换后: ${postLines[firstDiff] ?? '(该行不存在)'}`),
        )
      }
    }

    const relativePost = postDir.replace(`${repoRoot}/`, '').replace(`${repoRoot}\\`, '')
    console.log(`[render-diff] 基线 12 份齐全；比对产物 → ${relativePost}；差异 ${failures.length} 条`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    if (failures.length > 0) {
      writeFileSync(join(repoRoot, '.aiws/tmp/astro-page-copy-cms/render-diff-failures.txt'), `${failures.join('\n\n')}\n`, 'utf8')
      console.error('[render-diff] 差异清单非空 ⇒ 可见文本或类名拼接被改动，须查根因（详见 render-diff-failures.txt）')
      process.exitCode = 1
    } else {
      console.log(
        '[render-diff] 12/12 三站四页可见文本逐字一致 + 三站 cap-tag 配色类断言成立（差异清单为空）',
      )
    }
  }
}
