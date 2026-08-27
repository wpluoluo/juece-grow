import type { AdminViewServerProps } from 'payload'

import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'
import { Donut, DailyDualBars, RankedBars, type Slice } from './DashboardCharts'
import { aggregateBySource, formatAmount } from '../src/lib/leadStats'

/** 来源切片配色（与 DashboardCharts 的 COLOR_WHEEL 保持一致）。 */
const SLICE_COLORS = [
  'var(--color-success-400)',
  'var(--color-success-250)',
  'var(--color-blue-300)',
  'rgb(215, 196, 165)',
  'var(--theme-elevation-400)',
]

/** 状态对应的语义色调名称。 */
const LEAD_TONE: Record<string, string> = {
  new: 'teal',
  contacted: 'amber',
  converted: 'green',
  closed: 'gray',
}

const STATUS_LABEL: Record<string, string> = {
  new: '新线索',
  contacted: '跟进中',
  converted: '已成交',
  closed: '已关闭',
}

export async function JueceDashboard(_props: AdminViewServerProps) {
  const payload = await getPayload({ config })
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  // 并行拉取统计所需数据，减少首屏等待。
  const [
    totalLeads,
    todayLeads,
    newLeads,
    contactedLeads,
    convertedLeads,
    closedLeads,
    openReminders,
    articles,
    projects,
    recentLeads,
    sourceRows,
    actsAll,
    users,
  ] = await Promise.all([
    payload.count({ collection: 'leads', where: {} }),
    payload.count({
      collection: 'leads',
      where: { createdAt: { greater_than: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() } },
    }),
    payload.count({ collection: 'leads', where: { status: { equals: 'new' } } }),
    payload.count({ collection: 'leads', where: { status: { equals: 'contacted' } } }),
    payload.count({ collection: 'leads', where: { status: { equals: 'converted' } } }),
    payload.count({ collection: 'leads', where: { status: { equals: 'closed' } } }),
    payload.count({ collection: 'reminder-notices', where: { status: { equals: 'open' } } }),
    payload.count({ collection: 'articles', where: { status: { equals: 'published' } } }),
    payload.find({ collection: 'projects', where: {}, depth: 0, pagination: false, limit: 100 }),
    payload.find({ collection: 'leads', where: {}, sort: '-createdAt', limit: 6, depth: 1 }),
    payload.find({ collection: 'leads', where: {}, depth: 0, pagination: false, limit: 2000 }),
    payload.find({
      collection: 'lead-activities',
      where: {},
      depth: 0,
      pagination: false,
      limit: 0,
      sort: '-createdAt',
      select: { lead: true, type: true, detail: true, meta: true, actor: true, createdAt: true },
    }),
    payload.find({
      collection: 'users',
      where: {},
      depth: 0,
      pagination: false,
      limit: 500,
      select: { name: true, username: true },
    }),
  ])

  // 近 N 日按本地日期取键，供趋势聚合。
  const dayKey = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // 来源渠道归因（数量/成交/金额单一实现）：见 lib/leadStats。
  const { bySource, totalCount, convertedCount, totalAmount, convertedRate } = aggregateBySource(
    sourceRows.docs as { source?: unknown; status?: unknown; dealAmount?: number | null }[],
  )
  const sourceLabel: Record<string, string> = { website: '官网表单', unknown: '未标识', other: '未标识', manual: '手动录入' }
  const sourceSlices = bySource
    .slice(0, 5)
    .map((s, i) => ({
      key: s.source,
      label: sourceLabel[s.source] || s.source,
      value: s.total,
      converted: s.converted,
      amount: s.amount,
      avgAmount: s.avgAmount,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }))

  // 线索阶段漏斗。
  const funnel = [
    { label: '新线索', value: newLeads.totalDocs },
    { label: '跟进中', value: contactedLeads.totalDocs },
    { label: '已成交', value: convertedLeads.totalDocs },
    { label: '已关闭', value: closedLeads.totalDocs },
  ]

  // 项目线索分布。
  const projectRows = await Promise.all(
    projects.docs.map(async (project) => {
      const count = await payload.count({
        collection: 'leads',
        where: { project: { equals: Number(project.id) } },
      })
      return { id: project.id, name: String(project.name || project.slug), value: count.totalDocs }
    }),
  )

  // 跟进动态：跟进次数、平均成交周期、近期事件与成交时间戳（来自 lead-activities）。
  const createdAtMs = new Map<number, number>()
  const convertedAtMs = new Map<number, number>()
  let followUpCount = 0
  for (const a of actsAll.docs) {
    const leadId = Number(a.lead)
    const ts = new Date(a.createdAt).getTime()
    if (a.type === 'follow_up') followUpCount += 1
    if (a.type === 'created' && !createdAtMs.has(leadId)) createdAtMs.set(leadId, ts)
    if (a.type === 'status_changed') {
      const m = a.meta as { to?: string } | null | undefined
      if (m?.to === 'converted' && !convertedAtMs.has(leadId)) convertedAtMs.set(leadId, ts)
    }
  }
  let cycleSum = 0
  let cycleCount = 0
  for (const [leadId, convTs] of convertedAtMs) {
    const createdTs = createdAtMs.get(leadId)
    if (!createdTs || convTs < createdTs) continue
    cycleSum += Math.round((convTs - createdTs) / 3_600_000)
    cycleCount += 1
  }
  const avgCycle = cycleCount > 0 ? Math.round(cycleSum / cycleCount) : null

  // 操作人/跟进人显示名。
  const userName = new Map<string, string>()
  for (const u of users.docs) userName.set(String(u.id), u.name || u.username || `用户${u.id}`)

  // 跟进人分布：按 owner 聚合线索数。
  const ownerRows: Slice[] = []
  const ownerCount = new Map<string, number>()
  for (const doc of sourceRows.docs) {
    const ownerKey = doc.owner == null ? 'unassigned' : String(doc.owner)
    ownerCount.set(ownerKey, (ownerCount.get(ownerKey) || 0) + 1)
  }
  for (const [key, value] of ownerCount.entries()) {
    const label = key === 'unassigned' ? '未分配' : userName.get(String(Number(key))) || `用户${key}`
    ownerRows.push({ label, value })
  }
  ownerRows.sort((a, b) => b.value - a.value)

  // 近期动态：取最近 8 条。
  const TYPE_LABEL: Record<string, string> = {
    created: '创建入池',
    status_changed: '状态流转',
    assigned: '线索分配',
    follow_up: '跟进写注',
  }
  const recentActs = actsAll.docs.slice(0, 8).map((a, i) => {
    const actor = a.actor
      ? userName.get(String(Number(a.actor))) || `用户${a.actor}`
      : '系统'
    const time = new Date(
      new Date(a.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }),
    ).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    return { key: `${a.id}-${i}`, label: TYPE_LABEL[String(a.type)] || String(a.type), detail: String(a.detail || ''), actor, time }
  })

  // 近 14 日趋势（新增 + 成交双系列）：新增按线索 createdAt 归日，成交按成交事件时间归日。
  const dualBars = Array.from({ length: 14 }, (_, i) => {
    const t = new Date(now - (13 - i) * dayMs)
    return { label: `${t.getMonth() + 1}/${t.getDate()}`, key: dayKey(t.getTime()), newValue: 0, converted: 0 }
  })
  const dualByKey = new Map(dualBars.map((b) => [b.key, b]))
  for (const doc of sourceRows.docs) {
    const b = dualByKey.get(dayKey(new Date(doc.createdAt).getTime()))
    if (b) b.newValue += 1
  }
  for (const [leadId, convTs] of convertedAtMs) {
    const b = dualByKey.get(dayKey(convTs))
    if (b) b.converted += 1
  }
  const trendHasData = dualBars.some((b) => b.newValue > 0 || b.converted > 0)

  const conversion = convertedRate

  const statCards = [
    { key: 'total', label: '累计线索', value: String(totalLeads.totalDocs), hint: '全部留资来源', icon: 'users' },
    { key: 'today', label: '今日新增', value: String(todayLeads.totalDocs), hint: '今日 00:00 起', icon: 'clock' },
    { key: 'follow', label: '待跟进', value: String(newLeads.totalDocs), hint: 'new 状态等待接洽', icon: 'bell', tone: 'amber' },
    { key: 'reminder', label: '待跟进提醒', value: String(openReminders.totalDocs), hint: '规则命中未处理', icon: 'flag', tone: 'amber' },
    { key: 'rate', label: '成交转化率', value: `${conversion}%`, hint: `${convertedCount} 已成交 / ${totalCount} 总量`, icon: 'percent' },
    { key: 'amount', label: '累计成交金额', value: formatAmount(totalAmount), hint: `${convertedCount} 单已成交`, icon: 'money' },
    { key: 'followup', label: '跟进次数', value: String(followUpCount), hint: 'follow_up 动态累计', icon: 'write' },
    { key: 'cycle', label: '平均成交周期', value: avgCycle == null ? '—' : `${avgCycle}h`, hint: '入池到成交平均用时', icon: 'watch' },
    { key: 'article', label: '已发布文章', value: String(articles.totalDocs), hint: '对公开站可见', icon: 'doc' },
  ]

  return (
    <div className="admin-dashboard">
      <header className="admin-hero">
        <div>
          <h2 className="admin-hero-title">运营工作台</h2>
          <p className="admin-hero-sub">
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
            ，把团队今天关心的数据放在一起看。
          </p>
        </div>
        <Link className="btn btn--style-primary" href="/admin/collections/leads">
          查看全部线索
        </Link>
      </header>

      <div className="admin-grid admin-cards">
        {statCards.map((card) => (
          <div className="admin-card" key={card.key}>
            <div className={`admin-card-icon${card.tone ? ` is-${card.tone}` : ''}`}>
              <MetricIcon name={card.icon} />
            </div>
            <div className="admin-stat-label">{card.label}</div>
            <div className="admin-stat-value">{card.value}</div>
            <div className="admin-stat-trend">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* 近 14 日趋势（新增 / 成交） */}
        <div className="admin-card">
          <div className="admin-section-title">近 14 日新增与成交</div>
          {trendHasData ? (
            <DailyDualBars days={dualBars} />
          ) : (
            <AdminEmpty title="近 14 日还没有数据" text="线索入池或成交后会自动出现。" />
          )}
        </div>

        {/* 来源占比 */}
        <div className="admin-card">
          <div className="admin-section-title">来源分布</div>
          {sourceSlices.length ? (
            <div className="admin-source">
              <Donut slices={sourceSlices} />
              <ul className="admin-source-legend">
                {sourceSlices.map((s, i) => (
                  <li key={i}>
                    <span className="admin-dot" style={{ background: s.color || 'var(--theme-elevation-400)' }} />
                    <span className="admin-legend-label">{s.label}</span>
                    <span className="admin-legend-value">
                      {s.value} 单
                      {s.converted ? ` · ${s.converted} 成交` : ''}
                      {s.amount ? ` · ￥${formatAmount(s.amount)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <AdminEmpty title="还没有来源数据" text="线索入池后按渠道统计。" />
          )}
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* 阶段漏斗 */}
        <div className="admin-card">
          <div className="admin-section-title">线索阶段分布</div>
          <RankedBars rows={funnel} />
        </div>

        {/* 跟进人分布 */}
        <div className="admin-card">
          <div className="admin-section-title">跟进人分布</div>
          {ownerRows.length ? (
            <RankedBars rows={ownerRows} />
          ) : (
            <AdminEmpty title="还没有跟进人数据" text="为线索分配 owner 后按人统计。" />
          )}
        </div>
      </div>

      {/* 项目引流 */}
      <div className="admin-section-title admin-section-margin">项目引流</div>
      {projectRows.length ? (
        <div className="admin-card">
          <RankedBars rows={projectRows.map((p) => ({ label: p.name, value: p.value }))} />
        </div>
      ) : (
        <AdminEmpty title="还没有项目" text="先创建一个项目，线索会自动归类。" />
      )}

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* 近期动态 */}
        <div className="admin-card">
          <div className="admin-section-title">近期动态</div>
          {recentActs.length ? (
            <div className="admin-feed">
              {recentActs.map((a) => (
                <div className="admin-feed-row" key={a.key}>
                  <span className="admin-feed-tag">{a.label}</span>
                  <div className="admin-feed-main">
                    <div className="admin-feed-text">{a.detail || '更新了线索状态'}</div>
                    <div className="admin-feed-meta">
                      {a.actor} · {a.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmpty title="还没有动态" text="线索创建、跟进、流转后会自动记录。" />
          )}
        </div>

        {/* 最新线索 */}
        <div className="admin-card">
          <div className="admin-section-title">最新线索</div>
          {recentLeads.docs.length ? (
            <div className="admin-list">
              {recentLeads.docs.map((lead) => (
                <div className="admin-list-row" key={String(lead.id)}>
                  <div className="admin-list-main">
                    <span
                      className={`admin-badge tone-${LEAD_TONE[(lead.status as string) || 'new'] || 'teal'}`}
                    >
                      {STATUS_LABEL[String(lead.status)] || String(lead.status)}
                    </span>
                    <div>
                      <div className="admin-list-title">{lead.title}</div>
                      <div className="admin-list-meta">
                        {[lead.phone, lead.wechat, lead.company].filter(Boolean).join(' · ') || '未留联系方式'}
                      </div>
                    </div>
                  </div>
                  <Link className="btn btn--style-secondary" href={`/admin/collections/leads/${lead.id}`}>
                    查看
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmpty title="还没有线索" text="公开表单提交后会自动出现在这里。" />
          )}
        </div>
      </div>
    </div>
  )
}

function AdminEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="admin-empty">
      <div className="admin-empty-title">{title}</div>
      <span>{text}</span>
    </div>
  )
}

/** 精简线性图标：stroke 风格，随当前色。 */
function MetricIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const paths: Record<string, React.ReactNode> = {
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M15 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    flag: (
      <>
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </>
    ),
    percent: (
      <>
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </>
    ),
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    ),
    write: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    watch: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
        <path d="M12 2v3M12 19v3" />
      </>
    ),
    money: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 10h.01M18 14h.01" />
      </>
    ),
  }
  return (
    <svg {...common} className="admin-icon">
      {paths[name] || paths.doc}
    </svg>
  )
}