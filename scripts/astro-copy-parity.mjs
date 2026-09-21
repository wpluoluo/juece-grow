/**
 * parity 比对（tasks 2.13 / design D8④）：12 份导入前快照 ⇄ 公开读端点，逐字深比。
 *
 * 唯一入口（仓库根执行，零手填参数）：
 *   node scripts/astro-copy-parity.mjs
 * 前置：CMS 在 apps/astro/.env 的 PUBLIC_CMS_ORIGIN 上可达，且已跑过导入脚本
 *       （pnpm --filter cms exec payload run scripts/import-astro-copy.ts）。
 * 期望：`12/12 (site,page) 逐字一致`、exit=0；任何一条差异都列路径并非零退出。
 *
 * 两侧同形（这是本脚本能被信任的前提）：
 *   期望侧 = 快照 → toSchemaShape（TS 形状 → 存储形状）→ toReaderShape（存储形状 → Astro 形状）
 *   实际侧 = 端点返回的 data.copy，原样取用——端点在响应前已经施加过 toReaderShape，
 *            这里再施加一次会抛（R3⁻¹ 只认数组形态的 panel），被测的正是服务端那一次投影。
 * 两个函数与导入脚本、端点、覆盖度门禁共用同一份实现（src/lib/pageCopyProjection.ts）：
 * 这里再写一遍形变规则就是 AGENTS.md §4 禁的双写，改一处漏一处会让比对悄悄放水。
 *
 * 端点地址取 PUBLIC_CMS_ORIGIN 而不是另配一个常量：这就是 2.14 之后 Astro 构建实际要打的地址，
 * 比对用的接缝必须和线上用的接缝是同一个。缺失即抛，不给兜底默认。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { toReaderShape, toSchemaShape } from '../apps/cms/src/lib/pageCopyProjection.ts'

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SNAPSHOT_DIR = join(REPO_ROOT, '.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import')
const PAGES = ['home', 'features', 'solutions', 'pricing']
const SITES = ['juece', 'erp', 'yunque']

function originFromAstroEnv() {
  const file = join(REPO_ROOT, 'apps/astro/.env')
  if (!existsSync(file)) throw new Error(`缺少 ${file}：无法确定要比对的 CMS 地址`)
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('PUBLIC_CMS_ORIGIN='))
  if (!line) throw new Error('apps/astro/.env 没有 PUBLIC_CMS_ORIGIN 键')
  const value = line.slice('PUBLIC_CMS_ORIGIN='.length).trim().replace(/\/$/, '')
  if (!value) throw new Error('apps/astro/.env 的 PUBLIC_CMS_ORIGIN 为空')
  return value
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const shown = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s === undefined ? String(v) : s.length > 80 ? `${s.slice(0, 80)}…` : s
}

/** 深比：返回差异路径清单（值不等 / 形状不同 / 长度不同 / 单侧缺键）。 */
function diff(a, b, path, out) {
  if (isPlain(a) && isPlain(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const here = path ? `${path}.${k}` : k
      if (!(k in a)) out.push(`${here}: 快照侧缺失（库/端点多出来的键）= ${shown(b[k])}`)
      else if (!(k in b)) out.push(`${here}: 端点侧缺失（没写进去或没读回来）= ${shown(a[k])}`)
      else diff(a[k], b[k], here, out)
    }
    return out
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path}: 数组长度 ${a.length} vs ${b.length}（顺序即展示序，长度差不是排版问题）`)
      return out
    }
    a.forEach((item, i) => diff(item, b[i], `${path}[${i}]`, out))
    return out
  }
  if (a === b) return out
  out.push(`${path}: 值不等（含类型不同） ${shown(a)} vs ${shown(b)}`)
  return out
}

/** 叶子字符串计数：用于确认比对覆盖到的文案体量与快照同量级。 */
function countStrings(v) {
  if (typeof v === 'string') return 1
  if (Array.isArray(v)) return v.reduce((n, item) => n + countStrings(item), 0)
  if (isPlain(v)) return Object.values(v).reduce((n, item) => n + countStrings(item), 0)
  return 0
}

const origin = originFromAstroEnv()
const cases = []
const failures = []
let strings = 0

for (const page of PAGES) {
  for (const site of SITES) {
    const file = join(SNAPSHOT_DIR, `${page}.${site}.json`)
    if (!existsSync(file)) throw new Error(`快照缺失：${file}`)
    const snapshot = JSON.parse(readFileSync(file, 'utf8'))
    const expected = toReaderShape(page, toSchemaShape(page, snapshot))

    const url = `${origin}/api/v2/content/pages?site=${site}&page=${page}`
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.success) {
      failures.push(`${site}/${page}: HTTP ${res.status} ${shown(body?.error ?? body ?? '(空响应体)')}`)
      continue
    }
    if (body.data?.site !== site || body.data?.page !== page) {
      failures.push(`${site}/${page}: 信封回显错位 site=${shown(body.data?.site)} page=${shown(body.data?.page)}`)
      continue
    }
    const actual = body.data.copy
    const diffs = diff(expected, actual, '', [])
    strings += countStrings(actual)
    cases.push({ site, page, leaves: countStrings(expected), diffs: diffs.length })
    for (const d of diffs.slice(0, 10)) failures.push(`${site}/${page}: ${d}`)
    if (diffs.length > 10) failures.push(`${site}/${page}: …另有 ${diffs.length - 10} 条`)
  }
}

for (const c of cases) {
  console.log(`### ${c.site}/${c.page} 叶子字符串=${c.leaves} 差异=${c.diffs}`)
}
console.log(`合计比对 ${cases.length} 个 (site,page)，端点侧叶子字符串 ${strings}`)

if (failures.length > 0) {
  console.log(`\n=== parity 差异 ${failures.length} 条 ===`)
  for (const line of failures) console.log(`  - ${line}`)
  console.error(`parity 门禁未过：${failures.length} 条差异（期望 12/12 逐字一致）`)
  // 不用 process.exit：Windows 上强退会触发 libuv 断言把退出码改成 127。
  process.exitCode = 1
} else {
  console.log('12/12 (site,page) 逐字一致')
}
