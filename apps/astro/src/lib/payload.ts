/** Astro 侧从 Payload REST 拉取公开数据的客户端。 */

/** Payload CMS 源地址，单一事实来源：来自 PUBLIC_CMS_ORIGIN（apps/astro/.env）。缺省即 fail-fast。 */
export const CMS_ORIGIN = import.meta.env.PUBLIC_CMS_ORIGIN

export type Project = {
  id: number
  name: string
  slug: string
  description?: string
}

export type Article = {
  id: number
  title: string
  slug: string
  excerpt?: string
  status: 'draft' | 'published'
  publishedAt?: string
  createdAt?: string
  project: number | Project
  /** Lexical 富文本正文（SerializedEditorState）。 */
  body?: unknown
  seoTitle?: string
  seoDescription?: string
}

type PayloadList<T> = {
  docs: T
  totalDocs: number
}

async function fetchList<T>(
  collection: string,
  query: string,
): Promise<T> {
  const url = `${CMS_ORIGIN}/api/${collection}?depth=2&limit=50&${query}`
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Payload ${collection} 拉取失败: ${res.status}`)
  const body = (await res.json()) as PayloadList<T>
  return body.docs
}

/** 已发布文章列表。 */
export async function getArticles(): Promise<Article[]> {
  return fetchList<Article[]>('articles', 'where[status][equals]=published&sort=-publishedAt')
}

/** 按 slug 取单篇已发布文章。 */
export async function getArticleBySlug(slug: string): Promise<Article[] | null> {
  return fetchList<Article[]>(
    'articles',
    `where[slug][equals]=${encodeURIComponent(slug)}&where[status][equals]=published`,
  )
}

/** 项目列表。 */
export async function getProjects(): Promise<Project[]> {
  return fetchList<Project[]>('projects', 'sort=name')
}