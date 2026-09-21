/**
 * hero 标题 DOM 逐字节门禁（tasks 3.4 第二道 / REQ-0003 非目标第 3 条的机器对面）。
 *
 * 为什么需要这个包装器：抽取器 `scripts/astro-copy-hero-dom.mjs` 的入参是
 * `<distDir> <site> <outFile>`，零参数直接调用只会打印用法并以 1 退出（实测日志 200）。
 * P5/P6 那两次复测是把三个站的参数手拼出来再 `diff`，不属于「零手填参数即可复现绿灯」的验收入口
 * ⇒ 补这条持久脚本，把三站串联与基线比对固化下来。抽取算法仍只有抽取器一份实现，本脚本不重复解析 HTML。
 *
 * 零手填参数：三站 `astro build` 跑完后直接 `node scripts/astro-copy-hero-diff.mjs`。
 * 判定：与「切换前基线」`evidence/snapshot-pre-import/hero-dom.json` 的 12 条条目任一不等即非零退出。
 *      归一只发生在抽取器内（删 `data-astro-cid-*`、空白压单空格），本脚本不再做任何忽略。
 * 三站 dist 清单与「产物必须比 apps/astro/src 新」的断言只在 `scripts/astro-copy-dist-dirs.mjs` 写一份，
 * 本脚本 import 它（与 render-diff / client-bundle 共用，quality W-2 的修法）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDistFreshness, resolveDistSites } from './astro-copy-dist-dirs.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const extract = join(repoRoot, 'scripts/astro-copy-hero-dom.mjs')
const baselineFile = join(
  repoRoot,
  '.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import/hero-dom.json',
)
const postFile = join(repoRoot, '.aiws/tmp/astro-page-copy-cms/hero-dom-post.json')

const SITES = resolveDistSites(repoRoot)
const PAGES = ['home', 'features', 'solutions', 'pricing']
const KEYS = SITES.flatMap(({ site }) => PAGES.map((page) => `${site}/${page}`))

const freshness = checkDistFreshness(repoRoot)
for (const row of freshness.rows) console.log(`[dist-fresh] ${row}`)

if (freshness.problems.length > 0) {
  console.error(`[hero-diff] dist 新鲜度断言未过（${freshness.problems.length} 站）：\n  ${freshness.problems.join('\n  ')}`)
  process.exitCode = 1
} else if (!existsSync(baselineFile)) {
  console.error(`[hero-diff] 缺切换前基线：${baselineFile}`)
  process.exitCode = 1
} else {
  const failures = []

  // 抽取器对已存在的 outFile 是「合并」语义 ⇒ 本轮文件必须先删，
  // 否则上一轮残留会被当成本轮产物，比对会假绿。
  rmSync(postFile, { force: true })
  for (const { site, distDir } of SITES) {
    const ran = spawnSync(process.execPath, [extract, distDir, site, postFile], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    if (ran.status !== 0) {
      failures.push(`${site}：抽取器 exit=${ran.status}\n${(ran.stderr ?? ran.stdout).trim()}`)
    }
  }

  let produced = {}
  if (failures.length === 0) {
    produced = JSON.parse(readFileSync(postFile, 'utf8'))
    for (const key of KEYS) if (!(key in produced)) failures.push(`${key}：本轮未抽到条目`)
  }
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
  for (const key of Object.keys(baseline)) {
    if (!KEYS.includes(key)) failures.push(`基线含未知键 ${key}，比对面无意义`)
  }
  for (const key of KEYS) {
    if (!(key in produced) || !(key in baseline)) continue
    if (produced[key] === baseline[key]) continue
    failures.push(
      `${key}：hero <h1> 内部 DOM 被改动\n    切换前: ${baseline[key]}\n    本轮:   ${produced[key]}`,
    )
  }

  if (failures.length > 0) {
    console.error(`[hero-diff] 差异 ${failures.length} 条：`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exitCode = 1
  } else {
    console.log(
      `[hero-diff] ${KEYS.length}/${KEYS.length} 三站四页 hero <h1> 内部 DOM 与切换前基线逐字节一致` +
        `（基线 ${Object.keys(baseline).length} 条，本轮产物 → ${postFile.replace(`${repoRoot}\\`, '')}）`,
    )
  }
}
