// tasks 3.9 —— AGENTS.md §9 自检清单的可机检版本（零参数）。
// 动因：§9 七项原本靠人肉过一遍，措辞会漂（本 change 已被 PROB-027 打过一次「断言没实测」）。
// 本脚本只断言能机械判定的部分，并把量值打出来；判不了的两项（SEO 是否逐页齐全 = 下面 6 已覆盖语义、影响范围是否说明 = 7 查章节存在）
// 打成"检查了哪一份文件的哪一条"，不假装覆盖了全部。
// 运行：node scripts/astro-copy-agents9.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(repoRoot, p), 'utf8')

const failures = []
const ok = (label, detail) => console.log(`  OK   ${label} :: ${detail}`)
const bad = (label, detail) => {
  failures.push(`${label} :: ${detail}`)
  console.log(`  FAIL ${label} :: ${detail}`)
}
const check = (cond, label, detail) => (cond ? ok(label, detail) : bad(label, detail))

// git grep 无命中时以 status=1 退出——那正是「命中 0」的期望，取 stdout 而不是抛错。
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch (err) {
    if (typeof err.stdout === 'string') {
      return err.stdout.trim().split('\n').filter(Boolean)
    }
    throw err
  }
}

// --- 1. 自研文件行数 ≤1000（生成物单列） -------------------------------------------
const generated = new Map([
  ['apps/cms/src/payload-types.ts', 'generate:types 产物'],
  ['apps/cms/src/migrations/index.ts', 'migrate:create 登记产物'],
])
// 迁移批次按 index.ts 登记的名单推导，而不是写死文件名：写死会让下一次 migrate:create 立刻把这条门禁跑红。
const MIG_DIR = 'apps/cms/src/migrations'
const migNames = [...new Set([...read(`${MIG_DIR}/index.ts`).matchAll(/name: '([^']+)'/g)].map((m) => m[1]))]
for (const name of migNames) {
  generated.set(`${MIG_DIR}/${name}.ts`, 'migrate:create 产物（SQL 由适配器生成）')
  generated.set(`${MIG_DIR}/${name}.json`, 'migrate:create 产物（与 .ts 同一份 SQL 的 JSON 形态）')
}
const touched = new Set([
  ...git(['diff', '--name-only', 'HEAD']).filter((p) => /^(apps|scripts)\//.test(p)),
  ...git(['ls-files', '--others', '--exclude-standard'])
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => /^(apps|scripts)\//.test(p) && !p.includes('/dist')),
])
const LIMIT = 1000
let maxHand = 0
let maxHandFile = ''
const over = []
for (const p of [...touched].sort()) {
  const abs = join(repoRoot, p)
  if (!existsSync(abs) || /\test\.|\.spec\./.test(p)) continue
  const lines = read(p).split('\n').length
  if (generated.has(p)) {
    console.log(`  跳过（生成物） ${p} = ${lines} 行 —— ${generated.get(p)}`)
    continue
  }
  if (lines > maxHand) {
    maxHand = lines
    maxHandFile = p
  }
  if (lines > LIMIT) over.push(`${p}=${lines}`)
}
check(over.length === 0, '§4 自研文件 ≤1000 行', over.length ? over.join(' ') : `最大 ${maxHandFile}=${maxHand}`)
check(
  /This file was automatically generated/.test(read('apps/cms/src/payload-types.ts')),
  'payload-types.ts 确为生成物',
  '文件头含生成器标记，不计入自研限额',
)
const migProblems = []
for (const name of migNames) {
  const tsFile = `${MIG_DIR}/${name}.ts`
  const jsonFile = `${MIG_DIR}/${name}.json`
  if (!existsSync(join(repoRoot, tsFile))) {
    migProblems.push(`${name}: index.ts 登记了但缺 .ts`)
    continue
  }
  if (!read(tsFile).includes('MigrateUpArgs')) migProblems.push(`${name}.ts 无 MigrateUpArgs 签名`)
  if (!existsSync(join(repoRoot, jsonFile))) {
    migProblems.push(`${name}: 缺配套 .json 快照`)
    continue
  }
  const jsonRaw = read(jsonFile)
  const parsed = JSON.parse(jsonRaw)
  if (!('dialect' in parsed) || !('prevId' in parsed)) migProblems.push(`${name}.json 非 drizzle-kit 形态`)
  console.log(`  迁移批次 ${name}：.ts ${read(tsFile).split('\n').length} 行 / .json ${jsonRaw.split('\n').length} 行`)
}
check(
  migNames.length > 0 && migProblems.length === 0,
  `${migNames.length} 个迁移批次均为 migrate:create 生成物`,
  migProblems.length ? migProblems.join(' ') : '每批 .ts 含 MigrateUpArgs、配套 .json 含 dialect 与 prevId ⇒ 不占 §4 自研限额',
)

// --- 2. 去兜底：SITE_ID 无任何默认值 ------------------------------------------------
const siteFallbackHits = git(['grep', '-n', "|| 'juece'", '--', 'apps/astro'])
check(siteFallbackHits.length === 0, 'AGENTS §4 无站点兜底', `apps/astro 内 \`|| 'juece'\` 命中 ${siteFallbackHits.length}`)
for (const [f, needle] of [
  ['apps/astro/src/site.ts', "trim() === ''"],
  ['apps/astro/astro.config.mjs', "trim() === ''"],
]) {
  check(read(f).includes(needle), `${f} 缺键即抛`, `含显式空值分支 \`${needle}\``)
}

// --- 3. 无双写 / 无回退：旧数据源物理消失，失败路径必抛 ------------------------------
check(!existsSync(join(repoRoot, 'apps/astro/src/content')), '旧文案数据源已删', 'apps/astro/src/content 不存在 ⇒ 无法回退到代码内旧文案')
const astrophys = git(['grep', '-rln', "from '../content/", '--', 'apps/astro/src'])
check(astrophys.length === 0, '无残留 import 旧 content/', `命中 ${astrophys.length} 个文件`)
const payloadSrc = read('apps/astro/src/lib/payload.ts')
// 逐个 catch 块取体（花括号配对），断言首条语句只会「抛」或「返回一条诊断字符串」——返回旧数据就是 §4 禁的兜底。
const catchBodies = []
for (let i = payloadSrc.indexOf('catch'); i !== -1; i = payloadSrc.indexOf('catch', i + 5)) {
  const open = payloadSrc.indexOf('{', i)
  if (open === -1) break
  let depth = 0
  let end = open
  for (; end < payloadSrc.length; end++) {
    if (payloadSrc[end] === '{') depth++
    else if (payloadSrc[end] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  catchBodies.push(payloadSrc.slice(open + 1, end).trim())
  i = end
}
const catchShapes = catchBodies.map((b) => b.split('\n')[0].trim())
const badCatch = catchShapes.filter((s) => !/^throw /.test(s) && !/^return `/.test(s))
check(
  catchBodies.length === 3 && badCatch.length === 0,
  'payload.ts 的 catch 只有两类：抛错 / 返回诊断字符串（无返回旧数据）',
  `catch=${catchBodies.length} 首句=[${catchShapes.join(' | ')}]`,
)

// --- 4. 命名三层映射：Payload 字段名全 camelCase，无 snake_case 泄漏 -----------------
const collectionFiles = [
  'apps/cms/src/collections/pages/PageHome.ts',
  'apps/cms/src/collections/pages/PageFeatures.ts',
  'apps/cms/src/collections/pages/PageSolutions.ts',
  'apps/cms/src/collections/pages/PagePricing.ts',
  'apps/cms/src/collections/pages/pageCopyShared.ts',
]
const snakeNames = []
for (const f of collectionFiles) {
  for (const m of read(f).matchAll(/name:\s*'([^']+)'/g)) {
    if (/[a-z]+_[a-z]+/.test(m[1])) snakeNames.push(`${f}:${m[1]}`)
  }
}
check(snakeNames.length === 0, '§5 Payload 字段 camelCase', `四集合 + 共享文件共扫 \`${snakeNames.length ? snakeNames.join(' ') : '无 snake_case 命中'}\``)
const astroCopy = git(['grep', '-rn', '-E', '\\bcopy\\.[a-z]+_[a-z]', '--', 'apps/astro/src'])
check(astroCopy.length === 0, '§5 Astro 侧无 snake_case 取值', `命中 ${astroCopy.length}`)

// --- 5. API 规范：路径在 /api/v2/*，响应只走 ok/err 唯一实现 ------------------------
const route = read('apps/cms/src/app/api/v2/content/pages/route.ts')
check(route.includes("from '../../../../../lib/envelope'"), '§6 端点复用统一信封', "import { err, ok } from '.../lib/envelope'")
check(!/return\s+Response\.json|NextResponse\.json/.test(route), '§6 端点未手写响应体', '全部出口走 ok()/err()')
check(existsSync(join(repoRoot, 'apps/cms/src/app/api/v2/content/pages/route.ts')), '§6 对外路径 /api/v2/*', 'apps/cms/src/app/api/v2/content/pages/route.ts')

// --- 6. SEO 三件套逐页齐全，且值来自 CMS --------------------------------------------
const layout = read('apps/astro/src/layouts/Layout.astro')
check(
  /<title>/.test(layout) && /name="description"/.test(layout) && /rel="canonical"/.test(layout),
  '§9 SEO 三件套在 Layout 落地',
  'title + meta description + link canonical',
)
const seoMissing = []
for (const p of ['index', 'features', 'solutions', 'pricing']) {
  const src = read(`apps/astro/src/pages/${p}.astro`)
  if (!/title=\{c\.meta\.title\}/.test(src) || !/description=\{c\.meta\.description\}/.test(src)) {
    seoMissing.push(p)
  }
}
check(seoMissing.length === 0, '四页 title/description 均取自 CMS copy.meta', seoMissing.length ? `缺 ${seoMissing.join(',')}` : 'index/features/solutions/pricing 4/4')

// --- 7. 线索仍在自有 Postgres + 影响范围已说明 --------------------------------------
// §7 管的是「线索**数据**是否还在自有库」，不是「文件名里有 lead」。首版把两者混为一谈：
// P11 按 quality-review W-8 只改 `apps/e2e/tests/lead.spec.ts`（不再断言已归 CMS 的话术）就被判红。
// 故本条只挡生产代码，测试文件改过哪些照样打出来——如实披露而不是静默放行。
const leadTouched = [...touched].filter((p) => /lead/i.test(p) && !p.includes('/dist'))
const leadProd = leadTouched.filter((p) => !/\.(spec|test)\.[a-z]+$/.test(p))
check(
  leadProd.length === 0,
  '§7 线索主数据未被本 change 触碰',
  leadProd.length
    ? `diff/新增的生产文件里 lead 相关 ${leadProd.length} 个：${leadProd.join(' ')}`
    : `生产代码 0 个${leadTouched.length === 0 ? '' : `；只改过测试断言：${leadTouched.join(' ')}`}`,
)
const proposal = read('.aiws/changes/astro-page-copy-cms/proposal.md')
const needSections = ['## 影响范围（Scope）', '### In Scope（本次改动范围）', '### Out of Scope（明确不改动）', '### 外部影响']
const missingSections = needSections.filter((s) => !proposal.includes(s))
check(missingSections.length === 0, '§9 影响范围已说明', missingSections.length ? `proposal 缺章节 ${missingSections.join(' / ')}` : 'proposal 四个小节齐全')

console.log(failures.length === 0 ? '自检 3.9：全部断言成立' : `自检 3.9：${failures.length} 条不成立`)
for (const f of failures) console.log(`   - ${f}`)
process.exitCode = failures.length === 0 ? 0 : 1
