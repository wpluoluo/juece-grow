/**
 * 功能页内容源：按站点（SITE_ID）返回功能全景页各版块文案。
 * 能力版块结构一致，由 kind 区分数据面板形态，内容随站点切换。
 */

import { siteId, type SiteId } from '../site'

/** 数据面板样式：决定页面渲染哪一种数据组件。 */
export type FeaturePanel =
  | { kind: 'blocks'; badge: string; title: string; blocks: { no: string; name: string; note: string; w: string }[] }
  | { kind: 'chips'; badge: string; title: string; chips: string[]; rows: { label: string; w: number; val: string }[] }
  | { kind: 'bars'; badge: string; title: string; kpis: { val: string; label: string }[]; bars: number[]; months: string[] }
  | { kind: 'journey'; badge: string; title: string; steps: string[] }
  | { kind: 'agent'; badge: string; title: string; core: string; pegs: { pos: 'p1' | 'p2' | 'p3' | 'p4'; icon: 'task' | 'memory' | 'gov' | 'ext'; text: string }[] }

export type FeatureCap = {
  no: string
  tag: string
  /** yb → 云雀暖金配色标签。 */
  tagTone?: 'yb'
  title: string
  reverse?: boolean
  aside: { p: string; points: string[] }
  panel: FeaturePanel
}

export type FeaturesContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleA: string
    titleEm: string
    description: string
    stats: { value: string; label: string }[]
  }
  caps: FeatureCap[]
  base: { kicker: string; heading: string; items: { title: string; desc: string }[] }
  cta: { kicker: string; heading: string; desc: string; btnText: string }
}

/** 主站 · 觉策科技（三条产品线全景） */
const juece: FeaturesContent = {
  meta: {
    title: '功能全景 · 觉策科技',
    description:
      '智云盯线上卖货，ERP 盯制作交付，云雀盯 AI 落地，每一项只对着一类经营结果做深。',
  },
  hero: {
    kicker: '功能全景',
    titleA: '每项能力，',
    titleEm: '都对应一个落地结果',
    description: '智云盯线上卖货，ERP 盯制作交付，云雀盯 AI 落地。每一项都只对着一类经营结果做深。',
    stats: [
      { value: '05', label: '个能力条目' },
      { value: '03', label: '条产品线' },
    ],
  },
  caps: [
    {
      no: '01',
      tag: '觉策智云 · 不用写代码',
      title: '商城自己搭，按自己的节奏上线',
      aside: {
        p: 'Banner、商品位、营销位都是现成版块，运营拖拽拼好，一个能卖货的商城就能上线。',
        points: [
          'H5 和小程序，一次搭建两端同步',
          '每个版块样式可单独调',
          '数据面板告诉你哪一页转得好',
        ],
      },
      panel: {
        kind: 'blocks',
        badge: '3 端同步',
        title: '一个商城的组成',
        blocks: [
          { no: '01', name: '首页 Banner', note: '换图、设跳转、挂活动', w: '72%' },
          { no: '02', name: '商品橱窗', note: '价格、库存、排序', w: '86%' },
          { no: '03', name: '营销活动位', note: '拼团、秒杀、优惠券', w: '64%' },
          { no: '04', name: '会员与积分', note: '等级、返利、兑换', w: '58%' },
        ],
      },
    },
    {
      no: '02',
      tag: '觉策智云 · 把货卖出去',
      title: '商城加营销，一套把成交跑通',
      reverse: true,
      aside: {
        p: '实物、课程、权益都能上架；拼团、砍价、秒杀、分销按需开，成交节奏自己定。',
        points: [
          '运费规则按需设，物流状态可跟踪',
          '分销佣金自动结算，老客帮忙卖',
          '优惠券发放到核销，全程可见',
        ],
      },
      panel: {
        kind: 'chips',
        badge: '按需开启',
        title: '私域里常用的几种玩法',
        chips: ['拼团', '砍价', '秒杀', '分销', '优惠券', '积分兑换'],
        rows: [
          { label: '拉新', w: 84, val: '拼团为主' },
          { label: '复购', w: 66, val: '优惠券' },
          { label: '裂变', w: 52, val: '分销带佣' },
        ],
      },
    },
    {
      no: '03',
      tag: '觉策智云 · 把人留下来',
      title: '会员与数据，把一次成交做成回头客',
      aside: {
        p: '不同渠道来的客人都收敛到一个身份、一份画像。积分、等级、付费会员，把一次成交沉淀为长期关系。',
        points: [
          '用 RFM 做分客，该发的券自动发',
          '积分商城可异业兑换',
          '经营仪表盘，数据每天摊开看',
        ],
      },
      panel: {
        kind: 'bars',
        badge: '近 6 个月',
        title: '会员增长趋势',
        kpis: [
          { val: '+28%', label: '复购率' },
          { val: '1.6w', label: '在册会员' },
        ],
        bars: [34, 48, 42, 62, 55, 72],
        months: ['1月', '2月', '3月', '4月', '5月', '6月'],
      },
    },
    {
      no: '04',
      tag: '觉策ERP · 从报价到回款',
      title: '报价到回款，每个环节都有记录',
      reverse: true,
      aside: {
        p: '报价有准数、生产有进度、回款有凭证。从接到单到收到钱，每一环都摊在系统里，可交代、可追溯。',
        points: [
          '素材导入，尺寸价位自动算好',
          '生产看板配外协跟踪，进度实时更新',
          '数电发票、税负分析，客户可自查进度',
        ],
      },
      panel: {
        kind: 'journey',
        badge: '全程留痕',
        title: '一笔订单的旅程',
        steps: ['智能报价', '开工生产', '物料与排期', '外协与交付', '开票与计税', '对账回款'],
      },
    },
    {
      no: '05',
      tag: '云雀 Yunque · 让智能体落地',
      tagTone: 'yb',
      title: '让智能体从「演示能跑」到「上线能用」',
      aside: {
        p: '一个工作台，配上记忆与治理，把 AI 项目从"能跑"推进到"能用、好管、能扩"。',
        points: [
          '一个空间管对话、画布和文档',
          '治理加 RBAC，团队协作规整可控',
          '插件化架构，对接外部系统',
        ],
      },
      panel: {
        kind: 'agent',
        badge: '工作台',
        title: '一个智能体的组成',
        core: 'Yunque',
        pegs: [
          { pos: 'p1', icon: 'task', text: '任务' },
          { pos: 'p2', icon: 'memory', text: '记忆' },
          { pos: 'p3', icon: 'gov', text: '治理' },
          { pos: 'p4', icon: 'ext', text: '扩展' },
        ],
      },
    },
  ],
  base: {
    kicker: '基础能力',
    heading: '三条产品线共用的一套基础能力',
    items: [
      { title: '多租户架构', desc: '各家数据隔离，安全可靠' },
      { title: '权限管理', desc: 'RBAC 模型，细到按钮级' },
      { title: '开放 API', desc: '标准接口，想接什么接什么' },
      { title: '自动备份', desc: '每日自动备份，随时可回滚' },
      { title: '多端适配', desc: 'PC / H5 / 小程序 / App 覆盖' },
      { title: '在线客服', desc: '主流客服系统可集成' },
      { title: '消息通知', desc: '短信 / 邮件 / 微信都能发' },
      { title: '扩展脚本', desc: '支持自定义脚本逻辑' },
    ],
  },
  cta: {
    kicker: '要不要看看能不能跑起来',
    heading: '挑一条能力，体验一下',
    desc: '从商城、ERP 到智能体，都可以约时间看演示，按你的业务实际走一遍。',
    btnText: '约个演示',
  },
}

/** ERP 站 · 广告行业管理 */
const erp: FeaturesContent = {
  meta: {
    title: '功能模块 · 觉策ERP',
    description:
      '报价、排产、外协、交付、对账、回款，按广告制作的环节逐块落地，全程可追溯。',
  },
  hero: {
    kicker: '功能模块',
    titleA: '按广告制作的环节，',
    titleEm: '一个模块对一个痛点',
    description: '报价、生产、交付、账款拆成对应模块，从接单到收款，每一块都落在系统里。',
    stats: [
      { value: '06', label: '个核心模块' },
      { value: '1', label: '条流程跑通' },
    ],
  },
  caps: [
    {
      no: '01',
      tag: '报价接单 · 自动算价',
      title: '素材丢进去，价格自己算好',
      aside: {
        p: '把素材、尺寸、材质填进系统，报价自动算，出单快、口径统一，不再靠人凭经验估。',
        points: [
          '素材导入，按面积材质自动核算',
          '报价单与订单同源，随改随出',
          '客户、联系人、历史报价一套档案',
        ],
      },
      panel: {
        kind: 'blocks',
        badge: '报价即订单',
        title: '一张订单的由来',
        blocks: [
          { no: '01', name: '素材上传', note: '图片、文件、尺寸', w: '88%' },
          { no: '02', name: '自动估价', note: '面积、材质、工艺', w: '76%' },
          { no: '03', name: '报价单', note: '客户确认即下单', w: '64%' },
          { no: '04', name: '客户档案', note: '联系人与历史报价', w: '52%' },
        ],
      },
    },
    {
      no: '02',
      tag: '生产排期 · 看板可视',
      title: '排单、物料、设备，一张表看全',
      reverse: true,
      aside: {
        p: '订单排期收进看板，设备、物料、人力抬头可见，订单卡在哪一环，一眼定位。',
        points: [
          '排产计划按设备与交期自动排',
          '物料到料与库存联动提醒',
          '延期风险提前提示，不等人来问',
        ],
      },
      panel: {
        kind: 'chips',
        badge: '实时更新',
        title: '排产看板常用的几类信息',
        chips: ['订单排期', '设备负荷', '物料到料', '外协进度', '交期预警'],
        rows: [
          { label: '排期', w: 90, val: '按交期生成' },
          { label: '外协', w: 58, val: '进度同步' },
          { label: '预警', w: 40, val: '风险提示' },
        ],
      },
    },
    {
      no: '03',
      tag: '外协交付 · 全程跟踪',
      title: '外协一交回、一通过，进度自动往前走',
      aside: {
        p: '外包给第三方的环节，交回、质检、通过各留一步，订单进度跟着状态自动推进。',
        points: [
          '外协工序与进度实时记录',
          '质检通过才进入下一环节',
          '交付签收，验收留底',
        ],
      },
      panel: {
        kind: 'journey',
        badge: '逐环留痕',
        title: '一个订单走到交付',
        steps: ['接单', '排产', '外协', '质检', '交付', '签收'],
      },
    },
    {
      no: '04',
      tag: '对账回款 · 账期可见',
      title: '开票、对账、回款，逐笔都有记录',
      reverse: true,
      aside: {
        p: '应收、账期、回款分栏列出，款收没收到、账期到没到，翻开就能表态。',
        points: [
          '数电发票，开票信息自动带出',
          '应收账期与回款逐笔记录',
          '税负统计，按周期自动汇总',
        ],
      },
      panel: {
        kind: 'bars',
        badge: '近 6 个月',
        title: '回款与应收走势',
        kpis: [
          { val: '97%', label: '按期回款（示例）' },
          { val: '15d', label: '平均账期' },
        ],
        bars: [58, 62, 55, 70, 66, 78],
        months: ['1月', '2月', '3月', '4月', '5月', '6月'],
      },
    },
    {
      no: '05',
      tag: '客户门户 · 自助查递',
      title: '客户自己下单、自己看进度',
      tagTone: 'yb',
      aside: {
        p: '给客户开一个门户，自助下单、查进度、看账单，少占用你的报价和跟单人力。',
        points: [
          '客户自助提交需求与素材',
          '进度与交付状态随时查',
          '账单与历史订单一处可看',
        ],
      },
      panel: {
        kind: 'agent',
        badge: '客户门户',
        title: '一个门户装着的内容',
        core: '门户',
        pegs: [
          { pos: 'p1', icon: 'task', text: '下单' },
          { pos: 'p2', icon: 'memory', text: '档案' },
          { pos: 'p3', icon: 'gov', text: '账单' },
          { pos: 'p4', icon: 'ext', text: '进度' },
        ],
      },
    },
  ],
  base: {
    kicker: '基础能力',
    heading: '广告制作管理共用的一套基础能力',
    items: [
      { title: '多部门隔离', desc: '销售、生产、财务分权可见' },
      { title: '权限管理', desc: 'RBAC 模型，细到单据级' },
      { title: '开放 API', desc: '对接外协、物流与财务系统' },
      { title: '自动备份', desc: '每日自动备份，随时可回滚' },
      { title: '移动协同', desc: '生产现场手机录进度、传照片' },
      { title: '消息提醒', desc: '短信 / 微信通知客户与内部' },
      { title: '报表导出', desc: '经营报表一键导出下发' },
      { title: '扩展字段', desc: '工艺、材质等按需自定义' },
    ],
  },
  cta: {
    kicker: '拿一套流程走一遍',
    heading: '用您的工艺，看哪一环省时间',
    desc: '把已经跑顺、也踩过坑的流程，用您家的工序走一遍，看报价到回款能省多少工夫。',
    btnText: '约一次演示',
  },
}

/** 云雀站 · 智能体工作系统 */
const yunque: FeaturesContent = {
  meta: {
    title: '智能体能力 · 云雀 Yunque',
    description:
      '工作台、记忆、任务审批、治理管控、插件扩展，把智能体从演示推进到正式工作。',
  },
  hero: {
    kicker: '智能体能力',
    titleA: '每项能力，',
    titleEm: '都在把智能体变好用',
    description: '工作台、记忆、协作、治理、扩展逐块配齐，智能体才能从演示走到团队一起用。',
    stats: [
      { value: '05', label: '个能力模块' },
      { value: '1', label: '套协作体系' },
    ],
  },
  caps: [
    {
      no: '01',
      tag: '工作台 · 一个空间接活',
      title: '对话、画布、文档，放进同一个空间',
      aside: {
        p: '人和智能体在同一处接活，不必在多个工具间来回跳，上下文也不散。',
        points: [
          '对话窗口，直接给智能体派活',
          '画布成果，随时就地改',
          '文档与对话同屏，上下文不丢',
        ],
      },
      panel: {
        kind: 'blocks',
        badge: '3 种载体同屏',
        title: '一个工作台装着什么',
        blocks: [
          { no: '01', name: '对话', note: '派活、问答、扩展', w: '84%' },
          { no: '02', name: '画布', note: '流程、脑图、预览', w: '72%' },
          { no: '03', name: '文档', note: '成稿、沉淀、归档', w: '66%' },
          { no: '04', name: '任务', note: '下发、流转、跟进', w: '58%' },
        ],
      },
    },
    {
      no: '02',
      tag: '记忆 · 上下文不丢',
      title: '项目背景、决策、文档，收进记忆',
      reverse: true,
      aside: {
        p: '项目背景、过往决策、团队文档收进记忆，智能体接手时不用每次重新交代。',
        points: [
          '项目级记忆，跨对话延续',
          '知识文档入库，答案有出处',
          '上下文自动归位，不靠人补',
        ],
      },
      panel: {
        kind: 'chips',
        badge: '自动沉淀',
        title: '记忆里常用的几类内容',
        chips: ['项目背景', '决策记录', '知识文档', '团队规范', '过往结论'],
        rows: [
          { label: '读取', w: 88, val: '随取随用' },
          { label: '沉淀', w: 62, val: '自动归位' },
          { label: '出处', w: 74, val: '可溯可查' },
        ],
      },
    },
    {
      no: '03',
      tag: '任务与审批 · 流转留痕',
      title: '任务下发、流转、审批，落到系统',
      aside: {
        p: '谁负责、卡在哪、批没批，都有记录。协作规整，团队才敢放开用。',
        points: [
          '任务到人、到智能体，可派发可拆解',
          '标准动作交给智能体，异常拉到人',
          '审批留痕，每一步可追溯',
        ],
      },
      panel: {
        kind: 'journey',
        badge: '全程留痕',
        title: '一个任务走完的路径',
        steps: ['发起', '分派', '执行', '复核', '审批', '归档'],
      },
    },
    {
      no: '04',
      tag: '治理管控 · 权限到位',
      title: 'RBAC 权限与审计，放给团队放心用',
      reverse: true,
      aside: {
        p: '权限细到角色、职能与数据范围，操作有审计日志，智能体用得越深越要有边界。',
        points: [
          '细粒度权限，谁可见谁可改',
          '智能体可读范围受控',
          '操作审计记录，问题可追溯',
        ],
      },
      panel: {
        kind: 'bars',
        badge: '权限模型',
        title: '治理覆盖的几类边界',
        kpis: [
          { val: 'RBAC', label: '角色权限' },
          { val: '100%', label: '操作留痕' },
        ],
        bars: [48, 60, 78, 82, 90, 95],
        months: ['角色', '数据', '资源', '外发', '审批', '审计'],
      },
    },
    {
      no: '05',
      tag: '插件扩展 · 对接外部',
      title: '插件化架构，能接进现有系统',
      tagTone: 'yb',
      aside: {
        p: '通过插件与企业现有系统对接，把智能体接进真实业务，而不是留在演示环境里。',
        points: [
          '插件市场，能力即插即用',
          '开放接口，对接内部系统',
          '自定义逻辑，扩展不受限',
        ],
      },
      panel: {
        kind: 'agent',
        badge: '开放平台',
        title: '一个智能体的组成',
        core: 'Yunque',
        pegs: [
          { pos: 'p1', icon: 'task', text: '任务' },
          { pos: 'p2', icon: 'memory', text: '记忆' },
          { pos: 'p3', icon: 'gov', text: '治理' },
          { pos: 'p4', icon: 'ext', text: '扩展' },
        ],
      },
    },
  ],
  base: {
    kicker: '基础能力',
    heading: '智能体平台共用的一套基础能力',
    items: [
      { title: '多团队隔离', desc: '不同团队数据与知识互不可见' },
      { title: '细颗粒权限', desc: '角色、职能、数据范围分级' },
      { title: '开放 API', desc: '标准接口，便于系统对接' },
      { title: '自动备份', desc: '数据与知识每日备份可回滚' },
      { title: '多端访问', desc: 'Web / 桌面 / 移动端覆盖' },
      { title: '消息通知', desc: '群聊 / 邮件 / 站内都能发' },
      { title: '审计日志', desc: '关键操作全程留痕可追溯' },
      { title: '插件扩展', desc: '能力即插即用，自定义无上限' },
    ],
  },
  cta: {
    kicker: '挑一个重复活，先跑一遍',
    heading: '用一个真实活，看智能体用不用得上',
    desc: '选一个最占人的重复活，我们用智能体先给您走通，再谈正式用。',
    btnText: '约一次体验',
  },
}

export const featuresContent: Record<SiteId, FeaturesContent> = { juece, erp, yunque }

/** 当前站点功能页内容。 */
export const features: FeaturesContent = featuresContent[siteId]