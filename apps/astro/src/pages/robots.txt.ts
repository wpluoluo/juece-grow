/** 生成 robots.txt。域名来自 Astro site 配置（astro.config.mjs）单一来源。 */
export async function GET({ site }: { site?: URL }) {
  const origin = (site as URL).href.replace(/\/$/, '')
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${origin}/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}