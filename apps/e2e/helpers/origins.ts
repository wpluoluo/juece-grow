/**
 * e2e 端点的唯一定义处。
 *
 * 之前 `CMS_ORIGIN` 在 helpers/cmsRest.ts、tests/lead.spec.ts、tests/security.spec.ts 各写一遍，
 * `WEB_ORIGIN` 又与 playwright.config.ts 的 baseURL 各写一遍，改端口要动 5 处。
 * 两个 origin 都固定到本机 dev 端口：CMS 3000（next dev）、公开站 4321（astro dev）。
 */
export const CMS_ORIGIN = 'http://127.0.0.1:3000'
export const WEB_ORIGIN = 'http://127.0.0.1:4321'
