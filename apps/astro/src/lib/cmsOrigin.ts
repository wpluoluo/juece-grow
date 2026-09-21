/**
 * Payload CMS 源地址：唯一读取 + 唯一校验处。
 *
 * 为什么单独成模块（而不是放在 `lib/payload.ts` 里）：`lib/payload.ts` 顶部 import 了 `../site` 拿 `siteId`，
 * 而 `SITE_ID` 没有 `PUBLIC_` 前缀 ⇒ Vite 不会把它内联进客户端 bundle。客户端脚本（`Layout.astro` 的留资提交）
 * 用到的只是这个地址，若从 `lib/payload` 导入就会把 `site.ts` 一起打进浏览器，在页面运行时抛「缺少 SITE_ID」，
 * 整块客户端脚本（留资抽屉、移动菜单、文章搜索）随之死掉。本模块只依赖 `PUBLIC_CMS_ORIGIN`（有 `PUBLIC_`
 * 前缀，服务端与客户端都能内联），两端可共用同一份实现，没有第二条路径。
 */

const cmsOrigin: unknown = import.meta.env.PUBLIC_CMS_ORIGIN
if (typeof cmsOrigin !== 'string' || cmsOrigin.trim() === '') {
  throw new Error(
    '缺少 PUBLIC_CMS_ORIGIN：三站四页的页面文案与文章都在构建期从 Payload 读取，缺 CMS 地址即构建失败，不回退到代码内旧文案。' +
      '请在 apps/astro/.env 配置 PUBLIC_CMS_ORIGIN=http://<cms-host>:<port>（本地开发为 http://127.0.0.1:3000）后重试。',
  )
}

/** Payload CMS 源地址，单一事实来源：来自 `apps/astro/.env` 的 `PUBLIC_CMS_ORIGIN`，缺键即在模块求值时抛错。 */
export const CMS_ORIGIN: string = cmsOrigin.trim()
