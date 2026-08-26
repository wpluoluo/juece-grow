import { NextRequest } from 'next/server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'
import { memberProjectIds } from '../../../../../access'

/** 线索阶段（按转化漏斗顺序）。 */
const PIPE_ORDER = ['new', 'contacted', 'converted', 'closed'] as const

/** 完成转化（成交）的终点阶段。 */
const CONVERTED_STATUS = 'converted'

/** 下载到 0 ~ 100 的转化率（保留 1 位小数）。 */
function rate(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

/** 渠道统计/归因看板：阶段漏斗、转化率、来源归因与跟进人分布。 */
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
      select: { source: true, status: true, owner: true },
    })

    const total = doc.docs.length
    const statusCount = new Map<string, number>()
    const sourceTotal = new Map<string, number>()
    const sourceConverted = new Map<string, number>()
    const ownerCount = new Map<string, number>()
    let converted = 0

    for (const lead of doc.docs) {
      const source = typeof lead.source === 'string' ? lead.source : 'other'
      const status = typeof lead.status === 'string' ? lead.status : 'unknown'
      const ownerKey = lead.owner == null ? 'unassigned' : String(lead.owner)

      statusCount.set(status, (statusCount.get(status) ?? 0) + 1)
      sourceTotal.set(source, (sourceTotal.get(source) ?? 0) + 1)
      ownerCount.set(ownerKey, (ownerCount.get(ownerKey) ?? 0) + 1)
      if (status === CONVERTED_STATUS) {
        converted += 1
        sourceConverted.set(source, (sourceConverted.get(source) ?? 0) + 1)
      }
    }

    // 跟进人名称：一次查询 users 批量解析 owner 显示名。
    const ownerIds = [...ownerCount.keys()].filter((k) => k !== 'unassigned')
    const ownerNames = new Map<string, string>()
    if (ownerIds.length > 0) {
      const users = await payload.find({
        collection: 'users',
        overrideAccess: true,
        where: { id: { in: ownerIds.map(Number) } },
        depth: 0,
        pagination: false,
        select: { name: true, username: true },
      })
      for (const u of users.docs) ownerNames.set(String(u.id), u.name || u.username || `用户${u.id}`)
    }
    const labeledOwner = (key: string) =>
      key === 'unassigned' ? '未分配' : ownerNames.get(key) ?? `用户${key}`

    const funnel = PIPE_ORDER.map((status) => ({
      status,
      count: statusCount.get(status) ?? 0,
      share: rate(statusCount.get(status) ?? 0, total),
    }))

    const bySource = [...sourceTotal.entries()]
      .map(([source, count]) => ({
        source,
        total: count,
        converted: sourceConverted.get(source) ?? 0,
        convertedRate: rate(sourceConverted.get(source) ?? 0, count),
      }))
      .sort((a, b) => b.total - a.total)

    const byOwner = [...ownerCount.entries()]
      .map(([key, count]) => ({ owner: key, name: labeledOwner(key), count }))
      .sort((a, b) => b.count - a.count)

    const byStatus = [...statusCount.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    return ok({
      total,
      converted,
      convertedRate: rate(converted, total),
      funnel,
      byStatus,
      bySource,
      byOwner,
    })
  } catch {
    return err('STATS_FETCH_FAILED', '统计失败，请稍后再试', 500)
  }
}