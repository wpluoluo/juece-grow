/**
 * 站点配置：渲染层（Layout/页脚/区块）从这里读品牌、导航、SEO、联系信息，
 * 与硬编码品牌解耦。
 *
 * 子域分站（独立构建）：
 * - 每个站点一套独立 `astro build`，构建期由 `SITE_ID`（juece / erp / yunque）
 *   选择对应站点配置；域名由 `astro.config.mjs` 按同一 SITE_ID 决定。
 * - 默认不传 SITE_ID 时按 juece（主站）构建。
 * - 未知 SITE_ID 直接抛错，不静默回退（禁兜底）。
 */

export type SiteId = 'juece' | 'erp' | 'yunque'

export type SiteLink = { label: string; href: string; external?: boolean }

/** 品牌视觉色面：主题色及其派生，供 :root CSS 变量注入与 logo/渐变使用。 */
export type BrandColors = {
  themeColor: string
  themeHover: string
  themeActive: string
  themeBg: string
}

export type Site = {
  brand: {
    name: string
    subtitle: string
    colors: BrandColors
  }
  nav: SiteLink[]
  loginUrl: string
  trialText: string
  contact: { email: string; hours: string }
  footer: {
    desc: string
    products: SiteLink[]
    industries: SiteLink[]
    beian: string
  }
}

/** 主站 · 觉策智云（实体商业数字化 SaaS） */
export const jueceSite: Site = {
  brand: {
    name: '觉策科技',
    subtitle: '让经营与智能协同进化',
    colors: {
      themeColor: '#2f8f96',
      themeHover: '#257a80',
      themeActive: '#1b5f65',
      themeBg: 'rgba(47, 143, 150, 0.09)',
    },
  },
  nav: [
    { label: '首页', href: '/' },
    { label: '行业方案', href: '/solutions/' },
    { label: '功能全景', href: '/features/' },
    { label: '价格方案', href: '/pricing/' },
    { label: '文章', href: '/#articles' },
  ],
  loginUrl: '//admin.juece.cloud/',
  trialText: '免费试用',
  contact: { email: '58379760@qq.com', hours: '周一至周五 9:00 - 18:00' },
  footer: {
    desc: '覆盖实体商业数字化、广告行业经营管理与智能体工作系统，三条产品线各盯一类经营结果，都在这里找解法。',
    products: [
      { label: '觉策智云 · SaaS 平台', href: '/features/' },
      { label: '觉策ERP · 广告行业管理系统', href: '//erp.juece.cloud/', external: true },
      { label: '云雀 Yunque · 智能体工作系统', href: '//yunque.juece.cloud/', external: true },
    ],
    industries: [
      { label: '教育培训', href: '/solutions/' },
      { label: '体育场馆', href: '/solutions/' },
      { label: '餐饮美食', href: '/solutions/' },
      { label: '到店服务', href: '/solutions/' },
      { label: '广告制作行业', href: '//erp.juece.cloud/', external: true },
    ],
    beian: '渝ICP备2025076099号-1',
  },
}

/** ERP · 广告行业管理系统 */
export const erpSite: Site = {
  brand: {
    name: '觉策ERP',
    subtitle: '广告行业的订单、生产、交付与账款，在一个系统里跑通',
    colors: {
      themeColor: '#3f6d8f',
      themeHover: '#335d7a',
      themeActive: '#284a63',
      themeBg: 'rgba(63, 109, 143, 0.09)',
    },
  },
  nav: [
    { label: '首页', href: '/' },
    { label: '行业流程', href: '/solutions/' },
    { label: '功能模块', href: '/features/' },
    { label: '版本价格', href: '/pricing/' },
    { label: '文章', href: '/#articles' },
  ],
  loginUrl: '//erp.juece.cloud/',
  trialText: '申请试用',
  contact: { email: '58379760@qq.com', hours: '周一至周五 9:00 - 18:00' },
  footer: {
    desc: '服务广告制作与广告行业经营：从报价、下单到生产排期、交付签收与账款结算，全流程可追溯，用报表看经营。',
    products: [
      { label: '觉策ERP · 广告行业管理系统', href: '/features/' },
      { label: '觉策智云 · SaaS 平台', href: '//juece.cloud/', external: true },
      { label: '云雀 Yunque · 智能体工作系统', href: '//yunque.juece.cloud/', external: true },
    ],
    industries: [
      { label: '广告制作行业', href: '/solutions/' },
      { label: '喷绘写真', href: '/solutions/' },
      { label: '标识标牌', href: '/solutions/' },
      { label: '图文快印', href: '/solutions/' },
      { label: '招牌灯箱', href: '/solutions/' },
    ],
    beian: '渝ICP备2025076099号-1',
  },
}

/** 云雀 Yunque · 智能体工作系统 */
export const yunqueSite: Site = {
  brand: {
    name: '云雀 Yunque',
    subtitle: '把重复执行交给智能体，关键环节仍由人决策',
    colors: {
      themeColor: '#b8863f',
      themeHover: '#9c7134',
      themeActive: '#7f5c29',
      themeBg: 'rgba(184, 134, 63, 0.1)',
    },
  },
  nav: [
    { label: '首页', href: '/' },
    { label: '适用场景', href: '/solutions/' },
    { label: '智能体能力', href: '/features/' },
    { label: '价格方案', href: '/pricing/' },
    { label: '文章', href: '/#articles' },
  ],
  loginUrl: '//yunque.juece.cloud/',
  trialText: '免费体验',
  contact: { email: '58379760@qq.com', hours: '周一至周五 9:00 - 18:00' },
  footer: {
    desc: '面向团队与智能体的工作系统：文档、任务、审批与知识库统一在一个空间里，智能体接管重复执行，人专注需要判断的环节。',
    products: [
      { label: '云雀 Yunque · 智能体工作系统', href: '/features/' },
      { label: '觉策智云 · SaaS 平台', href: '//juece.cloud/', external: true },
      { label: '觉策ERP · 广告行业管理系统', href: '//erp.juece.cloud/', external: true },
    ],
    industries: [
      { label: '项目管理', href: '/solutions/' },
      { label: '流程自动化', href: '/solutions/' },
      { label: '知识管理', href: '/solutions/' },
      { label: '客户跟进', href: '/solutions/' },
      { label: '运营执行', href: '/solutions/' },
    ],
    beian: '渝ICP备2025076099号-1',
  },
}

const SITES: Record<SiteId, Site> = {
  juece: jueceSite,
  erp: erpSite,
  yunque: yunqueSite,
}

const currentSiteId = (import.meta.env.SITE_ID as SiteId | undefined) || 'juece'

if (!(currentSiteId in SITES)) {
  throw new Error(
    `Unknown SITE_ID "${currentSiteId}"; expected one of: ${Object.keys(SITES).join(', ')}`
  )
}

/** 当前构建生效的站点 id（供内容层按同一 SITE_ID 选取内容源）。 */
export const siteId: SiteId = currentSiteId

/** 当前构建生效站点。 */
export const site: Site = SITES[siteId]