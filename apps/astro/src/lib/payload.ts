/** Astro 侧从 Payload 拉取公开数据的客户端。数据只经 /api/v2/content/*（跨端隔离 + 脱敏），不直连原生 REST。 */

import { siteId, type SiteId } from '../site'
import { CMS_ORIGIN } from './cmsOrigin'

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
  const label = `站点 ${siteId} 的文章列表`
  let res: Response
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    throw connectFailure(url, label, err)
  }
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

/** 页面文案集合的四值标识；与 CMS 端 `lib/pageCopyContract.ts` 的 PAGE_IDS 一一对应。 */
export type PageCopyId = 'home' | 'features' | 'solutions' | 'pricing'

/** 上游回的不是 JSON 信封时能摊出多少摊多少：截断原文，不静默。 */
const UPSTREAM_DETAIL_LIMIT = 500

/**
 * 把端点 `{ success: false, error: { code, message } }` 的错误原样报出来。
 * 这不是回退路径——调用方拿到返回值后照样抛错终止构建，这里只决定错误文本长什么样；
 * 响应体解析不出信封（网关吞了 body 之类）才退回截断原文。
 */
function upstreamDetail(text: string): string {
  const trimmed = text.trim()
  if (trimmed === '') return '上游响应体为空'
  try {
    const envelope = JSON.parse(trimmed) as { error?: { code?: string; message?: string } }
    if (envelope.error?.code !== undefined && envelope.error?.message !== undefined) {
      return `上游 error.code=${envelope.error.code}，error.message=${envelope.error.message}`
    }
    return `上游响应体不是错误信封：${trimmed.slice(0, UPSTREAM_DETAIL_LIMIT)}`
  } catch {
    return `上游响应体不是 JSON：${trimmed.slice(0, UPSTREAM_DETAIL_LIMIT)}`
  }
}

/**
 * 连接层失败（CMS 没起 / 地址指错 / 端口不通）的统一可读错误。
 *
 * 为什么不交给 `fetch` 自己抛：Node 的 `TypeError: fetch failed` 不带目标 URL 与业务标签，Astro 打印时
 * 只剩两行 `fetch failed` + `Caused by: connect ECONNREFUSED`，看不出是哪份数据没取到、更看不出有没有兜底
 * （PROB-028，tasks 3.6 的负向构建实测）。这里只改写错误文本，不吞异常——调用方照样抛出去终止构建。
 */
function connectFailure(url: string, label: string, err: unknown): Error {
  const reason = (err as { cause?: { message?: string } })?.cause?.message ?? String(err)
  return new Error(
    `${label} 拉取失败：请求 ${url} 未建立连接（${reason}）——构建期硬失败，不回退代码内旧文案。` +
      '请确认 CMS 已启动，且 apps/astro/.env 的 PUBLIC_CMS_ORIGIN 指向该地址。',
    { cause: err },
  )
}

/** 拉某页的已发布文案；`T` 用 `types/pages/*` 里的真值类型传入。缺发布记录即抛，不回退代码内文案。 */
export async function getPageCopy<T>(page: PageCopyId): Promise<T> {
  const url = `${CMS_ORIGIN}/api/v2/content/pages?${new URLSearchParams({ site: siteId, page })}`
  const label = `站点 ${siteId} 的「${page}」页面文案`
  let res: Response
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    throw connectFailure(url, label, err)
  }
  if (!res.ok) {
    throw new Error(`${label} 拉取失败：HTTP ${res.status}（${url}）——${upstreamDetail(await res.text())}`)
  }
  const body = (await res.json()) as { success: boolean; data?: { copy?: unknown } }
  if (!body.success) {
    throw new Error(`${label} 拉取失败：HTTP ${res.status} 但信封 success !== true（${url}）`)
  }
  if (body.data === undefined || body.data.copy === undefined) {
    throw new Error(`${label} 拉取失败：HTTP ${res.status} 但信封缺 data.copy，端点契约不符（${url}）`)
  }
  return body.data.copy as T
}

/** 各站点对应的项目 slug，作为留资归属的单一映射；主站 juece 对应 juece-grow 项目。 */
export const siteProjectSlug: Record<SiteId, string> = {
  juece: 'juece-grow',
  erp: 'juece-erp',
  yunque: 'yunque',
}