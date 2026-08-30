import { schedule } from 'node-cron'
import type { Payload, Where } from 'payload'

type ReminderKind = 'due' | 'sla'

interface RuleRaw {
  id: number
  project?: number | { id: number } | null
  kind?: ReminderKind | null
  applyStatuses?: string[] | null
  graceHours?: number | null
  target?: number | { id: number } | null
  enabled?: boolean | null
}

interface LeadRaw {
  id: number
  project: number | { id: number }
  status?: string | null
  owner?: number | { id: number } | null
  createdAt?: string | null
  nextFollowUpAt?: string | null
}

const CRON_EXPRESSION = process.env.REMINDER_CRON_EXPRESSION || '*/30 * * * *'

/** 取 relationship 字段的 id（可能是对象或裸 id）。 */
function relId(value: unknown): number | null {
  if (value == null) return null
  return Number(typeof value === 'object' ? (value as { id: number }).id : value)
}

/** 判重：同一 lead + rule + kind 已存在任意状态的通知（含已处理 done）即跳过，避免无限重复提醒。 */
async function alreadyNotified(payload: Payload, leadId: number, ruleId: number, kind: string): Promise<boolean> {
  const hit = await payload.find({
    collection: 'reminder-notices',
    overrideAccess: true,
    where: {
      and: [{ lead: { equals: leadId } }, { rule: { equals: ruleId } }, { kind: { equals: kind } }],
    },
    limit: 1,
    depth: 0,
  })
  return hit.docs.length > 0
}

/**
 * 执行一次提醒扫描：遍历 enable 规则，判重后写 reminder-notices + lead-activities(reminder)。
 * 提醒不改线索本身状态。返回本次新建的提醒数量。
 */
export async function runReminderScan(payload: Payload): Promise<{ created: number }> {
  const rulesResult = await payload.find({
    collection: 'reminder-rules',
    overrideAccess: true,
    where: { enabled: { equals: true } },
    pagination: false,
    limit: 0,
    depth: 0,
  })

  let created = 0
  const now = Date.now()

  for (const raw of rulesResult.docs as unknown as RuleRaw[]) {
    const kind: ReminderKind | undefined = raw.kind === 'sla' ? 'sla' : raw.kind === 'due' ? 'due' : undefined
    if (!kind) continue
    const ruleId = Number(raw.id)

    // 组装线索查询条件：按规则 kind 判定命中。
    const where: Where = {}
    const and: Where[] = []

    const ruleProjectId = relId(raw.project)
    if (ruleProjectId !== null) and.push({ project: { equals: ruleProjectId } })

    const applyStatuses = raw.applyStatuses?.length ? raw.applyStatuses : ['new']

    if (kind === 'due') {
      and.push({ status: { in: applyStatuses } })
      and.push({ nextFollowUpAt: { less_than: new Date(now).toISOString() } })
    } else {
      const graceHours = Number(raw.graceHours) || 24
      and.push({ status: { in: applyStatuses } })
      and.push({ createdAt: { less_than: new Date(now - graceHours * 60 * 60 * 1000).toISOString() } })
    }
    where.and = and

    const leadsResult = await payload.find({
      collection: 'leads',
      overrideAccess: true,
      where,
      pagination: false,
      limit: 0,
      depth: 0,
    })

    for (const leadRaw of leadsResult.docs as unknown as LeadRaw[]) {
      const leadId = Number(leadRaw.id)
      const projectId = relId(leadRaw.project)
      if (projectId === null) continue
      if (await alreadyNotified(payload, leadId, ruleId, kind)) continue

      const receiverId = relId(raw.target) ?? relId(leadRaw.owner)
      // 无接收人（规则未指定且线索无负责人）时不落孤儿提醒，跳过本次。
      if (receiverId === null) continue

      // 应处理时间：due 用 nextFollowUpAt；sla 用 createdAt + graceHours。
      let dueAt: string | null = null
      if (kind === 'due') {
        dueAt = leadRaw.nextFollowUpAt || null
      } else {
        const createdTime = leadRaw.createdAt ? new Date(leadRaw.createdAt).getTime() : now
        const graceHours = Number(raw.graceHours) || 24
        dueAt = new Date(createdTime + graceHours * 60 * 60 * 1000).toISOString()
      }

      await payload.create({
        collection: 'reminder-notices',
        overrideAccess: true,
        data: {
          lead: leadId,
          project: projectId,
          rule: ruleId,
          kind,
          receiver: receiverId,
          status: 'open',
          dueAt,
        },
      })

      await payload.create({
        collection: 'lead-activities',
        overrideAccess: true,
        data: {
          lead: leadId,
          project: projectId,
          type: 'reminder',
          detail: kind === 'due' ? '系统提醒：已到下次跟进时间' : '系统提醒：新线索超过首次跟进 SLA',
          meta: { ruleId, kind, dueAt },
        },
      })

      created += 1
    }
  }

  return { created }
}

/** 启动 node-cron 常驻调度。构建期早退，并用全局哨兵防 dev HMR 重复注册。 */
export function startReminderCron(payload: Payload): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const g = globalThis as { __reminderCronStarted?: boolean }
  if (g.__reminderCronStarted) return
  g.__reminderCronStarted = true

  schedule(CRON_EXPRESSION, () => {
    runReminderScan(payload)
      .then(({ created }) => {
        if (created > 0) console.info(`[reminder] 本轮新建 ${created} 条提醒`)
      })
      .catch((e) => console.error('[reminder] 扫描失败', e))
  })
}