import { getArticles } from '../lib/payload'

/** 生成 sitemap.xml：首页 + 全部已发布文章。 */
export async function GET() {
  const articles = await getArticles()
  const origin = import.meta.env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321'

  const urls = [
    `<url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...articles.map(
      (a) =>
        `<url><loc>${origin}/articles/${encodeURIComponent(a.slug)}/</loc>` +
        (a.publishedAt ? `<lastmod>${a.publishedAt.slice(0, 10)}</lastmod>` : '') +
        `<priority>0.8</priority></url>`,
    ),
  ]

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}