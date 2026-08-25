<template>
  <div class="solutions-page">
    <!-- ═══ 01 · 页头（工程暗色面板） ═══ -->
    <section class="page-hero">
      <div class="grid-texture"></div>
      <div class="site-container">
        <div class="hero-inner">
          <span class="kicker kicker--white" v-reveal>行业方案</span>
          <h1 class="hero-title" v-reveal>
            不同行业，<br />落地结果各不相同
          </h1>
          <p class="hero-desc" v-reveal>
            按行业整理了觉策智云与觉策 ERP 的现成方案。挑一个贴近业务的，
            看每一项对应哪个痛点、落到什么结果。
          </p>
          <div class="hero-meta" v-reveal>
            <span><b class="tnum">06</b>个行业</span>
            <span><b class="tnum">03</b>条产品线</span>
            <span><b>痛点 → 方案</b>逐条对应</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 02 · 行业索引（编辑式手风琴） ═══ -->
    <section class="index-section">
      <div class="site-container">
        <div class="index-list">
          <article
            v-for="(industry, i) in industries"
            :key="industry.value"
            class="index-band"
            :class="{ 'is-open': openIndex === i, [`tone-${industry.tone}`]: true }"
            v-reveal="40"
          >
            <button class="band-head" @click="toggleOpen(i)">
              <span class="band-no tnum">0{{ i + 1 }}</span>
              <span class="band-title">
                <span class="bt-main">{{ industry.label }}</span>
                <span class="bt-meta">{{ industry.meta }}</span>
              </span>
              <span class="band-blurb">{{ industry.blurb }}</span>
              <span class="band-chevron"><arrow-right-icon /></span>
            </button>

            <div class="band-detail" :class="{ 'is-open': openIndex === i }">
              <div class="detail-grid">
                <div class="detail-col pain">
                  <div class="col-label">
                    <span class="col-dot"></span>
                    <h3>行业痛点</h3>
                    <span class="col-count tnum">{{ industry.painPoints.length }}</span>
                  </div>
                  <ol class="num-list">
                    <li v-for="(point, p) in industry.painPoints" :key="p">
                      <span class="num tnum">{{ p + 1 }}</span>
                      <span class="text">{{ point }}</span>
                    </li>
                  </ol>
                </div>

                <div class="detail-col solve">
                  <div class="col-label">
                    <span class="col-dot"></span>
                    <h3>解决方案</h3>
                    <span class="col-count tnum">{{ industry.solutions.length }}</span>
                  </div>
                  <ul class="tick-list">
                    <li v-for="(sol, s) in industry.solutions" :key="s">
                      <span class="tick"><check-icon size="14px" /></span>
                      <span class="text">{{ sol }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="detail-scenes">
                <div class="scenes-title">应用场景</div>
                <div class="scenes-grid">
                  <div class="scene" v-for="(scene, s) in industry.scenarios" :key="s">
                    <span class="scene-no tnum">0{{ s + 1 }}</span>
                    <span class="scene-icon"><component :is="scene.icon" size="20px" /></span>
                    <div class="scene-text">
                      <h4>{{ scene.title }}</h4>
                      <p>{{ scene.desc }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="detail-foot">
                <button class="cta-link" @click="handleIndustryCTA(industry)">
                  了解{{ industry.label }}方案 <arrow-right-icon />
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ═══ 03 · 底部 CTA（暗色） ═══ -->
    <section class="bottom-cta">
      <div class="grid-texture"></div>
      <div class="site-container">
        <div class="cta-inner" v-reveal>
          <span class="kicker kicker--white kicker--center">没有贴近你的场景？</span>
          <h2>可以直接聊聊你的业务</h2>
          <p>告诉我们你做什么生意、卡在哪一环，我们对需求给一套推荐，直接照着谈。</p>
          <button class="cta-btn" @click="goAdminLogin">联系我们 <arrow-right-icon /></button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { navigateToApp } from '@shared/navigation';
import {
  EducationIcon,
  CheckIcon,
  VerifyIcon,
  TimeIcon,
  CardIcon,
  FlagIcon,
  ScanIcon,
  TicketIcon,
  UserIcon,
  ChartPieIcon,
  ServiceIcon,
  MoneyIcon,
  ChatIcon,
  UsergroupIcon,
  UserTalkIcon,
  ShopIcon,
  CalendarIcon,
  UserAddIcon,
  ApiIcon,
  LayersIcon,
  AppIcon,
  CodeIcon,
  ArrowRightIcon
} from 'tdesign-icons-vue-next';

const goAdminLogin = () => {
  navigateToApp('platform', '/login');
};

const openIndex = ref(0);

const toggleOpen = (i) => {
  openIndex.value = openIndex.value === i ? -1 : i;
};

const handleIndustryCTA = (industry) => {
  goAdminLogin();
};

const industries = [
  {
    value: "edu",
    label: "教育培训",
    icon: EducationIcon,
    title: "教培机构的招生、排课与家校沟通",
    meta: "觉策智云",
    blurb: "招生、排课、家校沟通占用大量日常人力。",
    tone: "saas",
    painPoints: [
      "招生依赖传单和熟客介绍，效果难预估",
      "排课消课靠表格，师生的时间常有冲突",
      "家长难以了解孩子近期的学习进展",
      "学员结课后缺少继续学习的理由"
    ],
    solutions: [
      "体验课、拼团等活动辅助招生，来源更可控",
      "智能排课自动提示冲突，家长在微信收到消课通知",
      "成长档案与作业打卡，家长能持续看到进展",
      "积分与会员权益，为续费提供依据"
    ],
    scenarios: [
      { icon: UserAddIcon, title: "招生引流", desc: "体验课、拼团等活动" },
      { icon: CalendarIcon, title: "智能排课", desc: "自动检测冲突" },
      { icon: UserTalkIcon, title: "家校互通", desc: "作业、评价、通知" },
      { icon: ChartPieIcon, title: "经营报表", desc: "财务与课消汇总" }
    ]
  },
  {
    value: "sports",
    label: "体育场馆",
    icon: VerifyIcon,
    title: "体育场馆的场地与时间管理",
    meta: "觉策智云",
    blurb: "场地空闲意味着收入流失，让运营更可控。",
    tone: "saas",
    painPoints: [
      "电话预订容易撞单，沟通成本较高",
      "会员卡靠纸质记录，核销效率偏低",
      "淡旺季客流差异明显，闲时资源闲置",
      "对账繁琐，占用大量时间"
    ],
    solutions: [
      "在线预订小程序，场地状态可视化，锁定时段避免撞单",
      "电子会员卡，扫码核销，入场更顺畅",
      "闲时优惠与赛事活动，提升闲时的场地利用率",
      "流水自动归集，经营日报按固定时间生成"
    ],
    scenarios: [
      { icon: TimeIcon, title: "场地预订", desc: "在线选场锁场" },
      { icon: CardIcon, title: "次卡/年卡", desc: "灵活售卖与核销" },
      { icon: FlagIcon, title: "赛事运营", desc: "报名、签到、成绩" },
      { icon: ShopIcon, title: "商品售卖", desc: "饮料装备线上购买" }
    ]
  },
  {
    value: "food",
    label: "餐饮美食",
    icon: ShopIcon,
    title: "餐饮门店的堂食、外卖与会员",
    meta: "觉策智云",
    blurb: "平台抽成较高时，自营渠道是补充。",
    tone: "saas",
    painPoints: [
      "平台抽成较高，挤压门店利润",
      "高峰时段排队，部分客人等待后离开",
      "客人消费后难以建立持续的联系",
      "对折扣依赖明显，常以让利换客流"
    ],
    solutions: [
      "自营外卖与扫码点餐，订单直连门店收单",
      "多人预点单，加快高峰时段的翻台",
      "支付后引导成为会员，把客群留进自己的会员系统",
      "活动玩法多样，折扣与套餐搭配让利"
    ],
    scenarios: [
      { icon: ScanIcon, title: "扫码点餐", desc: "堂食、自提、外卖" },
      { icon: TicketIcon, title: "营销发券", desc: "满减、折扣、套餐" },
      { icon: UserIcon, title: "会员储值", desc: "会员资金与管理" },
      { icon: ChartPieIcon, title: "菜品分析", desc: "分析菜品销售情况" }
    ]
  },
  {
    value: "service",
    label: "到店服务",
    icon: ServiceIcon,
    title: "预约与服务类门店的日常经营",
    meta: "觉策智云",
    blurb: "预约制门店，重点在让老客户持续到店。",
    tone: "saas",
    painPoints: [
      "技师排班靠口头协调，客人常需等待",
      "服务质量依赖个人经验，水平波动较大",
      "储值后缺少唤醒，下次到店时间难掌握",
      "老客维护靠私下联系，容易遗漏"
    ],
    solutions: [
      "在线预约，技师与工位可视化，客人自选时段",
      "服务项目标准化，消费后支持评价",
      "会员画像与标签，按需推送合适的优惠",
      "生日与复购提醒，用自动化维护老客"
    ],
    scenarios: [
      { icon: CalendarIcon, title: "在线预约", desc: "选技师、选时间" },
      { icon: MoneyIcon, title: "预付卡", desc: "计次、储值灵活" },
      { icon: ChatIcon, title: "评价管理", desc: "服务质量可追踪" },
      { icon: UsergroupIcon, title: "员工提成", desc: "业绩自动统计" }
    ]
  },
  {
    value: "advertising",
    label: "广告制作",
    icon: AppIcon,
    title: "广告制作：报价、排产与回款",
    meta: "觉策ERP V3",
    blurb: "还在用表格报价、口头跟进生产，可以换一种方式。",
    tone: "erp",
    painPoints: [
      "报价依赖人工经验，容易出错或延误",
      "生产进度靠追问，外协环节难以同步",
      "开票与回款多头对接，财务工作量较大",
      "客户多通过电话询问进度，占用人力"
    ],
    solutions: [
      "导入素材自动识别尺寸并估价，报价更稳定",
      "生产看板与外协跟踪，进度逐工序可见",
      "数电发票与税负统计，减轻对账负担",
      "客户门户支持自助下单与查进度"
    ],
    scenarios: [
      { icon: ShopIcon, title: "智能报价", desc: "素材导入即可估价" },
      { icon: LayersIcon, title: "生产看板", desc: "排产、外协全程可视" },
      { icon: CodeIcon, title: "财务税务", desc: "发票与税负管理" },
      { icon: ApiIcon, title: "客户门户", desc: "自助下单与查进度" }
    ]
  },
  {
    value: "yunque",
    label: "智能体协作",
    icon: AppIcon,
    title: "云雀 Yunque：统一智能体工作台",
    meta: "云雀 Yunque",
    blurb: "AI 项目落地时，问题往往不在模型本身。",
    tone: "yunque",
    painPoints: [
      "演示效果可行，上线后缺少运行管理手段",
      "多个智能体各自工作，缺少协作与共享记忆",
      "缺少权限管控，难以对团队放开使用",
      "对接现有系统时，扩展能力不足"
    ],
    solutions: [
      "一个工作台统一 Chat、画布与文档",
      "记忆与任务编排，保持协作连贯",
      "治理控制台与权限管理，满足企业使用要求",
      "插件化架构，便于对接外部系统"
    ],
    scenarios: [
      { icon: AppIcon, title: "统一工作台", desc: "Chat、画布、文档" },
      { icon: LayersIcon, title: "任务编排", desc: "多智能体协同" },
      { icon: CodeIcon, title: "治理管控", desc: "权限与管理" },
      { icon: ApiIcon, title: "插件扩展", desc: "对接外部系统" }
    ]
  }
];
</script>

<style scoped lang="scss">
.solutions-page {
  background: #fff;
  overflow: hidden;
}

/* ═══ 01 · 页头 ═══ */
.page-hero {
  position: relative;
  padding: 88px 0 96px;
  background:
    radial-gradient(circle at 78% 10%, rgba(47, 143, 150, 0.22), transparent 40%),
    linear-gradient(150deg, #0c2a2e 0%, #133d42 55%, #1b5f65 100%);
  color: #fff;
  isolation: isolate;
  overflow: hidden;

  .hero-inner { position: relative; max-width: 720px; }

  .hero-title {
    margin: 0 0 22px;
    font-size: var(--fs-h1);
    font-weight: 800;
    line-height: 1.18;
    letter-spacing: -0.02em;
  }

  .hero-desc {
    margin: 0 0 36px;
    max-width: 52ch;
    font-size: 17px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.82);
  }

  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 28px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.14);

    span {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.66);

      b { font-size: 18px; font-weight: 800; color: #7fd3d8; margin-right: 4px; }
    }
  }
}

/* ═══ 02 · 行业索引 ═══ */
.index-section { padding: 96px 0 112px; }

.index-list {
  border-top: 1px solid var(--neutral-200);
}

.index-band {
  border-bottom: 1px solid var(--neutral-200);
  transition: background var(--transition-normal);

  .band-head {
    width: 100%;
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1.1fr) 44px;
    gap: 24px;
    align-items: center;
    padding: 30px 12px;
    background: transparent;
    border: 0;
    cursor: pointer;
    text-align: left;

    &:hover .band-title .bt-main { color: var(--brand-color-active); }
  }

  .band-no {
    font-size: 22px;
    font-weight: 800;
    color: var(--neutral-200);
    letter-spacing: -0.02em;
    transition: color var(--transition-fast);
  }

  .band-title {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .bt-main {
      font-size: 26px;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: -0.01em;
      transition: color var(--transition-fast);
    }
    .bt-meta { font-size: 12px; color: var(--text-tertiary); }
  }

  .band-blurb {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-secondary);
    max-width: 46ch;
  }

  .band-chevron {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--neutral-200);
    color: var(--text-tertiary);
    transition: all var(--transition-fast);

    .t-icon { transition: transform var(--transition-fast); }
  }

  &.is-open {
    background: var(--neutral-50);

    .band-no { color: var(--brand-color-active); }
    .band-chevron {
      border-color: var(--brand-color);
      color: var(--brand-color-active);
      .t-icon { transform: rotate(90deg); }
    }
  }
}

/* 详情区 */
.band-detail {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 420ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 300ms ease;

  &.is-open {
    max-height: 1400px;
    opacity: 1;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  padding: 12px 12px 0 108px;
}

.detail-col {
  padding: 28px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--neutral-200);
  background: #fff;

  &.pain { background: var(--neutral-50); }
  &.solve { background: #fff; }

  .col-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;

    .col-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--brand-color); }
    h3 { margin: 0; font-size: 16px; color: var(--text-primary); }
    .col-count { margin-left: auto; font-size: 13px; font-weight: 700; color: var(--neutral-300); }
  }
}

.num-list, .tick-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.num-list li, .tick-list li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.num-list .num {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 6px;
  background: #fff;
  border: 1px solid var(--neutral-200);
  color: var(--brand-color-active);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.tick-list .tick {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--brand-color-bg);
  color: var(--brand-color-active);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

/* 应用场景 */
.detail-scenes {
  margin: 24px 12px 0 108px;
  padding: 28px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--neutral-200);
  background: linear-gradient(150deg, var(--brand-color-bg), rgba(255, 255, 255, 0.9));

  .scenes-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 22px;
  }

  .scenes-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .scene {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    background: #fff;
    border: 1px solid var(--neutral-200);
    border-radius: var(--radius-md);

    .scene-no { font-size: 12px; font-weight: 700; color: var(--neutral-300); }
    .scene-icon { color: var(--brand-color-active); }
    .scene-text {
      h4 { margin: 0 0 4px; font-size: 15px; color: var(--text-primary); }
      p { margin: 0; font-size: 13px; color: var(--text-tertiary); }
    }
  }
}

.detail-foot {
  padding: 28px 12px 32px 108px;

  .cta-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 22px;
    border-radius: 999px;
    background: var(--brand-gradient);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    border: 0;
    cursor: pointer;
    transition: transform var(--transition-fast);

    .t-icon { transition: transform var(--transition-fast); }
    &:hover { transform: translateY(-2px); .t-icon { transform: translateX(3px); } }
  }
}

/* tone 强调：云雀走低饱和琥珀，仅点在图标与对勾 */
.index-band.tone-yunque {
  .tick-list .tick { background: var(--color-yunque-bg); color: var(--color-yunque); }
  .scene-icon { color: var(--color-yunque); }
  .detail-scenes {
    background: linear-gradient(150deg, var(--color-yunque-bg), rgba(255, 255, 255, 0.9));
  }
}

/* ═══ 03 · 底部 CTA ═══ */
.bottom-cta {
  position: relative;
  padding: 88px 0;
  background:
    radial-gradient(circle at 82% 20%, rgba(184, 134, 63, 0.14), transparent 36%),
    linear-gradient(150deg, #0c2a2e 0%, #164a50 60%, #1b5f65 100%);
  color: #fff;
  text-align: center;
  isolation: isolate;
  overflow: hidden;

  .cta-inner { position: relative; }

  h2 {
    margin: 0 0 16px;
    font-size: clamp(26px, 3vw, 36px);
    font-weight: 800;
  }

  p {
    margin: 0 auto 36px;
    max-width: 46ch;
    font-size: 16px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.78);
  }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 32px;
    height: 48px;
    border-radius: 999px;
    background: #fff;
    color: var(--brand-color-active);
    font-size: 15px;
    font-weight: 700;
    border: 0;
    cursor: pointer;
    transition: transform var(--transition-fast);

    .t-icon { transition: transform var(--transition-fast); }
    &:hover { transform: translateY(-2px); .t-icon { transform: translateX(3px); } }
  }
}

/* ═══ Responsive ═══ */
@media (max-width: 1080px) {
  .index-band .band-head {
    grid-template-columns: 56px minmax(0, 1fr) 40px;
  }
  .index-band .band-blurb { display: none; }
  .detail-grid, .detail-scenes { padding-left: 68px; }
  .detail-foot { padding-left: 68px; }
}

@media (max-width: 900px) {
  .detail-scenes .scenes-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .page-hero { padding: 56px 0 64px; }
  .index-section { padding: 64px 0 80px; }

  .index-band .band-head {
    grid-template-columns: 40px minmax(0, 1fr) 36px;
    gap: 14px;
    padding: 20px 6px;
    .bt-main { font-size: 21px; }
  }
  .band-chevron { width: 36px; height: 36px; }

  .detail-grid { grid-template-columns: 1fr; padding: 12px 6px 0; }
  .detail-scenes { margin: 16px 6px 0; }
  .detail-foot { padding: 20px 6px 24px; }
}

@media (max-width: 560px) {
  .detail-scenes .scenes-grid { grid-template-columns: 1fr; }
}
</style>