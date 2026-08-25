<template>
  <div class="pricing-page">
    <!-- ═══ 01 · 页头（工程暗色面板） ═══ -->
    <section class="page-hero">
      <div class="grid-texture"></div>
      <div class="site-container">
        <div class="hero-inner">
          <span class="kicker kicker--white" v-reveal>价格与合作</span>
          <h1 class="hero-title" v-reveal>
            价格摆出来，<em>选哪档你说了算</em>
          </h1>
          <p class="hero-desc" v-reveal>
            这里是觉策智云的定价，按年付费，费用和权益都写明白。
            觉策ERP 和云雀 Yunque 计费方式不同，需要时单独问。
          </p>
        </div>
      </div>
    </section>

    <!-- ═══ 02 · 方案堆叠带 ═══ -->
    <section class="pricing-section">
      <div class="site-container">
        <div class="plan-list">
          <article
            v-for="(plan, i) in plans"
            :key="plan.name"
            class="plan-band"
            :class="{ highlight: plan.highlight }"
            v-reveal="40"
          >
            <div class="band-left">
              <div class="no-row">
                <span class="plan-no tnum">0{{ i + 1 }}</span>
                <span v-if="plan.highlight" class="rec-tag">重点推荐</span>
              </div>
              <h2 class="plan-name">{{ plan.name }}</h2>
              <div class="plan-price tnum">
                <span class="currency">¥</span>
                <span class="amount">{{ plan.price }}</span>
                <span class="unit">/年</span>
              </div>
              <p class="plan-desc">{{ plan.desc }}</p>
              <button class="plan-btn" :class="{ ghost: plan.highlight }" @click="goAdminLogin">
                {{ plan.btnText }} <arrow-right-icon />
              </button>
            </div>

            <div class="band-features">
              <div class="feat-item" v-for="f in plan.features" :key="f">
                <span class="feat-tick"></span>
                <span>{{ f }}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ═══ 03 · ERP 与云雀（琥珀强调） ═══ -->
    <section class="eco-section">
      <div class="grid-texture"></div>
      <div class="site-container">
        <div class="eco-inner" v-reveal>
          <span class="kicker kicker--white kicker--center">更多产品</span>
          <h2>想要 ERP 或者云雀？</h2>
          <p>
            觉策ERP 按项目授权，云雀 Yunque 按团队合作。<br />
            计费方式不同，具体方案可咨询销售团队。
          </p>
          <div class="eco-links">
            <button class="eco-btn" @click="openErp">看看觉策ERP <arrow-right-icon /></button>
            <button class="eco-btn ghost" @click="openYunque">了解云雀 Yunque <arrow-right-icon /></button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 04 · 常见问题 ═══ -->
    <section class="faq-section">
      <div class="site-container">
        <div class="faq-inner" v-reveal>
          <span class="kicker kicker--center">常见问题</span>
          <h2>几个常被问到的问题</h2>
          <div class="faq-list">
            <div class="faq-item" v-for="(faq, index) in faqs" :key="index">
              <button
                class="faq-q"
                :class="{ 'is-open': openFaq === index }"
                @click="toggleFaq(index)"
              >
                <span class="fq-text">{{ faq.question }}</span>
                <span class="fq-toggle"><span class="plus"></span></span>
              </button>
              <div class="faq-a" v-show="openFaq === index">{{ faq.answer }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ArrowRightIcon } from 'tdesign-icons-vue-next';
import { navigateToApp } from '@shared/navigation';

const goAdminLogin = () => {
  navigateToApp('platform', '/login');
};

const openErp = () => {
  window.open('//erp.juece.cloud', '_blank');
};

const openYunque = () => {
  window.open('//yunque.juece.cloud', '_blank');
};

const plans = [
  {
    name: '基础版',
    price: '0',
    desc: '免费把线上经营先跑起来，够用再升',
    btnText: '免费开始',
    highlight: false,
    features: [
      '基础会员管理',
      '积分商城（限 50 款商品）',
      '标准报表与核心数据看板',
      '社区支持与使用文档'
    ]
  },
  {
    name: '专业版',
    price: '3999',
    desc: '多数往线上走的门店，从这一档开始更划算',
    btnText: '开始试用',
    highlight: true,
    features: [
      '包含基础版全部功能',
      '商品上架数量不限',
      '营销自动化工具',
      '开放 API 与系统对接',
      '7×12 小时客服支持',
      '支持去除品牌标识'
    ]
  },
  {
    name: '旗舰版',
    price: '9999',
    desc: '多门店、私有化、定制的场景，落到这一档',
    btnText: '开始使用',
    highlight: false,
    features: [
      '包含专业版全部功能',
      '支持私有化部署',
      '按需定制开发',
      'SLA 服务保障',
      '专属客户成功经理',
      '多门店 / 多商户统一管理'
    ]
  }
];

const openIndex = ref(null);
const toggleFaq = (i) => {
  openIndex.value = openIndex.value === i ? null : i;
};

const faqs = [
  {
    question: '套餐能随时调整吗？',
    answer: '可以。升级即时生效、费用按比例；降级次月生效，费用按实际计算。'
  },
  {
    question: '开发票吗？',
    answer: '是的。所有付费套餐均支持开具增值税普通发票或专用发票。'
  },
  {
    question: '数据安全怎么保证？',
    answer: '传输与存储环节均采用加密，每日自动备份。安全相关的细节可查阅服务协议。'
  },
  {
    question: '觉策ERP和云雀Yunque怎么收费？',
    answer: 'ERP 按项目授权并收取年度服务费，云雀按团队规模定价。具体方案可咨询销售团队。'
  }
];
</script>

<style scoped lang="scss">
.pricing-page {
  background: #fff;
  overflow: hidden;
}

/* ═══ 01 · 页头 ═══ */
.page-hero {
  position: relative;
  padding: 88px 0 96px;
  background:
    radial-gradient(circle at 78% 12%, rgba(47, 143, 150, 0.22), transparent 40%),
    linear-gradient(150deg, #0c2a2e 0%, #133d42 55%, #1b5f65 100%);
  color: #fff;
  isolation: isolate;
  overflow: hidden;

  .hero-inner { position: relative; max-width: 700px; }

  .hero-title {
    margin: 0 0 22px;
    font-size: var(--fs-h1);
    font-weight: 800;
    line-height: 1.16;
    letter-spacing: -0.02em;

    em {
      font-style: normal;
      color: #7fd3d8;
      position: relative;
      &::after {
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: 0.04em;
        height: 0.14em;
        background: linear-gradient(90deg, rgba(127, 211, 216, 0.4), transparent);
        z-index: -1;
        border-radius: 2px;
      }
    }
  }

  .hero-desc {
    margin: 0;
    max-width: 52ch;
    font-size: 17px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.82);
  }
}

/* ═══ 02 · 方案堆叠带 ═══ */
.pricing-section { padding: 88px 0 96px; }

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.plan-band {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 48px;
  padding: 40px 44px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--neutral-200);
  background: #fff;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

  &:hover {
    border-color: var(--brand-color);
    box-shadow: var(--shadow-md);
  }

  &.highlight {
    border-color: transparent;
    background:
      radial-gradient(circle at 88% 8%, rgba(47, 143, 150, 0.28), transparent 46%),
      linear-gradient(150deg, #0c2a2e 0%, #133d42 58%, #1b5f65 100%);
    color: #fff;
    box-shadow: 0 30px 60px rgba(9, 34, 38, 0.22);

    .band-left {
      .plan-name { color: #fff; }
      .plan-price {
        .currency, .amount { color: #fff; }
        .unit { color: rgba(255, 255, 255, 0.7); }
      }
      .plan-desc { color: rgba(255, 255, 255, 0.78); }
    }
    .band-features .feat-item { color: rgba(255, 255, 255, 0.9); }
  }
}

.no-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  .plan-no {
    font-size: 22px;
    font-weight: 800;
    color: var(--neutral-200);
    letter-spacing: -0.02em;
  }

  .rec-tag {
    font-size: 12px;
    font-weight: 600;
    color: #9fe1e5;
    background: rgba(47, 143, 150, 0.28);
    padding: 4px 12px;
    border-radius: 999px;
  }
}

.highlight .no-row .plan-no { color: rgba(255, 255, 255, 0.18); }

.plan-name {
  margin: 0 0 18px;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.plan-price {
  display: flex;
  align-items: baseline;
  margin-bottom: 14px;

  .currency { font-size: 22px; font-weight: 600; margin-right: 4px; color: var(--text-primary); }
  .amount { font-size: 52px; font-weight: 800; line-height: 1; letter-spacing: -1px; color: var(--brand-color-active); }
  .unit { font-size: 15px; color: var(--text-secondary); margin-left: 4px; }
}

.plan-desc {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.plan-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  height: 46px;
  border-radius: 999px;
  border: 1px solid var(--neutral-200);
  background: #fff;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);

  .t-icon { transition: transform var(--transition-fast); }
  &:hover {
    border-color: var(--brand-color);
    color: var(--brand-color-active);
    .t-icon { transform: translateX(3px); }
  }

  &.ghost {
    background: #fff;
    border-color: #fff;
    color: var(--brand-color-active);
    font-weight: 700;
    &:hover { transform: translateY(-2px); }
  }
}

.band-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 28px;
  align-content: center;

  .feat-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 14.5px;
    color: var(--text-primary);

    .feat-tick {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      border-radius: 5px;
      background: var(--brand-color-bg);
      position: relative;
      margin-top: 3px;

      &::after {
        content: "";
        position: absolute;
        left: 5px; top: 3px;
        width: 4px; height: 7px;
        border: solid var(--brand-color-active);
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
    }
  }
}

.highlight .band-features .feat-item .feat-tick {
  background: rgba(127, 211, 216, 0.22);
  &::after { border-color: #9fe1e5; }
}

/* ═══ 03 · ERP 与云雀 ═══ */
.eco-section {
  position: relative;
  padding: 88px 0;
  background:
    radial-gradient(circle at 82% 20%, rgba(184, 134, 63, 0.16), transparent 40%),
    linear-gradient(150deg, #0c2a2e 0%, #164a50 60%, #1b5f65 100%);
  color: #fff;
  text-align: center;
  isolation: isolate;
  overflow: hidden;

  .eco-inner { position: relative; }

  h2 {
    margin: 0 0 16px;
    font-size: clamp(26px, 3vw, 36px);
    font-weight: 800;
  }

  p {
    margin: 0 auto 40px;
    max-width: 48ch;
    font-size: 16px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.78);
  }

  .eco-links {
    display: flex;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .eco-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 28px;
    height: 48px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: transparent;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);

    .t-icon { transition: transform var(--transition-fast); }
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      .t-icon { transform: translateX(3px); }
    }

    &.ghost {
      background: #fff;
      border-color: #fff;
      color: var(--brand-color-active);
      font-weight: 700;
      &:hover { transform: translateY(-2px); }
    }
  }
}

/* ═══ 04 · 常见问题 ═══ */
.faq-section { padding: 96px 0; }

.faq-inner {
  max-width: 820px;
  margin: 0 auto;

  .kicker { margin-bottom: 12px; }
  h2 {
    margin: 0 0 48px;
    text-align: center;
    font-size: clamp(24px, 3vw, 32px);
    font-weight: 800;
    color: var(--text-primary);
  }
}

.faq-list {
  border-top: 1px solid var(--neutral-200);
}

.faq-q {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 4px;
  background: none;
  border: 0;
  border-bottom: 1px solid var(--neutral-200);
  cursor: pointer;
  text-align: left;

  .fq-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .fq-toggle {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid var(--neutral-200);
    position: relative;
    transition: all var(--transition-fast);

    .plus {
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: 12px; height: 12px;

      &::before, &::after {
        content: "";
        position: absolute;
        background: var(--text-tertiary);
        transition: all var(--transition-fast);
      }
      &::before { left: 0; right: 0; top: 50%; height: 1.6px; transform: translateY(-50%); }
      &::after { top: 0; bottom: 0; left: 50%; width: 1.6px; transform: translateX(-50%); }
    }
  }

  &:hover .fq-toggle {
    border-color: var(--brand-color);
    .plus::before, .plus::after { background: var(--brand-color); }
  }
}

/* ═══ Responsive ═══ */
@media (max-width: 900px) {
  .plan-band { grid-template-columns: 1fr; gap: 28px; padding: 32px; }
  .band-features { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .page-hero { padding: 56px 0 64px; }
  .pricing-section { padding: 64px 0 72px; }
  .faq-section { padding: 64px 0; }

  .plan-band { padding: 28px 22px; }
  .band-features { grid-template-columns: 1fr; }

  .eco-links { flex-direction: column; align-items: stretch; }
  .eco-btn { justify-content: center; }
}
</style>