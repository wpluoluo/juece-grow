import { NextRequest } from 'next/server'

import { getPayload, type Where } from 'payload'
import config from '@payload-config'

import { err, ok } from '../../../../../lib/envelope'

/**
 * 公开站统一内容面（跨端隔离的唯一读取入口）。
 *
 * 隔离口径：主站 juece 返回全部已发布文章；分站 erp / yunque 仅返回各自项目（按 project.slug）的文章。
 * 返回的项目/分类均为脱敏摘要（id/name/slug），不含联系人等内部字段。
 * 原生 /api/articles、/api/projects、/api/sites、/api/forms 均已收敛为登录可见，匿名不可枚举。
 */
const SITE_PROJECT_SLUG: Record<string, string | undefined> = {
  juece: undefined, // 主站：全部已发布
  erp: 'juece-erp',
  yunque: 'yunque',
}

type ArticleRow = {
  id: number
  title: string
  slug: string
  excerpt?: string
  status: string
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
  author?: string
  seoTitle?: string
  seoDescription?: string
  project?: { id: number; name: string; slug: string }
  category?: { id: number; name: string }
  coverImage?: { id: number; url: string; alt?: string }
  body?: unknown
}

/** 把 Payload 文档映射为公开安全投影：只取展示必需字段，绝不外泄项目联系人等内部字段。 */
function toPublicArticle(a: Record<string, unknown>, includeBody: boolean): ArticleRow {
  const project =
    a.project && typeof a.project === 'object' && 'id' in (a.project as object)
      ? {
          id: Number((a.project as { id: number }).id),
          name: String((a.project as { name?: string }).name ?? (a.project as { slug?: string }).slug ?? ''),
          slug: String((a.project as { slug?: string }).slug ?? ''),
        }
      : undefined
  const category =
    a.category && typeof a.category === 'object' && 'id' in (a.category as object)
      ? { id: Number((a.category as { id: number }).id), name: String((a.category as { name?: string }).name ?? '') }
      : undefined
  const cover =
    a.coverImage && typeof a.coverImage === 'object' && 'url' in (a.coverImage as object)
      ? {
          id: Number((a.coverImage as { id?: number }).id ?? 0),
          url: String((a.coverImage as { url?: string }).url ?? ''),
          alt: (a.coverImage as { alt?: string }).alt,
        }
      : undefined

  return {
    id: Number(a.id),
    title: String(a.title ?? ''),
    slug: String(a.slug ?? ''),
    excerpt: (a.excerpt as string | undefined) || undefined,
    status: String(a.status ?? ''),
    publishedAt: (a.publishedAt as string | undefined) || undefined,
    createdAt: (a.createdAt as string | undefined) || undefined,
    updatedAt: (a.updatedAt as string | undefined) || undefined,
    author: (a.author as string | undefined) || undefined,
    seoTitle: (a.seoTitle as string | undefined) || undefined,
    seoDescription: (a.seoDescription as string | undefined) || undefined,
    project,
    category,
    coverImage: cover,
    ...(includeBody ? { body: a.body } : {}),
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const site = url.searchParams.get('site') ?? 'juece'
    if (!(site in SITE_PROJECT_SLUG)) {
      return err('INVALID_SITE', `不支持的站点 "${site}"`, 400, req)
    }
    const slug = url.searchParams.get('slug')

    const payload = await getPayload({ config })
    const projectSlug = SITE_PROJECT_SLUG[site]

    const and: Where[] = [{ status: { equals: 'published' } }]
    if (projectSlug) {
      // 先按 slug 解析项目 id 再过滤：类型安全且 fail-closed（项目不存在则过滤到空，不兜底放行）。
      const proj = await payload.find({
        collection: 'projects',
        overrideAccess: true,
        where: { slug: { equals: projectSlug } },
        limit: 1,
        depth: 0,
      })
      and.push({ project: { equals: Number(proj.docs[0]?.id ?? -1) } })
    }
    const where: Where = and.length > 1 ? { and } : and[0]!

    const { docs } = await payload.find({
      collection: 'articles',
      overrideAccess: true,
      where,
      depth: 2,
      limit: 100,
      sort: slug ? undefined : '-publishedAt',
      pagination: false,
    })

    if (slug) {
      const hit = docs.find((a) => a.slug === slug)
      if (!hit) return ok({ articles: [] }, req)
      return ok({ articles: [toPublicArticle(hit as unknown as Record<string, unknown>, true)] }, req)
    }

    return ok({ articles: docs.map((a) => toPublicArticle(a as unknown as Record<string, unknown>, false)) }, req)
  } catch {
    return err('CONTENT_FETCH_FAILED', '内容拉取失败，请稍后再试', 500, req)
  }
}

export { OPTIONS } from '../../../../../lib/envelope'