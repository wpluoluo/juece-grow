import type { AdminViewServerProps } from 'payload'

import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'
import { Donut, DailyBars, RankedBars } from './DashboardCharts'

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
    articles,
    projects,
    recentLeads,
    last7d,
    sourceRows,
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
    payload.count({ collection: 'articles', where: { status: { equals: 'published' } } }),
    payload.find({ collection: 'projects', where: {}, depth: 0, pagination: false, limit: 100 }),
    payload.find({ collection: 'leads', where: {}, sort: '-createdAt', limit: 6, depth: 1 }),
    payload.find({
      collection: 'leads',
      where: { createdAt: { greater_than: new Date(now - 7 * dayMs).toISOString() } },
      depth: 0,
      pagination: false,
      limit: 2000,
    }),
    payload.find({ collection: 'leads', where: {}, depth: 0, pagination: false, limit: 2000 }),
  ])

  // 近 7 日线索趋势：按本地日期聚合。
  const dayKey = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const t = new Date(now - (6 - i) * dayMs)
    return { key: dayKey(t.getTime()), label: `${t.getMonth() + 1}/${t.getDate()}`, value: 0 }
  })
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]))
  for (const doc of last7d.docs) {
    const b = bucketByKey.get(dayKey(new Date(doc.createdAt).getTime()))
    if (b) b.value += 1
  }

  // 来源渠道分布：自由文本，按出现次数聚合。
  const srcCount = new Map<string, number>()
  for (const doc of sourceRows.docs) {
    const src = String(doc.source || 'unknown')
    srcCount.set(src, (srcCount.get(src) || 0) + 1)
  }
  const sourceLabel: Record<string, string> = { website: '官网表单', unknown: '未标识', manual: '手动录入' }
  const sourceSlices = [...srcCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, value], i) => ({
      label: sourceLabel[key] || key,
      value,
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

  const conversion = totalLeads.totalDocs
    ? Math.round((convertedLeads.totalDocs / totalLeads.totalDocs) * 1000) / 10
    : 0

  const statCards = [
    { key: 'total', label: '累计线索', value: String(totalLeads.totalDocs), hint: '全部留资来源', icon: 'users' },
    { key: 'today', label: '今日新增', value: String(todayLeads.totalDocs), hint: '今日 00:00 起', icon: 'clock' },
    { key: 'follow', label: '待跟进', value: String(newLeads.totalDocs), hint: 'new 状态等待接洽', icon: 'bell', tone: 'amber' },
    { key: 'rate', label: '成交转化率', value: `${conversion}%`, hint: `${convertedLeads.totalDocs} 已成交 / ${totalLeads.totalDocs} 总量`, icon: 'percent' },
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
        {/* 近 7 日趋势 */}
        <div className="admin-card">
          <div className="admin-section-title">近 7 日新增线索</div>
          {last7d.docs.length ? (
            <DailyBars days={buckets} />
          ) : (
            <AdminEmpty title="近 7 日还没有新增" text="公开表单提交后会自动出现。" />
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
                    <span className="admin-legend-value">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <AdminEmpty title="还没有来源数据" text="线索入池后按渠道统计。" />
          )}
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        {/* 阶段漏斗 */}
        <div className="admin-card">
          <div className="admin-section-title">线索阶段分布</div>
          <RankedBars rows={funnel} />
        </div>

        {/* 项目引流 */}
        <div className="admin-card">
          <div className="admin-section-title">项目引流</div>
          {projectRows.length ? (
            <RankedBars rows={projectRows.map((p) => ({ label: p.name, value: p.value }))} />
          ) : (
            <AdminEmpty title="还没有项目" text="先创建一个项目，线索会自动归类。" />
          )}
        </div>
      </div>

      {/* 最新线索 */}
      <div className="admin-section-title admin-section-margin">最新线索</div>
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
  }
  return (
    <svg {...common} className="admin-icon">
      {paths[name] || paths.doc}
    </svg>
  )
}