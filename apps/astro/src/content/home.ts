/**
 * 首页内容源：按站点（SITE_ID）返回首页各区块文案。
 * 结构与 index.astro 的渲染一一对应，模板不变，仅内容随站点切换。
 */

import { siteId, type SiteId } from '../site'

export type IconKey = 'saas' | 'erp' | 'yunque'

export type HomeContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleLines: { text: string; em?: boolean }[]
    desc: string
    primary: { label: string; action: 'lead' | 'href'; href?: string }
    secondary: { label: string; href: string }
    stats: { strong: string; span: string }[]
    diagram: {
      coreName: string
      coreSub: string
      nodes: { no: string; name: string; sub: string; tone: IconKey }[]
      chips: string[]
    }
  }
  products: {
    kicker: string
    heading: string
    desc: string
    spotlight: {
      tag: string
      icon: IconKey
      name: string
      desc: string
      points: string[]
      link: { label: string; href: string; external?: boolean }
    }
    side: {
      tag: string
      icon: IconKey
      name: string
      desc: string
      link: { label: string; href: string; external?: boolean }
    }[]
  }
  solutions: {
    kicker: string
    heading: string
    moreLabel: string
    moreHref: string
    rows: { title: string; audience: string; desc: string; points: string[] }[]
  }
  cases: {
    kicker: string
    heading: string
    feature: { band: string; title: string; desc: string; metrics: { value: string; label: string }[] }
    minis: { band: string; tone?: IconKey; title: string; desc: string; tag: string }[]
  }
  resource: {
    kicker: string
    heading: string
    desc: string
    links: { title: string; sub: string; href: string; external?: boolean }[]
  }
  cta: {
    kicker: string
    heading: string
    desc: string
    rows: {
      icon: IconKey
      head: string
      desc: string
      act: string
      action: 'lead' | 'href'
      href?: string
      external?: boolean
    }[]
  }
  blog: { kicker: string; heading: string; desc: string }
}

/** 主站 · 觉策科技（伞形，三条产品线） */
const juece: HomeContent = {
  meta: {
    title: '觉策科技 · 开店有人帮，接单有人管，AI 有人配',
    description:
      '智云管线上开店，ERP 管制作交付，云雀管 AI 落地。三条产品线，各帮你管住一件正事。',
  },
  hero: {
    kicker: '觉策科技 · 开店 · 接单 · 用 AI',
    titleLines: [
      { text: '开店有人帮，', em: false },
      { text: '接单有人管，AI 有人配', em: true },
    ],
    desc: '智云管线上开店，ERP 管制作交付，云雀管 AI 落地。三条产品线，各帮你管住一件正事。',
    primary: { label: '免费试用', action: 'lead' },
    secondary: { label: '看行业方案', href: '/solutions/' },
    stats: [
      { strong: '开单有数', span: '线上卖货，流水天天看得见' },
      { strong: '交付可查', span: '报价到回款，每一环有记录' },
      { strong: 'AI 用得起', span: '工作台、记忆、权限配齐' },
    ],
    diagram: {
      coreName: '觉策',
      coreSub: '科技',
      nodes: [
        { no: '01', name: '觉策智云', sub: '开店 / 卖货 / 会员', tone: 'saas' },
        { no: '02', name: '觉策ERP V3', sub: '报价 / 排产 / 回款', tone: 'erp' },
        { no: '03', name: '云雀 Yunque', sub: '智能体协作工作台', tone: 'yunque' },
      ],
      chips: ['实体商业数字化', '广告行业管理', '智能体协作'],
    },
  },
  products: {
    kicker: '产品矩阵',
    heading: '你的生意有三件正事',
    desc: '开店要有人帮，交付要有人管，AI 要有人配。三条产品线，正好管住这三件正事。',
    spotlight: {
      tag: '实体商业 SaaS',
      icon: 'saas',
      name: '觉策智云',
      desc: '把店开到顾客手机上：顾客看货、下单、付款，你在线收单，流水自动归总，天天看得见卖了多少。',
      points: [
        '开店：商城+小程序+H5，顾客在线下单',
        '活动：拼团、砍价、秒杀，放上线就能接单',
        '会员：积分、等级、复购，把路人做成熟客',
      ],
      link: { label: '看智云能做什么', href: '/features/' },
    },
    side: [
      {
        tag: '广告行业 ERP',
        icon: 'erp',
        name: '觉策ERP V3',
        desc: '从接单到收钱，管住每一单：报价、生产、回款都在系统里，哪一单到哪一步，翻开就清楚。',
        link: { label: '看 ERP 怎么管', href: '//erp.juece.cloud/', external: true },
      },
      {
        tag: '开放智能体工作系统',
        icon: 'yunque',
        name: '云雀 Yunque',
        desc: '把 AI 用在正事上：工作台、记忆、权限配齐，团队就能把智能体放进实际工作里，而不是留在演示里。',
        link: { label: '看云雀怎么做', href: '//yunque.juece.cloud/', external: true },
      },
    ],
  },
  solutions: {
    kicker: '行业与场景',
    heading: '你的行业，\n有为你写的解法',
    moreLabel: '看全部行业方案',
    moreHref: '/solutions/',
    rows: [
      {
        title: '实体门店数字化',
        audience: '教培 · 体育 · 餐饮 · 到店服务',
        desc: '开店卖货、拉新、留客，一套智云收尾到营业报表，账目清清楚楚。',
        points: ['开店：顾客手机下单，店里线上收单', '拉新：活动上线即抢，有现成玩法', '留客：会员积分复购，回头客记在账上'],
      },
      {
        title: '广告制作行业管理',
        audience: '广告制作公司 · 加工企业',
        desc: '报价、生产、回款落到系统，把靠人盯、靠嘴问这一套换成有据可查的流程。',
        points: ['报价快：素材导入，尺寸价格自动算出', '进度清：排产与外协实时可见', '回款稳：对账、开票、回款逐环留痕'],
      },
      {
        title: '智能体工作与协作',
        audience: '研发团队 · 创新组织',
        desc: 'AI 能不能用上，看工作台、记忆和协作配没配齐。这一层到位，智能体就能正式用。',
        points: ['工作台：对话、画布、文档一个空间', '有记忆：协作不丢上下文', '可管控：权限到位，放给团队用'],
      },
    ],
  },
  cases: {
    kicker: '几单真实用法',
    heading: '看看这几单，\n是怎么跑起来的',
    feature: {
      band: '觉策智云',
      title: '连锁门店，把线上生意和会员做在一起',
      desc: '活动券发出去，老客回来复购，营收增长落到经营报表上，进项一栏清清楚楚。',
      metrics: [
        { value: '+28%', label: '复购率提升（示例）' },
        { value: '3 端', label: 'H5 · 小程序 · 后台' },
      ],
    },
    minis: [
      {
        band: '觉策ERP',
        title: '广告公司全流程协同',
        desc: '从报价到交付，进度、单据都进系统，一句问就有，省了来回打听。',
        tag: '交付效率与回款账期',
      },
      {
        band: '云雀 Yunque',
        tone: 'yunque',
        title: '团队智能体落地',
        desc: '工作台、记忆、治理到位，让智能体从个人演示，走到团队一起用。',
        tag: '平台化与协作效率',
      },
    ],
  },
  resource: {
    kicker: '先看看，不着急',
    heading: '选产品之前，先了解清楚',
    desc: '先按角色挑一条进去看，看清楚了再定。看看行业方案、价格与合作方式、云雀的技术方向。',
    links: [
      { title: '行业方案', sub: '教培、体育、餐饮、广告制作……你在哪个行业？', href: '/solutions/' },
      { title: '价格与合作', sub: 'SaaS 定价透明，ERP 和云雀单议专属方案', href: '/pricing/' },
      { title: '云雀 Yunque', sub: '面向技术团队，了解开放智能体工作系统', href: '//yunque.juece.cloud/', external: true },
    ],
  },
  cta: {
    kicker: '选择你的入口',
    heading: '你是什么角色，就走哪扇门',
    desc: '实体商家、广告公司、技术团队，各有各的入口，自己挑。',
    rows: [
      {
        icon: 'saas',
        head: '我是实体商家',
        desc: '把店开进顾客手机里，顾客下单、付款、复购，账目天天看得见。',
        act: '免费试用觉策智云',
        action: 'lead',
      },
      {
        icon: 'erp',
        head: '我是广告公司',
        desc: '报价、生产、回款进系统，每一环都能交代。',
        act: '预约 ERP 演示',
        action: 'href',
        href: '//erp.juece.cloud/',
        external: true,
      },
      {
        icon: 'yunque',
        head: '我是技术团队',
        desc: '工作台、记忆、权限配齐，智能体就能正式用。',
        act: '了解云雀平台',
        action: 'href',
        href: '//yunque.juece.cloud/',
        external: true,
      },
    ],
  },
  blog: {
    kicker: '文章',
    heading: '产品思路与增长实践',
    desc: '记录做的过程：选型、权衡，以及真实踩过的坑。',
  },
}

/** ERP · 广告行业管理系统 */
const erp: HomeContent = {
  meta: {
    title: '觉策ERP · 广告行业的订单、生产、交付与账款，一个系统跑通',
    description:
      '从报价、下单到生产排期、交付签收与账款结算，全流程可追溯，用报表看经营。',
  },
  hero: {
    kicker: '觉策ERP · 报价 · 排产 · 回款',
    titleLines: [
      { text: '广告生意，', em: false },
      { text: '从报价到回款，一单不漏', em: true },
    ],
    desc: '报价、生产、交付、账款都在一个系统里。哪一单到哪一步，翻开就清楚，不靠人盯、不靠嘴问。',
    primary: { label: '申请试用', action: 'lead' },
    secondary: { label: '看功能模块', href: '/features/' },
    stats: [
      { strong: '报价快', span: '素材导入，尺寸价格自动算出' },
      { strong: '进度清', span: '排产、外协、交付实时可见' },
      { strong: '回款稳', span: '对账、开票、回款逐环留痕' },
    ],
    diagram: {
      coreName: '觉策',
      coreSub: 'ERP',
      nodes: [
        { no: '01', name: '智能报价', sub: '素材导入 / 自动算价', tone: 'erp' },
        { no: '02', name: '生产排期', sub: '排单 / 物料 / 外协', tone: 'erp' },
        { no: '03', name: '账款结算', sub: '对账 / 开票 / 回款', tone: 'erp' },
      ],
      chips: ['报价快', '进度清', '回款稳'],
    },
  },
  products: {
    kicker: '核心模块',
    heading: '把一单生意，盯到收钱为止',
    desc: '从接单到收款，三步都在系统里闭环：报得出价、排得上产、收得回款。',
    spotlight: {
      tag: '核心 · 报价接单',
      icon: 'erp',
      name: '报价与下单',
      desc: '把素材和尺寸丢进系统，价格自动算，出报价单快，下单后直接进排产，不再来回补口头信息。',
      points: [
        '素材导入，尺寸价格自动核算',
        '报价单与订单同源，随改随出',
        '客户、联系人、历史报价一套档案',
      ],
      link: { label: '让报价更快', href: '/features/' },
    },
    side: [
      {
        tag: '核心 · 生产交付',
        icon: 'erp',
        name: '排产与交付',
        desc: '排单、物料、外协都在一张进度表里，哪个订单卡在哪个环节，一看就明。',
        link: { label: '让进度可见', href: '/features/' },
      },
      {
        tag: '核心 · 账款',
        icon: 'erp',
        name: '对账与回款',
        desc: '开票、对账、回款逐环记录，账期和应收一目了然，款收没收到，不用等别人来报。',
        link: { label: '让回款可查', href: '/features/' },
      },
    ],
  },
  solutions: {
    kicker: '行业与场景',
    heading: '你的工艺，\n有对应的流程',
    moreLabel: '看全部行业流程',
    moreHref: '/solutions/',
    rows: [
      {
        title: '喷绘写真',
        audience: '门头制作 · 喷绘公司',
        desc: '规格多、返工多，报价、排产、交付理顺，一张单从头到尾有记录。',
        points: ['报价按面积材质自动算', '排产错开，设备不空转', '交付签收，验收留底'],
      },
      {
        title: '标识标牌',
        audience: '标识制作 · 工程公司',
        desc: '工序长、外协多，把各环节进度收进一张表，卡住能立刻定位。',
        points: ['工序拆解，进度可追踪', '外协进度实时同步', '交付与质保逐单留档'],
      },
      {
        title: '图文快印',
        audience: '快印 · 数码打印门店',
        desc: '单量散、账目杂，把散单归总到系统，日结、月结对得清。',
        points: ['散单快速开单收款', '客欠账逐笔记录', '经营日报天天见'],
      },
    ],
  },
  cases: {
    kicker: '两单真做法的样子',
    heading: '看着这两单，\n账怎么对得平',
    feature: {
      band: '觉策ERP',
      title: '制作公司把外协进度管进了系统',
      desc: '原来外协靠电话追，现在外协一交回、质检一通过，订单进度自动往前推，卡点一眼能定位。',
      metrics: [
        { value: '外协可查', label: '每一环有记录（示例）' },
        { value: '回款留痕', label: '对账开票逐笔可追溯' },
      ],
    },
    minis: [
      {
        band: '报价接单',
        tone: 'erp',
        title: '一张素材，价格自动算',
        desc: '素材导入、尺寸一填，报价单和下单信息同源生成，少补一轮口头核对。',
        tag: '接单与报价效率',
      },
      {
        band: '对账回款',
        tone: 'erp',
        title: '账期摆在那里',
        desc: '应收、账期、回款分栏列出，款收没收到，翻开就能表态。',
        tag: '应收与账期管理',
      },
    ],
  },
  resource: {
    kicker: '先看看，不着急',
    heading: '上系统之前，先想清楚两件事',
    desc: '一是现在的流程哪里最痛，二是上线范围从哪切入。按模块看，选好了再谈。',
    links: [
      { title: '功能模块', sub: '报价、排产、回款，按环节逐块看', href: '/features/' },
      { title: '版本价格', sub: 'ERP 按项目授权并收年度服务费', href: '/pricing/' },
      { title: '行业流程', sub: '喷绘写真、标识标牌、图文快印……你属于哪类？', href: '/solutions/' },
    ],
  },
  cta: {
    kicker: '预约一次演示',
    heading: '把您的流程走一遍看看',
    desc: '我们把已经跑顺的流程，用您家的工序走一遍，看哪一环能省时间。',
    rows: [
      {
        icon: 'erp',
        head: '我要先看报价模块',
        desc: '把现在的素材和报价方式发我们，先看自动算价怎么落。',
        act: '预约报价演示',
        action: 'lead',
      },
      {
        icon: 'erp',
        head: '我要看生产交付',
        desc: '排产、外协、进度怎么收进一张表，给您走一遍。',
        act: '看排产与交付',
        action: 'href',
        href: '/features/',
      },
      {
        icon: 'erp',
        head: '我要看账款',
        desc: '对账、开票、回款怎么留痕，账期怎么看。',
        act: '看账款管理',
        action: 'href',
        href: '/features/',
      },
    ],
  },
  blog: {
    kicker: '文章',
    heading: '广告行业的做法与账务',
    desc: '记录上系统前后，报价、生产、回款这些环节的真实变化。',
  },
}

/** 云雀 Yunque · 智能体工作系统 */
const yunque: HomeContent = {
  meta: {
    title: '云雀 Yunque · 把重复执行交给智能体，关键环节由人决策',
    description:
      '文档、任务、审批与知识库统一在一个空间里，智能体接管重复执行，人专注需要判断的环节。',
  },
  hero: {
    kicker: '云雀 Yunque · 智能体 · 记忆 · 协作',
    titleLines: [
      { text: '智能体能用了，', em: false },
      { text: '不在演示里，在工作里', em: true },
    ],
    desc: '工作台、记忆、协作与治理配齐，团队把智能体放进真实工作里，而不是停在个人演示。',
    primary: { label: '免费体验', action: 'lead' },
    secondary: { label: '看智能体能力', href: '/features/' },
    stats: [
      { strong: '工作台', span: '对话、画布、文档一个空间' },
      { strong: '有记忆', span: '协作不丢上下文' },
      { strong: '可管控', span: '权限到位，放给团队用' },
    ],
    diagram: {
      coreName: '云雀',
      coreSub: 'Yunque',
      nodes: [
        { no: '01', name: '工作台', sub: '对话 / 画布 / 文档', tone: 'yunque' },
        { no: '02', name: '记忆', sub: '项目 / 知识 / 上下文', tone: 'yunque' },
        { no: '03', name: '协作治理', sub: '任务 / 审批 / 权限', tone: 'yunque' },
      ],
      chips: ['工作台', '有记忆', '可管控'],
    },
  },
  products: {
    kicker: '核心能力',
    heading: '让智能体真正干上活',
    desc: '智能体用不用得起来，看三件事配齐没有：工作台、记忆、协作治理。',
    spotlight: {
      tag: '核心 · 工作台',
      icon: 'yunque',
      name: '工作台',
      desc: '对话、画布、文档放进同一个空间，人和智能体在同一处接活，不必在多个工具里来回跳。',
      points: [
        '对话窗口，直接给智能体派活',
        '画布成果，随时就地改',
        '文档与对话同屏，上下文不散',
      ],
      link: { label: '看工作台能做什么', href: '/features/' },
    },
    side: [
      {
        tag: '核心 · 记忆',
        icon: 'yunque',
        name: '记忆与知识库',
        desc: '项目背景、过往决策、团队文档收进记忆，智能体接手时不用每次重新交代。',
        link: { label: '看记忆怎么用', href: '/features/' },
      },
      {
        tag: '核心 · 协作治理',
        icon: 'yunque',
        name: '任务与审批',
        desc: '任务下发、流转、审批落到系统，谁负责、卡哪了，有记录也能放给团队放心用。',
        link: { label: '看协作治理', href: '/features/' },
      },
    ],
  },
  solutions: {
    kicker: '适用场景',
    heading: '这些活，\n先交给智能体试试',
    moreLabel: '看全部场景',
    moreHref: '/solutions/',
    rows: [
      {
        title: '项目执行',
        audience: '交付型团队',
        desc: '例会、跟进、文档统稿这类重复活，交给智能体先跑，人盯关键判断。',
        points: ['例会纪要与待办自动落', '进度跟进有提醒', '交付文档就地成稿'],
      },
      {
        title: '流程自动化',
        audience: '流程多的部门',
        desc: '把重复审批、汇总、转发的环节做成智能体，人只处理异常和例外。',
        points: ['标准动作交给智能体', '异常拉到人处理', '每一步有记录可追溯'],
      },
      {
        title: '知识管理',
        audience: '内容与知识密集团队',
        desc: '文档、规范、沉淀收进知识库，找得到、用得上，新人上手也快。',
        points: ['知识搜得到', '答案有出处', '沉淀自动归位'],
      },
    ],
  },
  cases: {
    kicker: '两种用法的样子',
    heading: '看看这两处，\n是怎么用起来的',
    feature: {
      band: '云雀 Yunque',
      title: '项目组让智能体接住了例会后的杂活',
      desc: '纪要、待办、文档统稿交给智能体，会开完东西就在，团队把省下的时间放到跟进和交付上。',
      metrics: [
        { value: '会议即纪要', label: '结尾即成稿（示例）' },
        { value: '待办落地', label: '事到人、有截止' },
      ],
    },
    minis: [
      {
        band: '流程自动化',
        tone: 'yunque',
        title: '审批流转不卡纸',
        desc: '标准动作交给智能体，异常才拉到人，流程不等人。',
        tag: '流程效率与留痕',
      },
      {
        band: '知识管理',
        tone: 'yunque',
        title: '答案有出处',
        desc: '知识进库、答案标来源，新人问得到也找得到。',
        tag: '沉淀与可追溯',
      },
    ],
  },
  resource: {
    kicker: '先看看，不着急',
    heading: '用之前，先想清楚一件事',
    desc: '哪个活最重复、最占人，就从那里切进去。按能力看，认准了再试。',
    links: [
      { title: '智能体能力', sub: '工作台、记忆、协作，按能力逐块看', href: '/features/' },
      { title: '价格方案', sub: '云雀按团队规模定价，试用期先跑起来', href: '/pricing/' },
      { title: '适用场景', sub: '项目、流程、知识，看看哪类先落', href: '/solutions/' },
    ],
  },
  cta: {
    kicker: '约一次体验',
    heading: '挑一个活，先跑起来',
    desc: '选一个最占人的重复活，我们用智能体先给您走通，再谈正式用。',
    rows: [
      {
        icon: 'yunque',
        head: '我想试试工作台',
        desc: '对话、画布、文档一个空间，先自己点一遍。',
        act: '免费体验工作台',
        action: 'lead',
      },
      {
        icon: 'yunque',
        head: '我想看记忆',
        desc: '上下文和知识怎么收怎么用，给您走一遍。',
        act: '看记忆与知识库',
        action: 'href',
        href: '/features/',
      },
      {
        icon: 'yunque',
        head: '我想看协作治理',
        desc: '任务、审批、权限怎么放给团队用。',
        act: '看协作与治理',
        action: 'href',
        href: '/features/',
      },
    ],
  },
  blog: {
    kicker: '文章',
    heading: '智能体落地的做法与坑',
    desc: '记录怎么把演示里的智能体，变成一个团队真正在用的工作。',
  },
}

export const homeContent: Record<SiteId, HomeContent> = { juece, erp, yunque }

/** 当前站点首页内容。 */
export const home: HomeContent = homeContent[siteId]