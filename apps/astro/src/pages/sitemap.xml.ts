import { getArticles } from '../lib/payload'

/** 生成 sitemap.xml：页面 + 全部已发布文章。域名来自 Astro site 配置（astro.config.mjs）单一来源。 */
export async function GET({ site }: { site?: URL }) {
  const origin = (site as URL).href.replace(/\/$/, '')
  const articles = await getArticles()

  const pages = ['/', '/solutions/', '/features/', '/pricing/', '/sitemap/', '/privacy/', '/terms/']

  const pageUrls = pages.map((p) => {
    const priority = p === '/' ? '1.0' : p === '/solutions/' || p === '/features/' || p === '/pricing/' ? '0.9' : '0.3'
    const changefreq = p === '/' ? 'daily' : p === '/solutions/' || p === '/features/' || p === '/pricing/' ? 'weekly' : 'yearly'
    return `<url><loc>${origin}${p}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
  })

  const articleUrls = articles.map(
    (a) =>
      `<url><loc>${origin}/articles/${encodeURIComponent(a.slug)}/</loc>` +
      (a.publishedAt ? `<lastmod>${a.publishedAt.slice(0, 10)}</lastmod>` : '') +
      '<changefreq>monthly</changefreq>' +
      '<priority>0.8</priority></url>',
  )

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pageUrls, ...articleUrls].join('\n')}\n</urlset>`

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}