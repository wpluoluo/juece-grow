/**
 * 行业方案页内容源：按站点（SITE_ID）返回行业索引手风琴的全部内容。
 * 主站=全民行业的伞形方案；ERP 站=广告细分行业流程；云雀站=场景式用法。
 */

import { siteId, type SiteId } from '../site'
import type { IconKey } from './home'

export type SolutionIndustry = {
  label: string
  meta: string
  blurb: string
  tone: IconKey
  painPoints: string[]
  solutions: string[]
  scenarios: { title: string; desc: string }[]
}

export type SolutionsContent = {
  meta: { title: string; description: string }
  hero: {
    kicker: string
    titleA: string
    titleEm: string
    description: string
    stats: { value: string; label: string }[]
  }
  industries: SolutionIndustry[]
  cta: { kicker: string; heading: string; desc: string; btnText: string }
}

/** 主站 · 觉策科技（伞形行业方案） */
const juece: SolutionsContent = {
  meta: {
    title: '行业方案 · 觉策科技',
    description: '按行业整理了觉策智云与觉策 ERP 的现成方案，痛点逐条对应到落地结果。',
  },
  hero: {
    kicker: '行业方案',
    titleA: '不同行业，',
    titleEm: '落地结果各不相同',
    description: '按行业整理了觉策智云与觉策 ERP 的现成方案。挑一个贴近业务的，看每一项对应哪个痛点、落到什么结果。',
    stats: [
      { value: '06', label: '个行业' },
      { value: '03', label: '条产品线' },
      { value: '痛点 → 方案', label: '逐条对应' },
    ],
  },
  industries: [
    {
      label: '教育培训',
      meta: '觉策智云',
      blurb: '招生、排课、家校沟通占用大量日常人力。',
      tone: 'saas',
      painPoints: [
        '招生依赖传单和熟客介绍，效果难预估',
        '排课消课靠表格，师生的时间常有冲突',
        '家长难以了解孩子近期的学习进展',
        '学员结课后缺少继续学习的理由',
      ],
      solutions: [
        '体验课、拼团等活动辅助招生，来源更可控',
        '智能排课自动提示冲突，家长在微信收到消课通知',
        '成长档案与作业打卡，家长能持续看到进展',
        '积分与会员权益，为续费提供依据',
      ],
      scenarios: [
        { title: '招生引流', desc: '体验课、拼团等活动' },
        { title: '智能排课', desc: '自动检测冲突' },
        { title: '家校互通', desc: '作业、评价、通知' },
        { title: '经营报表', desc: '财务与课消汇总' },
      ],
    },
    {
      label: '体育场馆',
      meta: '觉策智云',
      blurb: '场地空闲意味着收入流失，让运营更可控。',
      tone: 'saas',
      painPoints: [
        '电话预订容易撞单，沟通成本较高',
        '会员卡靠纸质记录，核销效率偏低',
        '淡旺季客流差异明显，闲时资源闲置',
        '对账繁琐，占用大量时间',
      ],
      solutions: [
        '在线预订小程序，场地状态可视化，锁定时段避免撞单',
        '电子会员卡，扫码核销，入场更顺畅',
        '闲时优惠与赛事活动，提升闲时的场地利用率',
        '流水自动归集，经营日报按固定时间生成',
      ],
      scenarios: [
        { title: '场地预订', desc: '在线选场锁场' },
        { title: '次卡/年卡', desc: '灵活售卖与核销' },
        { title: '赛事运营', desc: '报名、签到、成绩' },
        { title: '商品售卖', desc: '饮料装备线上购买' },
      ],
    },
    {
      label: '餐饮美食',
      meta: '觉策智云',
      blurb: '平台抽成较高时，自营渠道是补充。',
      tone: 'saas',
      painPoints: [
        '平台抽成较高，挤压门店利润',
        '高峰时段排队，部分客人等待后离开',
        '客人消费后难以建立持续的联系',
        '对折扣依赖明显，常以让利换客流',
      ],
      solutions: [
        '自营外卖与扫码点餐，订单直连门店收单',
        '多人预点单，加快高峰时段的翻台',
        '支付后引导成为会员，把客群留进自己的会员系统',
        '活动玩法多样，折扣与套餐搭配让利',
      ],
      scenarios: [
        { title: '扫码点餐', desc: '堂食、自提、外卖' },
        { title: '营销发券', desc: '满减、折扣、套餐' },
        { title: '会员储值', desc: '会员资金与管理' },
        { title: '菜品分析', desc: '分析菜品销售情况' },
      ],
    },
    {
      label: '到店服务',
      meta: '觉策智云',
      blurb: '预约制门店，重点在让老客户持续到店。',
      tone: 'saas',
      painPoints: [
        '技师排班靠口头协调，客人常需等待',
        '服务质量依赖个人经验，水平波动较大',
        '储值后缺少唤醒，下次到店时间难掌握',
        '老客维护靠私下联系，容易遗漏',
      ],
      solutions: [
        '在线预约，技师与工位可视化，客人自选时段',
        '服务项目标准化，消费后支持评价',
        '会员画像与标签，按需推送合适的优惠',
        '生日与复购提醒，用自动化维护老客',
      ],
      scenarios: [
        { title: '在线预约', desc: '选技师、选时间' },
        { title: '预付卡', desc: '计次、储值灵活' },
        { title: '评价管理', desc: '服务质量可追踪' },
        { title: '员工提成', desc: '业绩自动统计' },
      ],
    },
    {
      label: '广告制作',
      meta: '觉策ERP V3',
      blurb: '还在用表格报价、口头跟进生产，可以换一种方式。',
      tone: 'erp',
      painPoints: [
        '报价依赖人工经验，容易出错或延误',
        '生产进度靠追问，外协环节难以同步',
        '开票与回款多头对接，财务工作量较大',
        '客户多通过电话询问进度，占用人力',
      ],
      solutions: [
        '导入素材自动识别尺寸并估价，报价更稳定',
        '生产看板与外协跟踪，进度逐工序可见',
        '数电发票与税负统计，减轻对账负担',
        '客户门户支持自助下单与查进度',
      ],
      scenarios: [
        { title: '智能报价', desc: '素材导入即可估价' },
        { title: '生产看板', desc: '排产、外协全程可视' },
        { title: '财务税务', desc: '发票与税负管理' },
        { title: '客户门户', desc: '自助下单与查进度' },
      ],
    },
    {
      label: '智能体协作',
      meta: '云雀 Yunque',
      blurb: 'AI 项目落地时，问题往往不在模型本身。',
      tone: 'yunque',
      painPoints: [
        '演示效果可行，上线后缺少运行管理手段',
        '多个智能体各自工作，缺少协作与共享记忆',
        '缺少权限管控，难以对团队放开使用',
        '对接现有系统时，扩展能力不足',
      ],
      solutions: [
        '一个工作台统一 Chat、画布与文档',
        '记忆与任务编排，保持协作连贯',
        '治理控制台与权限管理，满足企业使用要求',
        '插件化架构，便于对接外部系统',
      ],
      scenarios: [
        { title: '统一工作台', desc: 'Chat、画布、文档' },
        { title: '任务编排', desc: '多智能体协同' },
        { title: '治理管控', desc: '权限与管理' },
        { title: '插件扩展', desc: '对接外部系统' },
      ],
    },
  ],
  cta: {
    kicker: '没有贴近你的场景？',
    heading: '可以直接聊聊你的业务',
    desc: '告诉我们你做什么生意、卡在哪一环，我们对需求给一套推荐，直接照着谈。',
    btnText: '联系我们',
  },
}

/** ERP 站 · 广告细分行业流程 */
const erp: SolutionsContent = {
  meta: {
    title: '行业流程 · 觉策ERP',
    description:
      '喷绘写真、标识标牌、图文快印、招牌灯箱等广告制作细分行业，报价到回款逐环节落地。',
  },
  hero: {
    kicker: '行业流程',
    titleA: '工艺不同，',
    titleEm: '流程对齐的方式不同',
    description: '按广告制作的工艺类型整理了 ERP 流程。挑一个贴近你的，看从报价到回款能对齐到哪一步。',
    stats: [
      { value: '06', label: '个工艺流程' },
      { value: '1', label: '条业务主线' },
      { value: '报价 → 回款', label: '逐环对齐' },
    ],
  },
  industries: [
    {
      label: '喷绘写真',
      meta: '觉策ERP · 工艺流程',
      blurb: '规格多、返工多的品种，最看重出错率。',
      tone: 'erp',
      painPoints: [
        '面积、材质规格多，报价口径不一',
        '订单量大而散，排产靠人工催',
        '交付后返工，验收缺少留底',
        '回款周期长，账越对越乱',
      ],
      solutions: [
        '按面积与材质自动算价，报价口径统一',
        '排产按设备与交期排，抬头可见不空转',
        '交付签收、验收留底，返工有据可查',
        '应收账期分栏列出，回款逐笔记录',
      ],
      scenarios: [
        { title: '智能报价', desc: '按面积材质自动算' },
        { title: '设备排产', desc: '错峰、交期可视' },
        { title: '交付签收', desc: '验收留底' },
        { title: '应收账期', desc: '逐笔可追溯' },
      ],
    },
    {
      label: '标识标牌',
      meta: '觉策ERP · 工艺流程',
      blurb: '工序长、外协多的工程类制作。',
      tone: 'erp',
      painPoints: [
        '工序链条长，进度依赖电话追问',
        '外协环节多，交付质量难同步',
        '货款分阶段，回款节点记不清',
        '质保期内问题，责任难追溯',
      ],
      solutions: [
        '工序拆解到投产单，进度每步可追踪',
        '外协交回+质检通过，进度自动推进',
        '分阶段收款，节点与单据自动关联',
        '交付与质保逐单留档，责任有据',
      ],
      scenarios: [
        { title: '工序拆解', desc: '投产单逐工序' },
        { title: '外协同步', desc: '交回即前进' },
        { title: '分期货款', desc: '节点自动关联' },
        { title: '质保留档', desc: '逐单可追溯' },
      ],
    },
    {
      label: '图文快印',
      meta: '觉策ERP · 工艺流程',
      blurb: '单量散、账目杂，最怕对不清。',
      tone: 'erp',
      painPoints: [
        '散单多，开单慢、容易漏记',
        '客欠账靠本子记，催收凭记忆',
        '物料进出不透明，成本算不清',
        '日结月结耗时，报表全靠手工',
      ],
      solutions: [
        '散单快速开单收款，少填一张是一张',
        '客欠账逐笔记录，账单一键发客户',
        '物料进出库联动，成本自动归集',
        '经营日报月报，按固定时间生成',
      ],
      scenarios: [
        { title: '快速开单', desc: '散单即开即收' },
        { title: '客欠管理', desc: '逐笔记录、一键催收' },
        { title: '物料库存', desc: '进出联动' },
        { title: '经营报表', desc: '日报月报自动出' },
      ],
    },
    {
      label: '招牌灯箱',
      meta: '觉策ERP · 工艺流程',
      blurb: '定制属性强，报价与项目制并存。',
      tone: 'erp',
      painPoints: [
        '定制报价依赖人工经验，售后常超支',
        '一单多工序，进度难统筹',
        '安装交付环节，现场改单多',
        '项目核算难，利润算不明白',
      ],
      solutions: [
        '报价模板沉淀工艺价格，报价有据',
        '一单投产多工序，看板统一统筹',
        '安装交付留痕，现场改单一处记录',
        '按订单核算成本与毛利，利润可算',
      ],
      scenarios: [
        { title: '报价模板', desc: '工艺价格沉淀' },
        { title: '多工序统筹', desc: '一单看板调度' },
        { title: '安装留痕', desc: '现场改单记录' },
        { title: '利润核算', desc: '按单算毛利' },
      ],
    },
    {
      label: '广告综合公司',
      meta: '觉策ERP · 全流程',
      blurb: '设计、制作、发布一条龙，追求全流程统筹。',
      tone: 'erp',
      painPoints: [
        '报价、排产、回款多头分散，缺统一视图',
        '设计稿改版，与生产信息不同步',
        '应收账款多头，账期管理靠人盯',
        '项目利润分散，盘点靠月末对账',
      ],
      solutions: [
        '订单一条主线贯穿报价到回款，全程可查',
        '设计改版与投产信息同步，减少返工',
        '应收账期集中管理，到期自动提醒',
        '按项目归集成本与收入，利润实时可看',
      ],
      scenarios: [
        { title: '订单主线', desc: '报价到回款贯穿' },
        { title: '设计同步', desc: '改版信息一致' },
        { title: '应收集中', desc: '账期自动提醒' },
        { title: '项目利润', desc: '成本收入归集' },
      ],
    },
    {
      label: '会展与物料',
      meta: '觉策ERP · 项目制',
      blurb: '项目制运作，节点多、协同面广。',
      tone: 'erp',
      painPoints: [
        '一展多批物料，排产与交付难统筹',
        '多供应商协同，进度信息分散',
        '项目节点多，回款与交付易脱节',
        '现场补单多，成本难以追踪',
      ],
      solutions: [
        '整批物料拆子单排产，进度统一看板',
        '供应商与采购记录进系统，协同可查',
        '项目节点挂单据，回款交付自动关联',
        '现场补单即时入库，成本实时归集',
      ],
      scenarios: [
        { title: '子单排产', desc: '整批拆排、看板统筹' },
        { title: '供应商协同', desc: '采购记录可查' },
        { title: '节点关联', desc: '交付回款联动' },
        { title: '补单入库', desc: '成本实时归集' },
      ],
    },
  ],
  cta: {
    kicker: '没找到你的工艺？',
    heading: '把你的工序走一遍看看',
    desc: '告诉我们你做哪类广告物料、卡在哪一环，我们用流程给您对齐一遍。',
    btnText: '约一次演示',
  },
}

/** 云雀站 · 场景式用法 */
const yunque: SolutionsContent = {
  meta: {
    title: '适用场景 · 云雀 Yunque',
    description:
      '项目执行、流程自动化、知识管理、客户跟进等场景，看看智能体能在哪儿先顶上。',
  },
  hero: {
    kicker: '适用场景',
    titleA: '这些活，',
    titleEm: '先交给智能体试试',
    description: '按场景整理了智能体常见用法的落地路径。挑一个贴近你的，看哪里先顶上、人留哪一步判断。',
    stats: [
      { value: '06', label: '个场景' },
      { value: '1', label: '套协作体系' },
      { value: '重复 → 智能体', label: '逐类对齐' },
    ],
  },
  industries: [
    {
      label: '项目执行',
      meta: '云雀 Yunque · 场景',
      blurb: '交付型团队每周的例会与跟进最占人力。',
      tone: 'yunque',
      painPoints: [
        '例会纪要零散，待办常漏记',
        '进度跟进靠人催，节点易漏',
        '交付文档统稿耗时，反复改',
        '关键信息散落各聊天窗口',
      ],
      solutions: [
        '例会纪要自动成稿，待办直接落人',
        '节点跟进有提醒，逾期自动拉回视线',
        '交付文档就地统稿，少一次来回',
        '项目信息收进记忆，随时可查',
      ],
      scenarios: [
        { title: '会议纪要', desc: '自动成稿、待办落地' },
        { title: '进度跟进', desc: '节点提醒、逾期预警' },
        { title: '文档统稿', desc: '就地成稿、版本一致' },
        { title: '项目记忆', desc: '背景决策可追溯' },
      ],
    },
    {
      label: '流程自动化',
      meta: '云雀 Yunque · 场景',
      blurb: '重复审批、汇总、转发的部门最合适。',
      tone: 'yunque',
      painPoints: [
        '标准审批走人，占用大量时间',
        '数据汇总靠手工，易出错',
        '工单流转滞一环节，全链卡壳',
        '操作留痕缺失，难审计',
      ],
      solutions: [
        '标准动作交给智能体，人只处理异常',
        '数据自动汇总，异常单独拉出',
        '流转卡点自动提醒，减少等堂',
        '每步有记录，过程可审计',
      ],
      scenarios: [
        { title: '标准审批', desc: '智能体代办、人处理例外' },
        { title: '数据汇总', desc: '自动归集、异常拉出' },
        { title: '工单流转', desc: '卡点提醒不滞单' },
        { title: '过程留痕', desc: '可审计可追溯' },
      ],
    },
    {
      label: '知识管理',
      meta: '云雀 Yunque · 场景',
      blurb: '文档多、找不着、新人上手慢的团队。',
      tone: 'yunque',
      painPoints: [
        '知识散落，搜不到也找不准',
        '沉淀靠自觉，新内容难归位',
        '答案没出处，不好采信',
        '新人融入慢，重复问同样问题',
      ],
      solutions: [
        '知识进库、语义搜索，问得到答案',
        '写法规范自动沉淀，内容有出处',
        '答案标注来源，可用可核',
        '新人自行检索，少打扰老员工',
      ],
      scenarios: [
        { title: '知识入库', desc: '自动沉淀有出处' },
        { title: '语义检索', desc: '问得到找得准' },
        { title: '来源标注', desc: '答案可核可信' },
        { title: '新人上手', desc: '自助检索少打扰' },
      ],
    },
    {
      label: '客户跟进',
      meta: '云雀 Yunque · 场景',
      blurb: '线索多、跟进散、容易漏的市场部门。',
      tone: 'yunque',
      painPoints: [
        '线索汇总靠表格，状态滞后',
        '跟进记录散落，接手即断链',
        '提醒靠记性，关键节点常漏',
        '客户信息重复录入，效率低',
      ],
      solutions: [
        '线索与跟进自动汇总，状态实时',
        '跟进记录进记忆，换人不丢上下文',
        '关键节点自动提醒，不靠记性',
        '客户信息一处维护，多处复用',
      ],
      scenarios: [
        { title: '线索汇总', desc: '状态实时可见' },
        { title: '跟进记忆', desc: '换人不断档' },
        { title: '节点提醒', desc: '到期自动提示' },
        { title: '信息一处', desc: '多端复用' },
      ],
    },
    {
      label: '运营执行',
      meta: '云雀 Yunque · 场景',
      blurb: '内容与运营类重复产出最合适外包给智能体。',
      tone: 'yunque',
      painPoints: [
        '内容产出批次化，消耗编辑人力',
        '多平台分发逐份处理，低效',
        '排期校对靠人工，易出错',
        '数据复盘手工统计，耗时',
      ],
      solutions: [
        '素材与模板成套，产出快且一致',
        '一份内容多端分发，按平台调整',
        '排期与首发自动校对，减少错漏',
        '复盘数据自动汇总，结论就地生成',
      ],
      scenarios: [
        { title: '内容产出', desc: '模板化成套' },
        { title: '多端分发', desc: '一次成稿多端适配' },
        { title: '排期校对', desc: '自动复查避免错漏' },
        { title: '数据复盘', desc: '汇总就地成稿' },
      ],
    },
    {
      label: '审批与协作',
      meta: '云雀 Yunque · 场景',
      blurb: '审批多、跨部门协同多的组织。',
      tone: 'yunque',
      painPoints: [
        '审批链条长，卡点靠催',
        '多方评论散落，结论难定',
        '权限边界不清，不敢放开用',
        '历史决策翻旧账难',
      ],
      solutions: [
        '审批流转有记录，卡点自动提醒',
        '评论与结论收敛一处，定论可溯',
        '细颗粒权限，按角色放开使用',
        '历史决策进记忆，随时可查',
      ],
      scenarios: [
        { title: '审批流转', desc: '留痕、卡点提醒' },
        { title: '结论收敛', desc: '定论一处可溯' },
        { title: '权限边界', desc: '细颗粒可控' },
        { title: '决策记忆', desc: '历史随时可查' },
      ],
    },
  ],
  cta: {
    kicker: '没找到你的场景？',
    heading: '先用一个最占人的活试起来',
    desc: '告诉我们哪个活最重复、最占人，我们用智能体先给您走通一条。',
    btnText: '约一次体验',
  },
}

export const solutionsContent: Record<SiteId, SolutionsContent> = { juece, erp, yunque }

/** 当前站点行业页内容。 */
export const solutions: SolutionsContent = solutionsContent[siteId]