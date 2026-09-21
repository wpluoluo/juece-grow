/**
 * 功能全景页内容类型（单一真值）：值在构建期由 /api/v2/content/pages 端点从 Payload `page-features`
 * 集合读出，渲染层与 CMS 镜像结构均以此为准。
 */

import type { LabeledValue } from '../shared'

/** 数据面板样式：决定页面渲染哪一种数据组件。 */
export type FeaturePanel =
  | { kind: 'blocks'; badge: string; title: string; blocks: { no: string; name: string; note: string; w: string }[] }
  | { kind: 'chips'; badge: string; title: string; chips: string[]; rows: { label: string; w: number; val: string }[] }
  | { kind: 'bars'; badge: string; title: string; kpis: { val: string; label: string }[]; bars: number[]; months: string[] }
  | { kind: 'journey'; badge: string; title: string; steps: string[] }
  | { kind: 'agent'; badge: string; title: string; core: string; pegs: { pos: 'p1' | 'p2' | 'p3' | 'p4'; icon: 'task' | 'memory' | 'gov' | 'ext'; text: string }[] }

export type FeatureCap = {
  no: string
  tag: string
  /** yb → 云雀暖金配色标签。 */
  tagTone?: 'yb'
  title: string
  reverse?: boolean
  aside: { p: string; points: string[] }
  panel: FeaturePanel
}

export type FeaturesContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleLines: { text: string; emphasis?: boolean }[]
    description: string
    stats: LabeledValue[]
  }
  caps: FeatureCap[]
  base: { kicker: string; heading: string; items: { title: string; desc: string }[] }
  cta: { kicker: string; heading: string; desc: string; btnText: string }
}
