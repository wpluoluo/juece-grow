import { NextRequest } from 'next/server'

import { getPayload, type Where } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'
import { asPageId, asSiteId, PAGE_COLLECTION, SITE_PROJECT_SLUG } from '../../../../../lib/pageCopyContract'
import { toReaderShape } from '../../../../../lib/pageCopyProjection'

/**
 * 公开站页面文案的唯一读取入口（design D5）。
 *
 * 口径：
 *  - `site` 与 `page` 都是必填且必须命中合同表——**不给 `?? 'juece'` 默认**：
 *    文章面那个默认对主站聚合成立，对页面文案会把主站文案静默发到分站。
 *  - 只回 `status = published` 的记录；一个 (site, page) 恰好一条，缺即 404，不回空对象。
 *  - 响应体是 Astro 类型形态（`toReaderShape` 投影过），消费方不需要知道 Payload 的 blocks 编码。
 *  - 异常走 logger.error + 500，不静默吞（PROB-021 同源要求）。
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const site = asSiteId(url.searchParams.get('site'))
  if (!site) {
    return err('INVALID_SITE', '缺少或非法的 site 参数（可选：juece / erp / yunque）', 400, req)
  }
  const page = asPageId(url.searchParams.get('page'))
  if (!page) {
    return err('INVALID_PAGE', '缺少或非法的 page 参数（可选：home / features / solutions / pricing）', 400, req)
  }

  const payload = await getPayload({ config })
  try {
    const projectSlug = SITE_PROJECT_SLUG[site]
    const projects = await payload.find({
      collection: 'projects',
      overrideAccess: true,
      where: { slug: { equals: projectSlug } },
      limit: 1,
      depth: 0,
    })
    const projectId = projects.docs[0]?.id
    if (projectId === undefined) {
      return err('SITE_NOT_FOUND', `站点 "${site}" 对应的项目 "${projectSlug}" 不存在`, 404, req)
    }

    const where: Where = {
      and: [{ project: { equals: projectId } }, { status: { equals: 'published' } }],
    }
    // limit: 2 —— 数据库唯一索引是执行者，这里是「线上 DDL 落后于代码」时的响铃：
    // 真出现两条时 Postgres 无 ORDER BY 不保证行序，宁 500 也不静默发任意一行。
    const { docs } = await payload.find({
      collection: PAGE_COLLECTION[page],
      overrideAccess: true,
      where,
      limit: 2,
      depth: 0,
    })
    if (docs.length > 1) {
      return err(
        'PAGE_COPY_DUPLICATE',
        `站点 "${site}" 的 "${page}" 页面存在 ${docs.length} 条已发布文案记录，唯一性约束未生效，请人工核实后保留一条`,
        500,
        req,
      )
    }
    const record = docs[0]
    if (!record) {
      return err(
        'PAGE_COPY_NOT_FOUND',
        `站点 "${site}" 的 "${page}" 页面还没有已发布文案（草稿不算），请先在后台发布`,
        404,
        req,
      )
    }

    return ok(
      { site, page, copy: toReaderShape(page, record) },
      req,
    )
  } catch (cause) {
    payload.logger.error({ err: cause, site, page }, '[page-copy] 页面文案读取失败')
    return err('CONTENT_FETCH_FAILED', '页面文案拉取失败，请稍后再试', 500, req)
  }
}

export { OPTIONS } from '../../../../../lib/envelope'
