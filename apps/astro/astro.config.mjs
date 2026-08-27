import { defineConfig } from 'astro/config'

// 子域分站（独立构建）：SITE_ID 决定本站域名，与 src/site.ts 的配置选择保持一致。
const SITE_ID = process.env.SITE_ID || 'juece'
const SITE_DOMAINS = {
  juece: 'https://juece.cloud',
  erp: 'https://erp.juece.cloud',
  yunque: 'https://yunque.juece.cloud',
}
if (!(SITE_ID in SITE_DOMAINS)) {
  throw new Error(
    `Unknown SITE_ID "${SITE_ID}"; expected one of: ${Object.keys(SITE_DOMAINS).join(', ')}`
  )
}

export default defineConfig({
  output: 'static',
  site: SITE_DOMAINS[SITE_ID],
  server: {
    port: 4321,
  },
})