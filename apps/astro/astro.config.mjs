import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  // 站点地址是 canonical/sitemap 的根基。开发期用本地，上线改为线上域名即可。
  site: process.env.PUBLIC_SITE_ORIGIN || 'http://localhost:4321',
  server: {
    port: 4321,
  },
})