import { NextRequest } from 'next/server'

import { getPayload } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'
import { memberProjectIds } from '../../../../../access'
import { aggregateBySource } from '../../../../../lib/leadStats'

/** 线索阶段（按转化漏斗顺序）。 */
const PIPE_ORDER = ['new', 'contacted', 'converted', 'closed'] as const

/** 完成转化（成交）的终点阶段。 */
const CONVERTED_STATUS = 'converted'

/** 下载到 0 ~ 100 的转化率（保留 1 位小数）。 */
function rate(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

/** 近期事件取前 N 条。 */
const RECENT_LIMIT = 8

/** 趋势图覆盖的天数。 */
const TREND_DAYS = 14

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
      select: {
        source: true,
        status: true,
        owner: true,
        followUpNote: true,
        nextFollowUpAt: true,
        dealAmount: true,
        createdAt: true,
        title: true,
      },
    })

    const statusCount = new Map<string, number>()
    const ownerCount = new Map<string, number>()

    for (const lead of doc.docs) {
      const status = typeof lead.status === 'string' ? lead.status : 'unknown'
      const ownerKey = lead.owner == null ? 'unassigned' : String(lead.owner)

      statusCount.set(status, (statusCount.get(status) ?? 0) + 1)
      ownerCount.set(ownerKey, (ownerCount.get(ownerKey) ?? 0) + 1)
    }

    // 来源/成交金额：单一实现，见 lib/leadStats。
    const { bySource, totalCount, convertedCount, totalAmount, convertedRate } = aggregateBySource(doc.docs)

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
      share: rate(statusCount.get(status) ?? 0, totalCount),
    }))

    const byOwner = [...ownerCount.entries()]
      .map(([key, count]) => ({ owner: key, name: labeledOwner(key), count }))
      .sort((a, b) => b.count - a.count)

    const byStatus = [...statusCount.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    // 跟进动态：基于 lead-activities（项目隔离同 leads），统计跟进次数、平均成交周期与近期事件。
    const activityWhere =
      projectIds === null ? undefined : { project: { in: projectIds.length ? projectIds : [-1] } }
    const acts = await payload.find({
      collection: 'lead-activities',
      overrideAccess: true,
      where: activityWhere,
      depth: 0,
      limit: 0,
      pagination: false,
      sort: '-createdAt',
      select: {
        lead: true,
        type: true,
        detail: true,
        meta: true,
        actor: true,
        createdAt: true,
      },
    })

    let followUpCount = 0
    const convertMoments = new Map<number, number>() // leadId -> 首次流转到 converted 的时间戳
    const createdMoments = new Map<number, number>() // leadId -> created 时间戳
    for (const a of acts.docs) {
      if (a.type === 'follow_up') followUpCount += 1
      const leadId = Number(a.lead)
      if (a.type === 'created' && !createdMoments.has(leadId)) {
        createdMoments.set(leadId, new Date(a.createdAt).getTime())
      }
      if (a.type === 'status_changed') {
        const meta = a.meta as { to?: string } | null | undefined
        if (meta?.to === CONVERTED_STATUS && !convertMoments.has(leadId)) {
          convertMoments.set(leadId, new Date(a.createdAt).getTime())
        }
      }
    }
    // 平均成交周期：仅统计有 created 且成功流转到 converted 的线索（小时，取整）。
    let cycleHoursSum = 0
    let cycleCount = 0
    for (const [leadId, convTs] of convertMoments) {
      const createdTs = createdMoments.get(leadId)
      if (!createdTs || convTs < createdTs) continue
      cycleHoursSum += Math.round((convTs - createdTs) / 3_600_000)
      cycleCount += 1
    }
    const avgConvertCycleHours = cycleCount > 0 ? Math.round(cycleHoursSum / cycleCount) : null

    // 近 N 天新增/成交趋势：新增按 leads.createdAt 分桶，成交按流转到 converted 的时间分桶。
    const localDayKey = (ts: number) => {
      const d = new Date(ts)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const dayNew = new Map<string, number>()
    for (const l of doc.docs) {
      const key = localDayKey(new Date(l.createdAt).getTime())
      dayNew.set(key, (dayNew.get(key) ?? 0) + 1)
    }
    const dayConverted = new Map<string, number>()
    for (const [, convTs] of convertMoments) {
      const key = localDayKey(convTs)
      dayConverted.set(key, (dayConverted.get(key) ?? 0) + 1)
    }
    const now = new Date()
    const trend: { day: string; label: string; newCount: number; converted: number }[] = []
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = localDayKey(d.getTime())
      trend.push({
        day: key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        newCount: dayNew.get(key) ?? 0,
        converted: dayConverted.get(key) ?? 0,
      })
    }

    // 近期事件：解析 lead 标题与 actor 显示名。
    const leadTitle = new Map<number, string>()
    for (const l of doc.docs) leadTitle.set(Number(l.id), (l.title as string) || `线索#${l.id}`)
    const recent = acts.docs.slice(0, RECENT_LIMIT).map((a) => {
      const leadId = Number(a.lead)
      const actorId = a.actor == null ? null : Number(a.actor)
      const actorName =
        actorId == null ? '系统' : ownerNames.get(String(actorId)) ?? `用户${actorId}`
      return {
        id: a.id,
        leadId,
        title: leadTitle.get(leadId) ?? `线索#${leadId}`,
        type: a.type,
        detail: a.detail ?? '',
        actor: actorName,
        at: a.createdAt,
      }
    })

    return ok({
      total: totalCount,
      converted: convertedCount,
      convertedRate,
      totalAmount,
      funnel,
      byStatus,
      bySource,
      byOwner,
      followUpCount,
      avgConvertCycleHours,
      trend,
      recent,
    }, req)
  } catch {
    return err('STATS_FETCH_FAILED', '统计失败，请稍后再试', 500, req)
  }
}