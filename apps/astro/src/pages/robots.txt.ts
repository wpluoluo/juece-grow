const origin = import.meta.env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321'

export async function GET() {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${origin}/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}