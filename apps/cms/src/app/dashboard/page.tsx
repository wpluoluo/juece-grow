'use client'

import { useEffect, useState } from 'react'

import { I18nProvider, LangSwitcher, useLocale, type Dict } from '../../lib/i18n'

type Stats = {
  total: number
  converted: number
  convertedRate: number
  funnel: { status: string; count: number; share: number }[]
  byStatus: { status: string; count: number }[]
  bySource: { source: string; total: number; converted: number; convertedRate: number }[]
  byOwner: { owner: string; name: string; count: number }[]
}

const DICT: Dict = {
  boardTitle: { zh: '线索看板', en: 'Lead Dashboard' },
  loginPrompt: { zh: '请先登录后台查看看板', en: 'Please log in first to view the dashboard' },
  goLogin: { zh: '前往登录', en: 'Go to login' },
  total: { zh: '总线索', en: 'Total leads' },
  converted: { zh: '已成交', en: 'Converted' },
  convertedRate: { zh: '转化率', en: 'Conversion rate' },
  emptyData: { zh: '当前项目下暂无线索数据。', en: 'No lead data in the current project yet.' },
  loading: { zh: '加载中…', en: 'Loading…' },
  errLoad: { zh: '看板数据加载失败', en: 'Failed to load dashboard data' },
  errNet: { zh: '网络异常，无法加载看板', en: 'Network error, unable to load dashboard' },
  funnel: { zh: '阶段漏斗', en: 'Funnel' },
  bySource: { zh: '来源归因', en: 'Source attribution' },
  byOwner: { zh: '跟进人分布', en: 'Owner distribution' },
  noSource: { zh: '暂无来源数据', en: 'No source data' },
  noOwner: { zh: '暂无跟进人数据', en: 'No owner data' },
  unit: { zh: '{n} 条', en: '{n} leads' },
  unitConverted: { zh: '成交 {n}（{p}%）', en: '{n} converted ({p}%)' },
  'st.new': { zh: '新线索', en: 'New' },
  'st.contacted': { zh: '已联系', en: 'Contacted' },
  'st.converted': { zh: '已成交', en: 'Converted' },
  'st.closed': { zh: '已关闭', en: 'Closed' },
  'src.website': { zh: '官网表单', en: 'Website' },
  'src.campaign': { zh: '渠道活动', en: 'Campaign' },
  'src.douyin': { zh: '抖音', en: 'Douyin' },
  'src.xiaohongshu': { zh: '小红书', en: 'Xiaohongshu' },
  'src.manual': { zh: '手动录入', en: 'Manual' },
  'src.support': { zh: '客服收件', en: 'Support' },
  'src.referral': { zh: '他人推荐', en: 'Referral' },
  'src.other': { zh: '其他', en: 'Other' },
}

function Board() {
  const { t } = useLocale()
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
          setError(t('errLoad'))
          return
        }
        setStats(json.data ?? null)
      } catch {
        if (alive) setError(t('errNet'))
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [t])

  if (!loggedIn) {
    return (
      <main style={centerStyle}>
        <p style={{ fontSize: 15 }}>{t('loginPrompt')}</p>
        <a href="/admin" style={linkStyle}>
          {t('goLogin')}
        </a>
      </main>
    )
  }

  const showEmpty = !error && (!stats || stats.total === 0)

  return (
    <main style={mainStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={h1Style}>{t('boardTitle')}</h1>
        <LangSwitcher />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0 24px' }}>
        <Card label={t('total')} value={stats?.total ?? 0} />
        <Card label={t('converted')} value={stats?.converted ?? 0} />
        <Card label={t('convertedRate')} value={`${stats?.convertedRate ?? 0}%`} />
      </div>

      {showEmpty && <p style={{ color: '#8a8f99', fontSize: 13 }}>{t('emptyData')}</p>}
      {error && <p style={{ color: '#a8402a', fontSize: 13 }}>{error}</p>}
      {!stats && !error && <p style={{ color: '#8a8f99', fontSize: 13 }}>{t('loading')}</p>}

      {stats && (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('funnel')}</h2>
            {stats.funnel.map((f) => (
              <div key={f.status} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                  <span>{t(`st.${f.status}`)}</span>
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
            <h2 style={h2Style}>{t('bySource')}</h2>
            {stats.bySource.length === 0 && <p style={{ color: '#8a8f99', fontSize: 12 }}>{t('noSource')}</p>}
            {stats.bySource.map((s) => (
              <div key={s.source} style={rowStyle}>
                <span style={{ fontSize: 13 }}>{t(`src.${s.source}`)}</span>
                <span style={{ fontSize: 12, color: '#666' }}>
                  {t('unitConverted').replace('{n}', String(s.converted)).replace('{p}', String(s.convertedRate))} ·{' '}
                  {t('unit').replace('{n}', String(s.total))}
                </span>
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>{t('byOwner')}</h2>
            {stats.byOwner.length === 0 && <p style={{ color: '#8a8f99', fontSize: 12 }}>{t('noOwner')}</p>}
            {stats.byOwner.map((o) => (
              <div key={o.owner} style={rowStyle}>
                <span style={{ fontSize: 13 }}>{o.name}</span>
                <span style={{ fontSize: 12, color: '#666' }}>{t('unit').replace('{n}', String(o.count))}</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  )
}

export default function DashboardPage() {
  return (
    <I18nProvider
      dict={DICT}
      titles={{ zh: '线索看板 · 觉策增长', en: 'Lead Dashboard · Juece Growth' }}
    >
      <Board />
    </I18nProvider>
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