import { NextRequest } from 'next/server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'
import { memberProjectIds } from '../../../../../access'

/** 渠道统计/归因（基础）：按来源与阶段聚合当前用户可见项目的线索数。 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })

    // 项目隔离：管理员全见；成员仅见自己所属项目；未登录/非成员 → 空集合。
    const projectIds = await memberProjectIds({ user, payload } as never)
    const where =
      projectIds === null ? undefined : { project: { in: projectIds.length ? projectIds : [-1] } }

    const doc = await payload.find({
      collection: 'leads',
      overrideAccess: true,
      where,
      depth: 0,
      limit: 0,
      pagination: false,
      select: { source: true, status: true },
    })

    const bySource = new Map<string, number>()
    const byStatus = new Map<string, number>()
    for (const lead of doc.docs) {
      const source = typeof lead.source === 'string' ? lead.source : 'other'
      const status = typeof lead.status === 'string' ? lead.status : 'unknown'
      bySource.set(source, (bySource.get(source) ?? 0) + 1)
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
    }

    const sortDesc = (a: [string, number], b: [string, number]) => b[1] - a[1]
    return ok({
      total: doc.docs.length,
      bySource: [...bySource.entries()].sort(sortDesc).map(([source, count]) => ({ source, count })),
      byStatus: [...byStatus.entries()].sort(sortDesc).map(([status, count]) => ({ status, count })),
    })
  } catch {
    return err('STATS_FETCH_FAILED', '统计失败，请稍后再试', 500)
  }
}