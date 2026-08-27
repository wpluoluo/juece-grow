/** 成交（转化）深化的单一实现：按来源聚合数量/转化率/金额。route.ts 与 Dashboard.tsx 共用。 */

/** 完成转化（成交）的终点阶段。 */
export const CONVERTED_STATUS = 'converted'

/** 按来源聚合结果：数量、成交数、转化率、成交金额合计与平均客单价。 */
export interface SourceStat {
  source: string
  total: number
  converted: number
  convertedRate: number
  amount: number
  avgAmount: number | null
}

/** 参与聚合的线索行（只关心这三个字段）。 */
export interface LeadRow {
  source?: unknown
  status?: unknown
  dealAmount?: number | null
}

/** 按来源聚合：总数量、成交数、整体转化率、各来源金额与客单价。 */
export function aggregateBySource(rows: LeadRow[]): {
  bySource: SourceStat[]
  totalCount: number
  convertedCount: number
  totalAmount: number
  convertedRate: number
} {
  const sourceTotal = new Map<string, number>()
  const sourceConverted = new Map<string, number>()
  const sourceAmount = new Map<string, number>()
  let totalCount = 0
  let convertedCount = 0
  let totalAmount = 0

  for (const row of rows) {
    const source = typeof row.source === 'string' ? row.source : 'other'
    const status = typeof row.status === 'string' ? row.status : 'unknown'
    const amount = typeof row.dealAmount === 'number' && row.dealAmount > 0 ? row.dealAmount : 0

    totalCount += 1
    sourceTotal.set(source, (sourceTotal.get(source) ?? 0) + 1)
    if (status === CONVERTED_STATUS) {
      convertedCount += 1
      sourceConverted.set(source, (sourceConverted.get(source) ?? 0) + 1)
      if (amount > 0) {
        totalAmount += amount
        sourceAmount.set(source, (sourceAmount.get(source) ?? 0) + amount)
      }
    }
  }

  const rate = (part: number, base: number): number =>
    base === 0 ? 0 : Math.round((part / base) * 1000) / 10

  const bySource = [...sourceTotal.entries()]
    .map(([source, total]) => {
      const converted = sourceConverted.get(source) ?? 0
      const amount = sourceAmount.get(source) ?? 0
      return {
        source,
        total,
        converted,
        convertedRate: rate(converted, total),
        amount,
        avgAmount: converted > 0 ? Math.round(amount / converted) : null,
      }
    })
    .sort((a, b) => b.total - a.total)

  return {
    bySource,
    totalCount,
    convertedCount,
    totalAmount,
    convertedRate: rate(convertedCount, totalCount),
  }
}

/** 金额整理为可读字符串（元，千分位）。 */
export function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN')
}