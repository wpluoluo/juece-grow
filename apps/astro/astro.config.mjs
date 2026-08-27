import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  site: 'https://juece.cloud',
  server: {
    port: 4321,
  },
})