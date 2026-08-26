'use client'

import { useEffect, useState } from 'react'

type Stats = {
  total: number
  converted: number
  convertedRate: number
  funnel: { status: string; count: number; share: number }[]
  byStatus: { status: string; count: number }[]
  bySource: { source: string; total: number; converted: number; convertedRate: number }[]
  byOwner: { owner: string; name: string; count: number }[]
}

const STATUS_LABELS: Record<string, string> = {
  new: '新线索',
  contacted: '已联系',
  converted: '已成交',
  closed: '已关闭',
}

const SOURCE_LABELS: Record<string, string> = {
  website: '官网表单',
  campaign: '渠道活动',
  douyin: '抖音',
  xiaohongshu: '小红书',
  manual: '手动录入',
  support: '客服收件',
  referral: '他人推荐',
  other: '其他',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const me = await fetch('/api/users/me', { cache: 'no-store' })
        const meJson = (await me.json()) as { user?: unknown }
        if (alive) {
          if (!meJson.user) return // 未登录：停留默认 false
          setLoggedIn(true)
        }
      } catch {
        /* 登录态接口异常不阻塞，仅当作未登录 */
      }
      try {
        const res = await fetch('/api/v2/stats/leads', { cache: 'no-store' })
        const json = (await res.json()) as { success: boolean; data?: Stats }
        if (!alive) return
        if (!res.ok || !json.success) {
          setError('看板数据加载失败')
          return
        }
        setStats(json.data ?? null)
      } catch {
        if (alive) setError('网络异常，无法加载看板')
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  if (!loggedIn) {
    return (
      <main style={centerStyle}>
        <p style={{ fontSize: 15 }}>请先登录后台查看看板</p>
        <a href="/admin" style={linkStyle}>
          前往登录
        </a>
      </main>
    )
  }

  const showEmpty = !error && (!stats || stats.total === 0)

  return (
    <main style={mainStyle}>
      <h1 style={h1Style}>线索看板</h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0 24px' }}>
        <Card label="总线索" value={stats?.total ?? 0} />
        <Card label="已成交" value={stats?.converted ?? 0} />
        <Card label="转化率" value={`${stats?.convertedRate ?? 0}%`} />
      </div>

      {showEmpty && <p style={{ color: '#8a8f99', fontSize: 13 }}>当前项目下暂无线索数据。</p>}
      {error && <p style={{ color: '#b3402a', fontSize: 13 }}>{error}</p>}
      {!stats && !error && <p style={{ color: '#8a8f99', fontSize: 13 }}>加载中…</p>}

      {stats && (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>阶段漏斗</h2>
            {stats.funnel.map((f) => (
              <div key={f.status} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                  <span>{STATUS_LABELS[f.status] ?? f.status}</span>
                  <span>
                    {f.count} · {f.share}%
                  </span>
                </div>
                <div style={trackStyle}>
                  <div style={{ ...barStyle, width: `${f.share}%` }} />
                </div>
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>来源归因</h2>
            {stats.bySource.length === 0 && <p style={{ color: '#8a8f99', fontSize: 12 }}>暂无来源数据</p>}
            {stats.bySource.map((s) => (
              <div key={s.source} style={rowStyle}>
                <span style={{ fontSize: 13 }}>{SOURCE_LABELS[s.source] ?? s.source}</span>
                <span style={{ fontSize: 12, color: '#666' }}>
                  {s.total} 条 · 成交 {s.converted}（{s.convertedRate}%）
                </span>
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>跟进人分布</h2>
            {stats.byOwner.length === 0 && <p style={{ color: '#8a8f99', fontSize: 12 }}>暂无跟进人数据</p>}
            {stats.byOwner.map((o) => (
              <div key={o.owner} style={rowStyle}>
                <span style={{ fontSize: 13 }}>{o.name}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{o.count} 条</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  )
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, color: '#2b3038' }}>{value}</div>
    </div>
  )
}

const mainStyle: React.CSSProperties = {
  maxWidth: 1040,
  margin: '0 auto',
  padding: '28px 24px 48px',
  fontFamily: 'system-ui, sans-serif',
  background: '#f7f8fa',
  minHeight: '100vh',
}
const centerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  fontFamily: 'system-ui, sans-serif',
  background: '#f7f8fa',
}
const h1Style: React.CSSProperties = { fontSize: 20, color: '#2b3038', margin: 0 }
const h2Style: React.CSSProperties = { fontSize: 15, color: '#333', margin: '0 0 14px' }
const cardStyle: React.CSSProperties = {
  minWidth: 120,
  padding: '14px 16px',
  background: '#fff',
  border: '1px solid #e6e8ec',
  borderRadius: 8,
}
const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e6e8ec',
  borderRadius: 8,
  padding: '18px',
}
const trackStyle: React.CSSProperties = {
  height: 8,
  background: '#eef0f3',
  borderRadius: 4,
  overflow: 'hidden',
}
const barStyle: React.CSSProperties = {
  height: '100%',
  background: '#6b7c93',
  borderRadius: 4,
}
const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '7px 0',
  borderBottom: '1px solid #f0f1f3',
}
const linkStyle: React.CSSProperties = { color: '#3b6ea5', fontSize: 14 }