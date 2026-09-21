/**
 * 行业方案页内容类型（单一真值）：值在构建期由 /api/v2/content/pages 端点从 Payload `page-solutions`
 * 集合读出，渲染层与 CMS 镜像结构均以此为准。
 */

import type { IconKey } from '../icons'
import type { LabeledValue } from '../shared'

export type SolutionIndustry = {
  label: string
  meta: string
  blurb: string
  tone: IconKey
  painPoints: string[]
  solutions: string[]
  scenarios: { title: string; desc: string }[]
}

export type SolutionsContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleLines: { text: string; emphasis?: boolean }[]
    description: string
    stats: LabeledValue[]
  }
  industries: SolutionIndustry[]
  cta: { kicker: string; heading: string; desc: string; btnText: string }
}
