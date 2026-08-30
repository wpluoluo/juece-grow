/** Astro 侧从 Payload 拉取公开数据的客户端。数据只经 /api/v2/content/articles（跨端隔离 + 脱敏），不直连原生 REST。 */

import { siteId, type SiteId } from '../site'

/** Payload CMS 源地址，单一事实来源：来自 PUBLIC_CMS_ORIGIN（apps/astro/.env）。缺省即 fail-fast。 */
export const CMS_ORIGIN = import.meta.env.PUBLIC_CMS_ORIGIN

export type Project = {
  id: number
  name: string
  slug: string
}

export type Article = {
  id: number
  title: string
  slug: string
  excerpt?: string
  status: 'draft' | 'published'
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
  project?: Project
  category?: { id: number; name: string }
  coverImage?: { id: number; url: string; alt?: string }
  author?: string
  body?: unknown
  seoTitle?: string
  seoDescription?: string
}

type ContentList = { articles: Article[] }

async function fetchContent(query: string): Promise<ContentList> {
  const url = `${CMS_ORIGIN}/api/v2/content/articles?${query}`
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Content 拉取失败: ${res.status}`)
  const body = (await res.json()) as { success: boolean; data: ContentList }
  if (!body.success) throw new Error('Content 拉取失败: response not success')
  return body.data
}

/** 当前站点的文章列表：主站返回全部已发布，分站由 v2 按项目隔离。 */
export async function getArticles(): Promise<Article[]> {
  const data = await fetchContent(`site=${siteId}`)
  return data.articles
}

/** 按 slug 取单篇（同样按当前站点隔离）。 */
export async function getArticleBySlug(slug: string): Promise<Article[]> {
  const data = await fetchContent(`site=${siteId}&slug=${encodeURIComponent(slug)}`)
  return data.articles
}

/** 各站点对应的项目 slug，作为留资归属的单一映射；主站 juece 对应 juece-grow 项目。 */
export const siteProjectSlug: Record<SiteId, string> = {
  juece: 'juece-grow',
  erp: 'juece-erp',
  yunque: 'yunque',
}