import type { FC } from 'react'

export type Slice = { label: string; value: number; color?: string }

/** 低饱和配色序列，供图表切片循环使用。 */
const COLOR_WHEEL = [
  'var(--color-success-400)',
  'var(--color-success-250)',
  'var(--color-blue-300)',
  'rgb(215, 196, 165)',
  'var(--theme-elevation-400)',
]

/** 环形占比图：中心显示总数，切片按占比分段。 */
export const Donut: FC<{ slices: Slice[]; size?: number; thickness?: number }> = ({
  slices,
  size = 132,
  thickness = 18,
}) => {
  const total = slices.reduce((sum, s) => sum + Math.max(s.value, 0), 0)
  const radius = (size - thickness) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  // 自顶向下顺时针起笔：每段记录起点累计进度的负偏移。
  let acc = 0
  const segments = slices.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0
    const startFrac = acc
    acc += frac
    return { ...s, index: i, frac, dash: frac * circumference, offset: -startFrac * circumference }
  })

  return (
    <div className="admin-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="占比分布">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--theme-elevation-100)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map((s) =>
            s.dash > 0 ? (
              <circle
                key={s.index}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={s.color || COLOR_WHEEL[s.index % COLOR_WHEEL.length]}
                strokeWidth={thickness}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
              />
            ) : null,
          )}
        </g>
      </svg>
      <div className="admin-donut-center">
        <div className="admin-donut-value">{total}</div>
        <div className="admin-donut-caption">全部线索</div>
      </div>
    </div>
  )
}

export type DayPoint = { label: string; value: number }

/** 最近 N 日柱状趋势图。 */
export const DailyBars: FC<{ days: DayPoint[] }> = ({ days }) => {
  const max = Math.max(...days.map((d) => d.value), 1)
  const stepX = 100 / days.length
  const stepSpace = stepX * 0.62
  // plot 总高固定，为柱顶数值与底部标签留出空间。
  const plotHeight = 132
  const barMax = plotHeight - 14 - 18
  return (
    <div className="admin-barchart">
      <div className="admin-barchart-plot" style={{ height: plotHeight }}>
        {days.map((d, i) => (
          <div className="admin-barchart-col" key={i} style={{ width: `${stepX}%` }}>
            <div className="admin-barchart-val">{d.value || ''}</div>
            <div
              className="admin-barchart-bar"
              style={{ height: Math.max((d.value / max) * barMax, 2), width: `${stepSpace}%` }}
            />
            <div className="admin-barchart-label">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 横向条形列表：label + 轨道 + 数值，用于漏斗/分布等排行。 */
export const RankedBars: FC<{ rows: Slice[] }> = ({ rows }) => {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="admin-ranked">
      {rows.map((r, i) => (
        <div className="admin-ranked-row" key={i}>
          <div className="admin-ranked-label">{r.label}</div>
          <div className="admin-ranked-track">
            <div
              className="admin-ranked-bar"
              style={{
                width: `${(r.value / max) * 100}%`,
                background: r.color || COLOR_WHEEL[i % COLOR_WHEEL.length],
              }}
            />
          </div>
          <div className="admin-ranked-value">{r.value}</div>
        </div>
      ))}
    </div>
  )
}