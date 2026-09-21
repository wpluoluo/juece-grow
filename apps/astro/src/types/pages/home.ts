/**
 * 首页内容类型（单一真值）：值在构建期由 /api/v2/content/pages 端点从 Payload `page-home`
 * 集合读出，渲染层与 CMS 镜像结构均以此为准。
 */

import type { IconKey } from '../icons'
import type { LabeledValue } from '../shared'

export type HomeContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleLines: { text: string; emphasis?: boolean }[]
    desc: string
    primary: { label: string; action: 'lead' | 'href'; href?: string }
    secondary: { label: string; href: string }
    stats: { strong: string; span: string }[]
    diagram: {
      coreName: string
      coreSub: string
      nodes: { no: string; name: string; sub: string; tone: IconKey }[]
      chips: string[]
    }
  }
  products: {
    kicker: string
    heading: string
    desc: string
    spotlight: {
      tag: string
      icon: IconKey
      name: string
      desc: string
      points: string[]
      link: { label: string; href: string; external?: boolean }
    }
    side: {
      tag: string
      icon: IconKey
      name: string
      desc: string
      link: { label: string; href: string; external?: boolean }
    }[]
  }
  solutions: {
    kicker: string
    heading: string
    moreLabel: string
    moreHref: string
    rows: { title: string; audience: string; desc: string; points: string[] }[]
  }
  cases: {
    kicker: string
    heading: string
    feature: { band: string; title: string; desc: string; metrics: LabeledValue[] }
    minis: { band: string; tone?: IconKey; title: string; desc: string; tag: string }[]
  }
  resource: {
    kicker: string
    heading: string
    desc: string
    links: { title: string; sub: string; href: string; external?: boolean }[]
  }
  cta: {
    kicker: string
    heading: string
    desc: string
    rows: {
      icon: IconKey
      head: string
      desc: string
      act: string
      action: 'lead' | 'href'
      href?: string
      external?: boolean
    }[]
  }
  blog: { kicker: string; heading: string; desc: string }
}
