import { expect, test } from '@playwright/test'

import {
  adminCredentials,
  adminSession,
  createRequired,
  deleteQuietly,
  expectErr,
  expectOk,
  findDocs,
  getDoc,
  isoFromNow,
  listDocs,
  rawRequest,
  relId,
} from '../helpers/cmsRest'

/**
 * REQ-0002 提醒扫描端到端覆盖（POST /api/v2/reminders/run，与 cron 共用同一实现）。
 *
 * 覆盖点（此前该端点零 e2e 覆盖）：
 *  1. due 规则命中「nextFollowUpAt 已过」的线索；sla 规则命中「createdAt 超过 graceHours 仍未首响」的线索
 *     （createdAt 是 Payload 自动注入的可写 date 字段，直接回填 30 天前，无需改产品代码）。
 *  2. 命中后落 `reminder-notices(status=open)` + `lead-activities(type=reminder)`，dueAt 语义正确。
 *  3. 判重：同一 lead + rule + kind 已有通知时，第二次扫描 created 必须为 0，通知不翻倍。
 *  4. 扫描对线索只读：status / createdAt / nextFollowUpAt / updatedAt / owner 全部不变。
 *  5. 未登录不能手动触发扫描（fail-closed 403）。
 *
 * 造数边界：规则与线索全部挂在专属测试项目下（提醒规则按 project 限定，扫不到真实线索）。
 * 库里已存在一条「全局 due 规则」，扫描会顺带命中真实线索，因此 afterAll 除了删本项目
 * （Projects.beforeDelete 级联），还把「本轮新增的通知/动态」按快照 id 差集精确删除，
 * 并断言回滚后与快照完全一致——既不污染真实线索，也不使用任何全局清理语句。
 *
 * 前置：CMS dev @3000 已启动；管理员凭据由 setup/global-setup.ts 注入，缺失时整块 skip。
 */

const RUN_TAG = `e2e提醒${Date.now()}`
const SNAPSHOT_LIMIT = 900

let token = ''
let adminId = 0
let projectId = 0
let leadStale = 0 // 线索 A：status=new、createdAt 30 天前 → 命中 sla
let leadDue = 0 // 线索 B：status=contacted、nextFollowUpAt 已过 → 命中 due
let slaRuleId = 0
let dueRuleId = 0
let snapshotStale: Record<string, unknown> = {}
let snapshotDue: Record<string, unknown> = {}
let noticeIdsBefore: number[] = []
let activityIdsBefore: number[] = []

test.describe('提醒扫描 POST /api/v2/reminders/run', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!adminCredentials(), '未提供 CMS 管理员凭据（.aiws/secrets/test-accounts.json），跳过')

  test.beforeAll(async () => {
    const session = await adminSession()
    token = session.token
    adminId = session.id

    // 快照必须在任何造数之前，才能把「本轮新增」与「既有记录」分干净。
    noticeIdsBefore = await allIds('reminder-notices')
    activityIdsBefore = await allIds('lead-activities')

    projectId = await createRequired(token, '/api/projects', {
      name: `${RUN_TAG}项目`,
      slug: `e2e-reminders-${Date.now()}`,
    })

    leadStale = await createRequired(token, '/api/leads', {
      project: projectId,
      name: `${RUN_TAG}A-未首响`,
      phone: `155${String(Date.now()).slice(-8)}`,
      status: 'new',
      createdAt: isoFromNow(-30 * 24),
    })
    leadDue = await createRequired(token, '/api/leads', {
      project: projectId,
      name: `${RUN_TAG}B-已到期`,
      phone: `156${String(Date.now()).slice(-8)}`,
      status: 'contacted',
      nextFollowUpAt: isoFromNow(-2),
    })

    slaRuleId = await createRequired(token, '/api/reminder-rules', {
      name: `${RUN_TAG}sla规则`,
      project: projectId,
      kind: 'sla',
      applyStatuses: ['new'],
      graceHours: 24,
      target: adminId,
      enabled: true,
    })
    dueRuleId = await createRequired(token, '/api/reminder-rules', {
      name: `${RUN_TAG}due规则`,
      project: projectId,
      kind: 'due',
      applyStatuses: ['contacted'],
      target: adminId,
      enabled: true,
    })

    snapshotStale = await readLead(leadStale)
    snapshotDue = await readLead(leadDue)
  })

  test.afterAll(async () => {
    // 1) 删测试项目：Projects.beforeDelete 级联清掉本项目下的线索/规则/通知/动态。
    await deleteQuietly(token, `/api/projects/${projectId}`)
    // 2) 既有全局规则顺带扫到的真实线索记录：按差集删除，快照内的记录一条不动。
    await removeNew('reminder-notices', noticeIdsBefore)
    await removeNew('lead-activities', activityIdsBefore)
    // 3) 回滚完整性：与快照完全一致 ⇒ 本 spec 对既有数据零残留。
    expect(sortedIds(await allIds('reminder-notices'))).toEqual(sortedIds(noticeIdsBefore))
    expect(sortedIds(await allIds('lead-activities'))).toEqual(sortedIds(activityIdsBefore))
    // 4) 本项目记录确已消失（级联生效）。
    expect(await listDocs(token, 'leads', { where: [['project', 'equals', projectId]] })).toHaveLength(0)
    expect(await listDocs(token, 'reminder-rules', { where: [['project', 'equals', projectId]] })).toHaveLength(0)
  })

  test('命中落账：due 与 sla 各建一条 open 通知 + reminder 动态', async () => {
    const data = expectOk(await rawRequest('POST', '/api/v2/reminders/run', token))
    expect(typeof data.created).toBe('number')
    expect(Number(data.created), '两条规则各命中一条线索，created 至少为 2').toBeGreaterThanOrEqual(2)

    const notices = await listDocs(token, 'reminder-notices', { where: [['project', 'equals', projectId]] })
    expect(notices, '本项目下只应有 2 条通知').toHaveLength(2)

    const sla = soleNotice(notices, 'sla')
    expect(relId(sla.lead)).toBe(leadStale)
    expect(relId(sla.rule)).toBe(slaRuleId)
    expect(sla.status).toBe('open')
    expect(relId(sla.receiver), '规则 target 为空时应回落到 owner，此处显式指定了 target').toBe(adminId)
    // sla 的应处理时间 = 线索 createdAt + graceHours(24h)
    expect(new Date(String(sla.dueAt)).getTime()).toBe(new Date(String(snapshotStale.createdAt)).getTime() + 24 * 3_600_000)

    const due = soleNotice(notices, 'due')
    expect(relId(due.lead)).toBe(leadDue)
    expect(relId(due.rule)).toBe(dueRuleId)
    expect(due.status).toBe('open')
    expect(relId(due.receiver)).toBe(adminId)
    // due 的应处理时间 = 线索 nextFollowUpAt
    expect(new Date(String(due.dueAt)).getTime()).toBe(new Date(String(snapshotDue.nextFollowUpAt)).getTime())

    const activities = await listDocs(token, 'lead-activities', {
      where: [
        ['project', 'equals', projectId],
        ['type', 'equals', 'reminder'],
      ],
    })
    expect(activities).toHaveLength(2)
    for (const activity of activities) {
      expect(relId(activity.actor), '系统提醒不得伪造操作人').toBeNull()
      const meta = activity.meta as { kind?: string; ruleId?: number }
      expect(['due', 'sla']).toContain(meta.kind)
      expect([slaRuleId, dueRuleId]).toContain(Number(meta.ruleId))
      expect([leadStale, leadDue]).toContain(relId(activity.lead))
    }
  })

  test('判重：紧接着第二次扫描 created 为 0，通知与动态不翻倍', async () => {
    const data = expectOk(await rawRequest('POST', '/api/v2/reminders/run', token))
    expect(Number(data.created), '同一 lead+rule+kind 已有通知时必须跳过').toBe(0)

    expect(
      await listDocs(token, 'reminder-notices', { where: [['project', 'equals', projectId]] }),
    ).toHaveLength(2)
    expect(
      await listDocs(token, 'lead-activities', {
        where: [
          ['project', 'equals', projectId],
          ['type', 'equals', 'reminder'],
        ],
      }),
    ).toHaveLength(2)
  })

  test('扫描对线索只读：状态与时间字段与扫描前逐项一致', async () => {
    const afterStale = await readLead(leadStale)
    for (const field of ['status', 'createdAt', 'nextFollowUpAt', 'updatedAt', 'owner'] as const) {
      expect(afterStale[field], `扫描改动了线索 A 的 ${field}`).toBe(snapshotStale[field])
    }
    const afterDue = await readLead(leadDue)
    for (const field of ['status', 'createdAt', 'nextFollowUpAt', 'updatedAt', 'owner'] as const) {
      expect(afterDue[field], `扫描改动了线索 B 的 ${field}`).toBe(snapshotDue[field])
    }
    // 前置成立性自检：两条线索确实处于「未首响超期」与「到期」形态，否则上面的用例是空跑。
    expect(snapshotStale.status).toBe('new')
    expect(snapshotStale.nextFollowUpAt).toBeNull()
    expect(snapshotDue.status).toBe('contacted')
    expect(new Date(String(snapshotDue.nextFollowUpAt)).getTime()).toBeLessThan(Date.now())
    expect(new Date(String(snapshotStale.createdAt)).getTime()).toBeLessThan(Date.now() - 24 * 3_600_000)
  })

  test('未登录不能手动触发扫描（403 FORBIDDEN 统一信封）', async () => {
    expectErr(await rawRequest('POST', '/api/v2/reminders/run', null), 403, 'FORBIDDEN')
  })
})

// ---------------------------------------------------------------------------
// 本 spec 内部工具
// ---------------------------------------------------------------------------

async function readLead(id: number): Promise<Record<string, unknown>> {
  const res = await getDoc(token, `/api/leads/${id}?depth=0`)
  expect(res.status, `读取线索 ${id} 失败：${JSON.stringify(res.body).slice(0, 200)}`).toBe(200)
  return res.body
}

function soleNotice(notices: Record<string, unknown>[], kind: string): Record<string, unknown> {
  const hits = notices.filter((n) => n.kind === kind)
  expect(hits, `应恰有一条 kind=${kind} 的通知`).toHaveLength(1)
  return hits[0]
}

/** 取集合全部 id；记录数超出快照上限即断言失败，避免差集漏删。 */
async function allIds(slug: string): Promise<number[]> {
  const res = await findDocs(token, slug, { limit: SNAPSHOT_LIMIT })
  expect(res.status, `查询 /api/${slug} 失败`).toBe(200)
  const total = Number(res.body.totalDocs)
  expect(total, `${slug} 现有 ${total} 条，超出快照上限 ${SNAPSHOT_LIMIT}`).toBeLessThanOrEqual(SNAPSHOT_LIMIT)
  return ((res.body.docs as Record<string, unknown>[]) ?? []).map((d) => Number(d.id))
}

/** 删除「当前集合 − 快照集合」的差集：只回收本轮新造的记录。 */
async function removeNew(slug: string, before: number[]): Promise<void> {
  const known = new Set(before)
  for (const id of (await allIds(slug)).filter((id) => !known.has(id))) {
    await deleteQuietly(token, `/api/${slug}/${id}`)
  }
}

function sortedIds(ids: number[]): number[] {
  return [...ids].sort((a, b) => a - b)
}
