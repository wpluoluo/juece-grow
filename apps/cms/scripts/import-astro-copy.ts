/**
 * 一次性导入脚本：把三站 × 四页的现有文案（导入前快照）写进四个页面集合并发布。
 *
 * 运行（仓库根执行，零手填参数）：
 *   pnpm --filter cms exec payload run scripts/import-astro-copy.ts
 *
 * 语义 = **一次性导入**，不是日常重建入口：
 *  - 全新库零配置可跑（缺则建），这是本地/新环境的 bootstrap 路径。
 *  - 库里已存在记录时默认**拒绝写入**（fail-closed）：整份快照覆盖会抹掉运营在后台的手工改稿
 *    （AGENTS.md §7 数据红线）。确实要回到快照，须显式 `IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1` 再跑。
 *  - 只改单条文案请走后台，不要跑本脚本。
 *
 * 约定：
 *  - 数据源是 change 证据里的 12 份快照 `{page}.{site}.json`（迁移前的 TS 形状），
 *    写库前统一施加 `toSchemaShape`（design D8③），与 parity/覆盖度用的是同一份规则。
 *  - 全部落成 `status: 'published'`：验收要求导入后公开站构建即可拉到。
 *  - 纯数据脚本：置 PAYLOAD_MIGRATING 关掉 dev 模式的 drizzle pushSchema（表结构只认迁移文件）。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload, type DataFromCollectionSlug, type Where } from 'payload'

import config from '../src/payload.config'
import { PAGE_COLLECTION, PAGE_IDS, SITE_IDS, SITE_PROJECT_SLUG, type PageId } from '../src/lib/pageCopyContract'
import { toSchemaShape } from '../src/lib/pageCopyProjection'

process.env.PAYLOAD_MIGRATING = 'true'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..')
const SNAPSHOT_DIR = path.join(
  REPO_ROOT,
  '.aiws/changes/astro-page-copy-cms/evidence/snapshot-pre-import',
)

/** 覆盖已存在记录的显式许可；缺失即 fail-closed（见头注释）。 */
const ALLOW_OVERWRITE = process.env.IMPORT_ASTRO_COPY_ALLOW_OVERWRITE === '1'

function readSnapshot(page: PageId, site: string): Record<string, unknown> {
  const file = path.join(SNAPSHOT_DIR, `${page}.${site}.json`)
  if (!existsSync(file)) throw new Error(`快照缺失：${file}`)
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`快照不是对象：${file}`)
  }
  return parsed as Record<string, unknown>
}

const payload = await getPayload({ config })

let created = 0
let updated = 0
const touched: string[] = []

for (const page of PAGE_IDS) {
  const collection = PAGE_COLLECTION[page]
  for (const site of SITE_IDS) {
    const projectSlug = SITE_PROJECT_SLUG[site]
    const projects = await payload.find({
      collection: 'projects',
      overrideAccess: true,
      where: { slug: { equals: projectSlug } },
      limit: 1,
      depth: 0,
    })
    const projectId = projects.docs[0]?.id
    if (projectId === undefined) throw new Error(`项目不存在：${projectSlug}（site=${site}）`)

    const copy = toSchemaShape(page, readSnapshot(page, site))
    const data = { ...copy, project: projectId, status: 'published' } as DataFromCollectionSlug<typeof collection>
    const where: Where = { project: { equals: projectId } }
    const found = await payload.find({ collection, where, limit: 2, depth: 0, overrideAccess: true })
    if (found.docs.length > 1) {
      throw new Error(`${collection} 里 project=${projectId} 有 ${found.docs.length} 条记录，project 唯一索引未生效（DDL 未跑或被绕过），先人工核实`)
    }

    if (found.docs.length === 1) {
      if (!ALLOW_OVERWRITE) {
        throw new Error(
          `${collection} 里 project=${projectId}（site=${site}）已有一条文案记录。` +
            '本脚本是一次性导入；要覆盖后台手工改动请显式设置 IMPORT_ASTRO_COPY_ALLOW_OVERWRITE=1；' +
            '只改单条文案请走后台。',
        )
      }
      await payload.update({ collection, id: found.docs[0].id, data, overrideAccess: true })
      updated += 1
      touched.push(`updated ${collection}/${String(found.docs[0].id)} site=${site}`)
    } else {
      const doc = await payload.create({ collection, data, overrideAccess: true })
      created += 1
      touched.push(`created ${collection}/${String(doc.id)} site=${site}`)
    }
  }
}

for (const line of touched) console.info(`[import] ${line}`)

const published = await payload.find({
  collection: 'page-home',
  where: { status: { equals: 'published' } },
  limit: 10,
  depth: 0,
  overrideAccess: true,
})
console.info(
  `[import] 完成：created=${created} updated=${updated} 合计 ${created + updated} 条（期望 12）` +
    `；读回 page-home 已发布 ${published.totalDocs} 条（期望 3）`,
)
await payload.destroy()

if (created + updated !== 12 || published.totalDocs !== 3) {
  throw new Error('导入结果与期望不符，见上面逐条清单')
}
