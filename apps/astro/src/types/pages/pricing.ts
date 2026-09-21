/**
 * 价格页内容类型（单一真值）：值在构建期由 /api/v2/content/pages 端点从 Payload `page-pricing`
 * 集合读出，渲染层与 CMS 镜像结构均以此为准。
 */

export type PricingPlan = {
  name: string
  price: string
  /** 金额单位，如「/年」。授权利计费可留空。 */
  unit?: string
  /** 货币符号，默认 ¥；面议场景可留空。 */
  currency?: string
  desc: string
  btnText: string
  highlight: boolean
  /** 高亮卡片角标文案，默认「重点推荐」。 */
  recTag?: string
  features: string[]
}

export type PricingEcoLink = { label: string; href: string; ghost?: boolean }

export type PricingContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleLines: { text: string; emphasis?: boolean }[]
    description: string
  }
  plans: PricingPlan[]
  eco: {
    kicker: string
    heading: string
    desc: string
    links: PricingEcoLink[]
  }
  faqs: { q: string; a: string }[]
}
