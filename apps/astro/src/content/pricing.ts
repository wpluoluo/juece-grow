/**
 * 价格页内容源：按站点（SITE_ID）返回方案、跨产品入口与 FAQ。
 * 智云按年、ERP 按项目授权、云雀按团队规模，计费口径各自独立。
 */

import { siteId, type SiteId } from '../site'

export type PricingPlan = {
  name: string
  price: string
  /** 金额单位，如「/年」。授权利计费可留空。 */
  unit?: string
  /** 货币符号，默认 ¥；面议场景可留空。 */
  currency?: string
  desc: string
  btnText: string
  highlight: boolean
  /** 高亮卡片角标文案，默认「重点推荐」。 */
  recTag?: string
  features: string[]
}

export type PricingEcoLink = { label: string; href: string; ghost?: boolean }

export type PricingContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleA: string
    titleEm: string
    description: string
  }
  plans: PricingPlan[]
  eco: {
    kicker: string
    heading: string
    desc: string
    links: PricingEcoLink[]
  }
  faqs: { q: string; a: string }[]
}

/** 主站 · 觉策智云（按年付费的 SaaS 三档） */
const juece: PricingContent = {
  meta: {
    title: '价格方案 · 觉策科技',
    description: '觉策智云按年付费，ERP 与云雀计费方式不同，需要时单独问。',
  },
  hero: {
    kicker: '价格与合作',
    titleA: '价格摆出来，',
    titleEm: '选哪档你说了算',
    description:
      '这里是觉策智云的定价，按年付费，费用和权益都写明白。觉策ERP 和云雀 Yunque 计费方式不同，需要时单独问。',
  },
  plans: [
    {
      name: '基础版',
      price: '0',
      unit: '/年',
      desc: '免费把线上经营先跑起来，够用再升',
      btnText: '免费开始',
      highlight: false,
      features: [
        '基础会员管理',
        '积分商城（限 50 款商品）',
        '标准报表与核心数据看板',
        '社区支持与使用文档',
      ],
    },
    {
      name: '专业版',
      price: '3999',
      unit: '/年',
      desc: '多数往线上走的门店，从这一档开始更划算',
      btnText: '开始试用',
      highlight: true,
      recTag: '重点推荐',
      features: [
        '包含基础版全部功能',
        '商品上架数量不限',
        '营销自动化工具',
        '开放 API 与系统对接',
        '7×12 小时客服支持',
        '支持去除品牌标识',
      ],
    },
    {
      name: '旗舰版',
      price: '9999',
      unit: '/年',
      desc: '多门店、私有化、定制的场景，落到这一档',
      btnText: '开始使用',
      highlight: false,
      features: [
        '包含专业版全部功能',
        '支持私有化部署',
        '按需定制开发',
        'SLA 服务保障',
        '专属客户成功经理',
        '多门店 / 多商户统一管理',
      ],
    },
  ],
  eco: {
    kicker: '更多产品',
    heading: '想要 ERP 或者云雀？',
    desc: '觉策ERP 按项目授权，云雀 Yunque 按团队合作。计费方式不同，具体方案可咨询销售团队。',
    links: [
      { label: '看看觉策ERP', href: '//erp.juece.cloud/', ghost: false },
      { label: '了解云雀 Yunque', href: '//yunque.juece.cloud/', ghost: true },
    ],
  },
  faqs: [
    { q: '套餐能随时调整吗？', a: '可以。升级即时生效、费用按比例；降级次月生效，费用按实际计算。' },
    { q: '开发票吗？', a: '是的。所有付费套餐均支持开具增值税普通发票或专用发票。' },
    { q: '数据安全怎么保证？', a: '传输与存储环节均采用加密，每日自动备份。安全相关的细节可查阅服务协议。' },
    { q: '觉策ERP和云雀Yunque怎么收费？', a: 'ERP 按项目授权并收取年度服务费，云雀按团队规模定价。具体方案可咨询销售团队。' },
  ],
}

/** ERP 站 · 广告行业管理系统（按项目授权 + 年服务费） */
const erp: PricingContent = {
  meta: {
    title: '版本价格 · 觉策ERP',
    description:
      '觉策ERP 按项目授权并收取年度服务费。版本按订单规模与流程复杂度划分，具体费用按项目实测。',
  },
  hero: {
    kicker: '版本价格',
    titleA: '按项目授权，',
    titleEm: '费用按场景核',
    description:
      '觉策ERP 按订单规模与流程复杂度分版本，按项目授权并收取年度服务费。先把你做的工艺走一遍，费用按实际场景核。',
  },
  plans: [
    {
      name: '标准版',
      price: '面议',
      desc: '起步阶段：先把报价、开单、交付跑一条线',
      btnText: '申请试用',
      highlight: false,
      features: [
        '报价与快速开单',
        '客户档案与下单管理',
        '交付签收留底',
        '基础经营报表',
      ],
    },
    {
      name: '专业版',
      price: '面议',
      desc: '多数广告制作公司，从这一档走到全流程',
      btnText: '约一次演示',
      highlight: true,
      recTag: '多数选择',
      features: [
        '包含标准版全部功能',
        '工序拆解与生产看板',
        '外协交回与质检跟踪',
        '应收账期逐笔管理',
        '数电发票与税负统计',
        '客户门户自助下单查进度',
      ],
    },
    {
      name: '旗舰版',
      price: '面议',
      desc: '多分店、多组织、私有化部署的场景',
      btnText: '联系销售',
      highlight: false,
      features: [
        '包含专业版全部功能',
        '多组织 / 多分店统管',
        '支持私有化部署',
        '按需定制与流程改造',
        '专属交付与支持团队',
      ],
    },
  ],
  eco: {
    kicker: '更多产品',
    heading: '还有智云和云雀？',
    desc: '觉策智云管线上开店，云雀 Yunque 管内容与执行。计费方式不同，具体方案可咨询销售团队。',
    links: [
      { label: '看看觉策智云', href: '//juece.cloud/', ghost: false },
      { label: '了解云雀 Yunque', href: '//yunque.juece.cloud/', ghost: true },
    ],
  },
  faqs: [
    { q: '是按年付费还是按项目付费？', a: '按项目授权为主，另收年度服务费，包含升级与技术支持。费用按实际场景核算。' },
    { q: '能对接我们现有的开票或财务软件吗？', a: '专业版起开放 API，支持对接数电发票与常用财务系统。对接方式按项目确认。' },
    { q: '已有多年的历史账目能迁移吗？', a: '可以。客户、订单、应收等基础档案支持按模板迁移，上线前会先做数据核对。' },
    { q: '报价规则可以自定义吗？', a: '可以。按面积、材质、工序沉淀报价模板，报价口径统一后可逐年修订。' },
  ],
}

/** 云雀站 · 智能体工作系统（按团队规模） */
const yunque: PricingContent = {
  meta: {
    title: '价格方案 · 云雀 Yunque',
    description:
      '云雀按团队协作规模定价。先按最占人的活试起来，用得顺了再扩。方案可咨询。',
  },
  hero: {
    kicker: '价格方案',
    titleA: '按团队规模，',
    titleEm: '用得起也看得清',
    description:
      '云雀按团队协作规模定价，先在费用范围内把最占人的活走通。用得顺了再按需求扩，具体方案可咨询。',
  },
  plans: [
    {
      name: '团队版',
      price: '按团队',
      desc: '先让智能体顶上重复活，验证效果再扩',
      btnText: '免费体验',
      highlight: false,
      features: [
        '统一工作台（Chat、画布、文档）',
        '基础记忆与知识库',
        '常用流程自动化',
        '标准权限与审计记录',
      ],
    },
    {
      name: '企业版',
      price: '按团队',
      desc: '多数希望通过智能体提效的团队，从这一档开始',
      btnText: '约一次体验',
      highlight: true,
      recTag: '多数选择',
      features: [
        '包含团队版全部功能',
        '记忆与任务编排能力扩量',
        '细颗粒权限与治理控制台',
        '对接现有系统的插件',
        '专属部署与实施支持',
      ],
    },
    {
      name: '定制版',
      price: '面议',
      desc: '私有化、深度对接、多组织协作的场景',
      btnText: '联系销售',
      highlight: false,
      features: [
        '包含企业版全部功能',
        '支持私有化部署',
        '与现有系统的深度集成',
        '按业务定制流程',
        '专属客户成功经理',
      ],
    },
  ],
  eco: {
    kicker: '更多产品',
    heading: '还有智云和 ERP？',
    desc: '觉策智云管线上开店，觉策ERP 管制作交付。计费方式不同，具体方案可咨询销售团队。',
    links: [
      { label: '看看觉策智云', href: '//juece.cloud/', ghost: false },
      { label: '了解觉策ERP', href: '//erp.juece.cloud/', ghost: true },
    ],
  },
  faqs: [
    { q: '是怎么收费的？', a: '按团队协作规模定价，包含若干智能体与协作席位。用得多了或需要扩量时，再按需求调整。' },
    { q: '能对接我们现有的系统吗？', a: '企业版起支持插件与 API，可对接常用业务系统。对接方式按场景确认。' },
    { q: '智能体的记忆和数据安全怎么保证？', a: '记忆数据按空间隔离，传输与存储加密，支持权限与审计。安全细节可查阅服务协议。' },
    { q: '先试哪个场景合适？', a: '建议先挑一个最重复、最占人的活，用智能体跑通一条。跑顺了再扩展到其他环节。' },
  ],
}

export const pricingContent: Record<SiteId, PricingContent> = { juece, erp, yunque }

/** 当前站点价格页内容。 */
export const pricing: PricingContent = pricingContent[siteId]