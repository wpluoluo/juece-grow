import { defineConfig } from 'astro/config'

// 子域分站（独立构建）：SITE_ID 决定本站域名，与 src/site.ts 的配置选择保持一致。
const rawSiteId = process.env.SITE_ID
if (typeof rawSiteId !== 'string' || rawSiteId.trim() === '') {
  throw new Error(
    '缺少 SITE_ID：域名与站点配置都按 SITE_ID 选择，不给默认站点，缺标识即构建失败（禁兜底）。' +
      '请通过 apps/astro/package.json 的脚本入口运行（它们用 cross-env SITE_ID=<juece|erp|yunque> 显式赋值）：' +
      'pnpm astro:dev / astro:build / astro:build:erp / astro:build:yunque；' +
      '直接调用 astro 时写作 cross-env SITE_ID=juece astro build。',
  )
}
const SITE_ID = rawSiteId.trim()
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