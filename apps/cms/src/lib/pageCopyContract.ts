import type { CollectionSlug } from 'payload'

/**
 * 页面文案的合同常量：站点 → 项目、页面 → 集合。导入脚本与公开读端点共用这一份，
 * 不在两处各写一遍（AGENTS.md §4 禁双写）。
 *
 * 注意与 `api/v2/content/articles/route.ts` 的同名映射**语义不同**：那里 `juece` 是 undefined
 * （主站聚合全部已发布文章），这里 `juece` 必须显式指向自己的项目（一页一款，主站不能吞掉分站文案）。
 */

export const SITE_IDS = ['juece', 'erp', 'yunque'] as const
export type SiteId = (typeof SITE_IDS)[number]

export const PAGE_IDS = ['home', 'features', 'solutions', 'pricing'] as const
export type PageId = (typeof PAGE_IDS)[number]

/** 三站全部显式：缺任何一项都会把分站文案发到别的站。 */
export const SITE_PROJECT_SLUG: Record<SiteId, string> = {
  juece: 'juece-grow',
  erp: 'juece-erp',
  yunque: 'yunque',
}

/** 页面身份 = 集合身份（design D1）。 */
export const PAGE_COLLECTION: Record<PageId, CollectionSlug> = {
  home: 'page-home',
  features: 'page-features',
  solutions: 'page-solutions',
  pricing: 'page-pricing',
}

/** 查询参数守卫：只认表里的字面值，其它一律 INVALID_*，不做大小写或别名宽容。 */
export function asSiteId(value: string | null): SiteId | null {
  return SITE_IDS.includes(value as SiteId) ? (value as SiteId) : null
}

export function asPageId(value: string | null): PageId | null {
  return PAGE_IDS.includes(value as PageId) ? (value as PageId) : null
}
