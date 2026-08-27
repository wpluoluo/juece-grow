import { getArticles } from '../lib/payload'

/** 生成 RSS Feed（/feed.xml）。域名来自 Astro site 配置（astro.config.mjs）单一来源。 */
export async function GET({ site }: { site?: URL }) {
  const origin = (site as URL).href.replace(/\/$/, '')
  const articles = await getArticles()

  const items = articles
    .map((a) => {
      const pubDate = a.publishedAt || a.createdAt
      if (!pubDate) return ''
      const url = `${origin}/articles/${a.slug}/`
      const title = a.seoTitle || a.title
      const desc = (a.seoDescription || a.excerpt || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      const date = new Date(pubDate).toUTCString()
      return `    <item>
      <title><![CDATA[${title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${desc}</description>
      <pubDate>${date}</pubDate>
    </item>`
    })
    .join('\n')

  const now = new Date().toUTCString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>觉策科技 · 文章</title>
    <link>${origin}/</link>
    <description>智云管线上开店，ERP 管制作交付，云雀管 AI 落地。三条产品线，各帮你管住一件正事。</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}