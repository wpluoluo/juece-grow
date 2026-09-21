// 覆盖度自检：12 份 dump 经唯一投影（apps/cms/src/lib/pageCopyProjection.ts，design D8③）后的路径集合 A
//   vs  四个集合 schema 声明的路径集合 B。A\\B 必须机器归零——投影规则与导入脚本共用同一份代码，
//   这里剩下的任何差集都是缺陷，不许用白名单消音。
// 运行：node scripts/astro-copy-coverage.mjs
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const snapshotDir = join(repoRoot, '.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import')
const collectionsDir = join(repoRoot, 'apps/cms/src/collections/pages')
const { toSchemaShape } = await import(
  pathToFileURL(join(repoRoot, 'apps/cms/src/lib/pageCopyProjection.ts')).href,
)

// 仓内集合文件用无扩展名的相对 import（由 bundler 解析），这里补上 .ts 让 Node 直读。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !/\.[a-zA-Z]+$/.test(specifier)) {
      const parent = dirname(fileURLToPath(context.parentURL))
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        const abs = join(parent, candidate)
        if (existsSync(abs)) return nextResolve(pathToFileURL(abs).href, context)
      }
    }
    return nextResolve(specifier, context)
  },
})

const PAGES = [
  { page: 'home', file: 'PageHome.ts', exportName: 'PageHome' },
  { page: 'features', file: 'PageFeatures.ts', exportName: 'PageFeatures' },
  { page: 'solutions', file: 'PageSolutions.ts', exportName: 'PageSolutions' },
  { page: 'pricing', file: 'PagePricing.ts', exportName: 'PagePricing' },
]
const SITES = ['juece', 'erp', 'yunque']
// 任务允许的通用字段白名单（Payload 自带列 + 数组行的 id）
const GENERIC = new Set(['id', 'createdAt', 'updatedAt', 'project', 'status'])

/** A：dump 的叶子路径。标量数组折叠成 path[]，对象数组按行展开。 */
function collectDumpPaths(value, path, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectDumpPaths(item, `${path}[]`, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectDumpPaths(v, path ? `${path}.${k}` : k, out)
    return out
  }
  out.add(path)
  return out
}

/** B：schema 声明路径。collapsible/row/tabs 透明；group 加前缀；array/blocks 加 []；hasMany 视作标量数组。 */
function collectSchemaPaths(fields, prefix, out) {
  for (const field of fields) {
    if (field.type === 'collapsible' || field.type === 'row') {
      collectSchemaPaths(field.fields, prefix, out)
      continue
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) collectSchemaPaths(tab.fields, prefix, out)
      continue
    }
    if (field.type === 'array') {
      const here = `${prefix}${field.name}[]`
      out.add(`${here}.id`)
      collectSchemaPaths(field.fields, `${here}.`, out)
      continue
    }
    if (field.type === 'blocks') {
      // payload-types 里 blocks 字段就是「块数组」，故路径写法与 array 一致带 []；
      // 判别键记作 blockType（对应 TS 的 kind），见 design D8③。
      const here = `${prefix}${field.name}[]`
      out.add(`${here}.blockType`)
      for (const block of field.blocks) collectSchemaPaths(block.fields, `${here}.`, out)
      continue
    }
    if (field.type === 'group') {
      collectSchemaPaths(field.fields, `${prefix}${field.name}.`, out)
      continue
    }
    if (field.hasMany === true) {
      out.add(`${prefix}${field.name}[]`)
      continue
    }
    out.add(`${prefix}${field.name}`)
  }
  return out
}

/** 统计每个集合的字段/数组/block 规模。 */
function tally(fields) {
  let leaf = 0
  let arrays = 0
  let hasMany = 0
  let blocksFields = 0
  let blockSlugs = 0
  let groups = 0
  const walk = (list) => {
    for (const field of list) {
      if (field.type === 'collapsible' || field.type === 'row') {
        walk(field.fields)
        continue
      }
      if (field.type === 'tabs') {
        for (const tab of field.tabs) walk(tab.fields)
        continue
      }
      if (field.type === 'group') {
        groups++
        walk(field.fields)
        continue
      }
      if (field.type === 'array') {
        arrays++
        walk(field.fields)
        continue
      }
      if (field.type === 'blocks') {
        blocksFields++
        blockSlugs += field.blocks.length
        for (const block of field.blocks) walk(block.fields)
        continue
      }
      if (field.hasMany === true) hasMany++
      leaf++
    }
  }
  walk(fields)
  return { leaf, arrays, hasMany, blocksFields, blockSlugs, groups }
}

const report = []
for (const { page, file, exportName } of PAGES) {
  const mod = await import(pathToFileURL(join(collectionsDir, file)).href)
  const config = mod[exportName]
  const dumpPaths = new Set()
  for (const site of SITES) {
    const dump = JSON.parse(readFileSync(join(snapshotDir, `${page}.${site}.json`), 'utf8'))
    collectDumpPaths(toSchemaShape(page, dump), '', dumpPaths)
  }
  const schemaPaths = collectSchemaPaths(config.fields, '', new Set())
  const missingInSchema = [...dumpPaths].filter((p) => !schemaPaths.has(p)).sort()
  const extrasAll = [...schemaPaths].filter((p) => !dumpPaths.has(p))
  const extraInSchema = extrasAll.filter((p) => !GENERIC.has(p.split('.').at(-1))).sort()
  const genericDropped = extrasAll.length - extraInSchema.length
  report.push({
    page,
    slug: config.slug,
    dumpLeafPaths: dumpPaths.size,
    schemaPaths: schemaPaths.size,
    genericDropped,
    ...tally(config.fields),
    missingInSchema,
    extraInSchema,
  })
}

for (const r of report) {
  console.log(
    `### ${r.page} slug=${r.slug} dumpPaths=${r.dumpLeafPaths} schemaPaths=${r.schemaPaths} ` +
      `leafFields=${r.leaf} groups=${r.groups} arrays=${r.arrays} scalarArrays(hasMany)=${r.hasMany} ` +
      `blocksFields=${r.blocksFields} blockSlugs=${r.blockSlugs} genericDropped=${r.genericDropped}`,
  )
  console.log(`A\\B（dump 有、schema 无，共 ${r.missingInSchema.length} 条）:`)
  for (const p of r.missingInSchema) console.log(`  - ${p}`)
  console.log(`B\\A（schema 有、dump 无，已剔除通用字段，共 ${r.extraInSchema.length} 条）:`)
  for (const p of r.extraInSchema) console.log(`  + ${p}`)
  console.log('')
}
const totalMissing = report.reduce((n, r) => n + r.missingInSchema.length, 0)
console.log(`SUMMARY A\\B total=${totalMissing}`)
if (totalMissing > 0) {
  console.error(`覆盖度门禁未过：schema 缺少 ${totalMissing} 个快照里真实存在的字段路径（见上方 A/B 明细）`)
  // 不用 process.exit：Windows 上强退会触发 libuv 断言把退出码改成 127。
  process.exitCode = 1
}
