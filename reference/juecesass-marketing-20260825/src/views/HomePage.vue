<template>
  <div class="home-page">
    <!-- ═══ 01 · Hero ═══ -->
    <section class="hero">
      <div class="site-container hero-shell">
        <div class="hero-copy">
          <span class="kicker" v-reveal>觉策科技 · 开店 · 接单 · 用 AI</span>
          <h1 class="hero-title" v-reveal>
            <span class="line">
              开店有人帮，
              <em>接单有人管，AI 有人配</em>
            </span>
          </h1>
          <p class="hero-desc" v-reveal>
            智云管线上开店，ERP 管制作交付，云雀管 AI 落地。
            三条产品线，各帮你管住一件正事。
          </p>
          <div class="hero-actions" v-reveal>
            <t-button size="large" theme="primary" class="hero-btn" @click="goAdminLogin">免费试用</t-button>
            <t-button size="large" variant="outline" class="hero-btn outline" @click="goSolutions">看行业方案</t-button>
          </div>

          <div class="hero-strip" v-reveal>
            <div class="hero-stat">
              <strong>开单有数</strong>
              <span>线上卖货，流水天天看得见</span>
            </div>
            <div class="hero-stat">
              <strong>交付可查</strong>
              <span>报价到回款，每一环有记录</span>
            </div>
            <div class="hero-stat">
              <strong>AI 用得起</strong>
              <span>工作台、记忆、权限配齐</span>
            </div>
          </div>
        </div>

        <div class="hero-diagram" v-reveal="120" aria-hidden="true">
          <div class="dg-panel">
            <div class="grid-texture"></div>
            <svg class="dg-svg" viewBox="0 0 480 500" fill="none">
              <!-- 连接线（滚动流动） -->
              <g class="dg-links">
                <path d="M192 250 C 240 156, 268 148, 306 138" class="lk" />
                <path d="M192 250 L 318 250" class="lk" />
                <path d="M192 250 C 240 344, 268 352, 306 362" class="lk" />
              </g>
              <!-- 核心 -->
              <g class="dg-core">
                <circle cx="136" cy="250" r="46" fill="url(#gcore)" />
                <circle cx="136" cy="250" r="46" stroke="rgba(255,255,255,.18)" stroke-width="1.5" />
                <text x="136" y="242" text-anchor="middle" class="core-name">觉策</text>
                <text x="136" y="264" text-anchor="middle" class="core-sub">科技</text>
              </g>
              <!-- 子系统节点 -->
              <g class="dg-node">
                <rect x="286" y="92" width="150" height="92" rx="18" class="node node-saas" />
                <text x="322" y="128" text-anchor="start" class="node-no">01</text>
                <text x="322" y="152" text-anchor="start" class="node-name">觉策智云</text>
                <text x="322" y="174" text-anchor="start" class="node-sub">开店 / 卖货 / 会员</text>
              </g>
              <g class="dg-node">
                <rect x="286" y="204" width="150" height="92" rx="18" class="node node-erp" />
                <text x="322" y="240" text-anchor="start" class="node-no">02</text>
                <text x="322" y="264" text-anchor="start" class="node-name">觉策ERP V3</text>
                <text x="322" y="286" text-anchor="start" class="node-sub">报价 / 排产 / 回款</text>
              </g>
              <g class="dg-node">
                <rect x="286" y="316" width="150" height="92" rx="18" class="node node-yunque" />
                <text x="322" y="352" text-anchor="start" class="node-no">03</text>
                <text x="322" y="376" text-anchor="start" class="node-name">云雀 Yunque</text>
                <text x="322" y="398" text-anchor="start" class="node-sub">智能体协作工作台</text>
              </g>
              <defs>
                <linearGradient id="gcore" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#3aa4ab" />
                  <stop offset="1" stop-color="#1b5f65" />
                </linearGradient>
                <linearGradient id="gsaas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#2f8f96" />
                  <stop offset="1" stop-color="#1b5f65" />
                </linearGradient>
              </defs>
            </svg>
            <div class="dg-chip chip-a">实体商业数字化</div>
            <div class="dg-chip chip-b">广告行业管理</div>
            <div class="dg-chip chip-c">智能体协作</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 02 · 产品矩阵（非对称聚焦） ═══ -->
    <section class="products" id="products">
      <div class="site-container">
        <div class="sec-head split" v-reveal>
          <div>
            <span class="kicker">产品矩阵</span>
            <h2 class="section-title left">你的生意有三件正事</h2>
          </div>
          <p class="section-desc left">
            开店要有人帮，交付要有人管，AI 要有人配。
            三条产品线，正好管住这三件正事。
          </p>
        </div>

        <div class="product-layout">
          <!-- 主聚焦：觉策智云 -->
          <article class="spotlight" v-reveal>
            <div class="spotlight-top">
              <span class="spot-tag">实体商业 SaaS</span>
              <span class="spot-no tnum">01</span>
            </div>
            <div class="spot-icon saas"><shop-icon size="26px" /></div>
            <h3>觉策智云</h3>
            <p class="spot-desc">
              把店开到顾客手机上：顾客看货、下单、付款，你在线收单，
              流水自动归总，天天看得见卖了多少。
            </p>
            <ul class="spot-list">
              <li>开店：商城+小程序+H5，顾客在线下单</li>
              <li>活动：拼团、砍价、秒杀，放上线就能接单</li>
              <li>会员：积分、等级、复购，把路人做成熟客</li>
            </ul>
            <t-button variant="text" theme="primary" class="spot-link" @click="goFeatures">
              看智云能做什么 <arrow-right-icon />
            </t-button>
          </article>

          <!-- 侧栏两栏 -->
          <div class="product-side">
            <article class="side-card erp" v-reveal="80">
              <div class="side-head">
                <span class="spot-tag">广告行业 ERP</span>
                <span class="spot-no tnum">02</span>
              </div>
              <div class="side-icon erp"><chart-icon size="22px" /></div>
              <h3>觉策ERP V3</h3>
              <p>从接单到收钱，管住每一单：报价、生产、回款都在系统里，哪一单到哪一步，翻开就清楚。</p>
              <t-button variant="text" theme="primary" class="side-link" @click="openErp">
                看 ERP 怎么管 <arrow-right-icon />
              </t-button>
            </article>

            <article class="side-card yunque" v-reveal="160">
              <div class="side-head">
                <span class="spot-tag">开放智能体工作系统</span>
                <span class="spot-no tnum">03</span>
              </div>
              <div class="side-icon yunque"><app-icon size="22px" /></div>
              <h3>云雀 Yunque</h3>
              <p>把 AI 用在正事上：工作台、记忆、权限配齐，团队就能把智能体放进实际工作里，而不是留在演示里。</p>
              <t-button variant="text" theme="primary" class="side-link" @click="openYunque">
                看云雀怎么做 <arrow-right-icon />
              </t-button>
            </article>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 03 · 行业与场景（编辑式编号行） ═══ -->
    <section class="solutions">
      <div class="site-container">
        <div class="sec-head split" v-reveal>
          <div>
            <span class="kicker">行业与场景</span>
            <h2 class="section-title left">你的行业，<br />有为你写的解法</h2>
          </div>
          <button class="to-all" @click="goSolutions">看全部行业方案 <arrow-right-icon /></button>
        </div>

        <div class="solution-rows">
          <article class="s-row" v-for="(s, i) in solutions" :key="s.title" v-reveal="80">
            <span class="row-no tnum">0{{ i + 1 }}</span>
            <div class="row-body">
              <h3>{{ s.title }} <span class="row-aud">{{ s.audience }}</span></h3>
              <p class="row-desc">{{ s.desc }}</p>
              <div class="row-chips">
                <span v-for="p in s.points" :key="p">{{ p }}</span>
              </div>
            </div>
            <button class="row-arrow" aria-label="查看方案" @click="goSolutions">
              <arrow-right-icon />
            </button>
          </article>
        </div>
      </div>
    </section>

    <!-- ═══ 04 · 真实用法（主视觉编辑块） ═══ -->
    <section class="cases">
      <div class="site-container">
        <div class="sec-head split" v-reveal>
          <div>
            <span class="kicker">几单真实用法</span>
            <h2 class="section-title left">看看这几单，<br />是怎么跑起来的</h2>
          </div>
        </div>

        <div class="case-layout">
          <article class="case-feature" v-reveal>
            <div class="cf-band"><shop-icon /> 觉策智云</div>
            <h3>连锁门店，把线上生意和会员做在一起</h3>
            <p class="cf-desc">
              活动券发出去，老客回来复购，营收增长落到经营报表上，
              进项一栏清清楚楚。
            </p>
            <div class="cf-foot">
              <span class="cf-metric tnum">+28%<small>复购率提升（示例）</small></span>
              <span class="cf-metric tnum">3 端<small>H5 · 小程序 · 后台</small></span>
            </div>
          </article>

          <div class="case-stack">
            <article class="case-mini" v-reveal="100">
              <div class="cm-head"><span class="cm-band">觉策ERP</span><span class="cm-no tnum">A</span></div>
              <h3>广告公司全流程协同</h3>
              <p>从报价到交付，进度、单据都进系统，一句问就有，省了来回打听。</p>
              <span class="cm-tag">交付效率与回款账期</span>
            </article>
            <article class="case-mini" v-reveal="180">
              <div class="cm-head"><span class="cm-band yb">云雀 Yunque</span><span class="cm-no tnum">B</span></div>
              <h3>团队智能体落地</h3>
              <p>工作台、记忆、治理到位，让智能体从个人演示，走到团队一起用。</p>
              <span class="cm-tag yb">平台化与协作效率</span>
            </article>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 05 · 先看看，不着急 ═══ -->
    <section class="resource">
      <div class="site-container">
        <div class="res-inner" v-reveal>
          <span class="kicker kicker--center">先看看，不着急</span>
          <h2 class="section-title">选产品之前，先了解清楚</h2>
          <p class="section-desc">先按角色挑一条进去看，看清楚了再定。看看行业方案、价格与合作方式、云雀的技术方向。</p>
          <div class="res-links">
            <button class="res-link" v-reveal="60" @click="goSolutions">
              <span class="rl-no tnum">01</span>
              <span class="rl-main">
                <strong>行业方案</strong>
                <small>教培、体育、餐饮、广告制作……你在哪个行业？</small>
              </span>
              <arrow-right-icon class="rl-arrow" />
            </button>
            <button class="res-link" v-reveal="120" @click="goPricing">
              <span class="rl-no tnum">02</span>
              <span class="rl-main">
                <strong>价格与合作</strong>
                <small>SaaS 定价透明，ERP 和云雀单议专属方案</small>
              </span>
              <arrow-right-icon class="rl-arrow" />
            </button>
            <button class="res-link" v-reveal="180" @click="openYunque">
              <span class="rl-no tnum">03</span>
              <span class="rl-main">
                <strong>云雀 Yunque</strong>
                <small>面向技术团队，了解开放智能体工作系统</small>
              </span>
              <arrow-right-icon class="rl-arrow" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 06 · CTA ═══ -->
    <section class="cta">
      <div class="site-container">
        <div class="cta-panel">
          <div class="grid-texture"></div>
          <div class="cta-head" v-reveal>
            <span class="kicker kicker--white kicker--center">选择你的入口</span>
            <h2>你是什么角色，就走哪扇门</h2>
            <p>实体商家、广告公司、技术团队，各有各的入口，自己挑。</p>
          </div>

          <div class="cta-rows">
            <div class="cta-row" v-reveal="80" @click="goAdminLogin">
              <div class="cr-left">
                <span class="cr-icon saas"><shop-icon /></span>
                <div>
                  <h3>我是实体商家</h3>
                  <p>把店开进顾客手机里，顾客下单、付款、复购，账目天天看得见。</p>
                </div>
              </div>
              <span class="cr-act">免费试用觉策智云 <arrow-right-icon /></span>
            </div>
            <div class="cta-row" v-reveal="150" @click="openErp">
              <div class="cr-left">
                <span class="cr-icon erp"><chart-icon /></span>
                <div>
                  <h3>我是广告公司</h3>
                  <p>报价、生产、回款进系统，每一环都能交代。</p>
                </div>
              </div>
              <span class="cr-act">预约 ERP 演示 <arrow-right-icon /></span>
            </div>
            <div class="cta-row" v-reveal="220" @click="openYunque">
              <div class="cr-left">
                <span class="cr-icon yunque"><app-icon /></span>
                <div>
                  <h3>我是技术团队</h3>
                  <p>工作台、记忆、权限配齐，智能体就能正式用。</p>
                </div>
              </div>
              <span class="cr-act">了解云雀平台 <arrow-right-icon /></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import {
  ShopIcon,
  ChartIcon,
  AppIcon,
  ArrowRightIcon
} from "tdesign-icons-vue-next";

const router = useRouter();

const solutions = [
  {
    title: "实体门店数字化",
    audience: "教培 · 体育 · 餐饮 · 到店服务",
    desc: "开店卖货、拉新、留客，一套智云收尾到营业报表，账目清清楚楚。",
    points: ["开店：顾客手机下单，店里线上收单", "拉新：活动上线即抢，有现成玩法", "留客：会员积分复购，回头客记在账上"]
  },
  {
    title: "广告制作行业管理",
    audience: "广告制作公司 · 加工企业",
    desc: "报价、生产、回款落到系统，把靠人盯、靠嘴问这一套换成有据可查的流程。",
    points: ["报价快：素材导入，尺寸价格自动算出", "进度清：排产与外协实时可见", "回款稳：对账、开票、回款逐环留痕"]
  },
  {
    title: "智能体工作与协作",
    audience: "研发团队 · 创新组织",
    desc: "AI 能不能用上，看工作台、记忆和协作配没配齐。这一层到位，智能体就能正式用。",
    points: ["工作台：对话、画布、文档一个空间", "有记忆：协作不丢上下文", "可管控：权限到位，放给团队用"]
  }
];

const goFeatures = () => router.push({ name: "features" });
const goSolutions = () => router.push({ name: "solutions" });
const goPricing = () => router.push({ name: "pricing" });

const goAdminLogin = () => {
  window.location.href = "//admin.juece.cloud/";
};
const openErp = () => window.open("//erp.juece.cloud", "_blank");
const openYunque = () => window.open("//yunque.juece.cloud", "_blank");
</script>

<style scoped lang="scss">
.home-page {
  background: #fff;
  overflow: hidden;
}

/* ═══ 01 · Hero ═══ */
.hero {
  position: relative;
  padding: 72px 0 88px;
  background:
    radial-gradient(circle at 82% 12%, rgba(47, 143, 150, 0.1), transparent 34%),
    radial-gradient(circle at 10% 82%, rgba(184, 134, 63, 0.05), transparent 26%),
    linear-gradient(180deg, var(--neutral-50) 0%, #fff 100%);
}

.hero-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  gap: 56px;
  align-items: center;
}

.hero-title {
  margin: 0 0 24px;
  font-size: var(--fs-display);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: -0.03em;
  color: var(--text-primary);

  .line { display: block; }
  em {
    font-style: normal;
    position: relative;
    color: var(--text-primary);
    white-space: nowrap;

    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0.06em;
      height: 0.14em;
      background: linear-gradient(90deg, rgba(47, 143, 150, 0.34), rgba(47, 143, 150, 0));
      z-index: -1;
      border-radius: 2px;
    }
  }
}

.hero-desc {
  max-width: 56ch;
  margin: 0 0 34px;
  font-size: 18px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 40px;

  .hero-btn {
    min-width: 188px;
    height: 48px;
    border-radius: 999px;
    font-weight: 600;
    transition: transform var(--transition-fast);
  }
  .hero-btn:hover { transform: translateY(-2px); }
  .hero-btn.outline { background: #fff; }
}

.hero-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--neutral-200);
  padding-top: 18px;

  .hero-stat {
    padding: 0 18px 0 0;

    + .hero-stat { padding-left: 18px; border-left: 1px solid var(--neutral-100); }

    strong {
      display: block;
      font-size: 26px;
      font-weight: 800;
      line-height: 1;
      color: var(--brand-color-active);
      margin-bottom: 8px;
    }
    span {
      display: block;
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.4;
    }
  }
}

/* ── Hero 图解 ── */
.hero-diagram { min-height: 520px; display: flex; align-items: center; }

.dg-panel {
  position: relative;
  width: 100%;
  min-height: 520px;
  border-radius: 28px;
  padding: 28px;
  background:
    linear-gradient(160deg, #123c41 0%, #1a4c52 48%, #0c2a2e 100%);
  box-shadow: 0 40px 90px rgba(9, 34, 38, 0.28);
  overflow: hidden;
  isolation: isolate;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    border-radius: 28px;
  }
}

.dg-svg {
  display: block;
  width: 100%;
  height: auto;
}

.dg-links .lk {
  stroke: rgba(184, 210, 214, 0.32);
  stroke-width: 1.4;
  stroke-dasharray: 5 7;
  fill: none;
  animation: dashflow 2.4s linear infinite;
}

.dg-core {
  .core-name { fill: #fff; font-size: 22px; font-weight: 800; letter-spacing: 2px; }
  .core-sub { fill: rgba(255, 255, 255, 0.82); font-size: 13px; }
  &::after {
    content: "";
    position: absolute;
    width: 96px;
    height: 96px;
    border: 1px solid rgba(122, 205, 210, 0.5);
    border-radius: 50%;
    top: 50%;
    left: 28%;
    transform: translate(-50%, -50%);
    animation: corepulse 2.6s ease-out infinite;
  }
}

.dg-node {
  .node { cursor: default; }
  .node-saas { fill: url(#gsaas); }
  .node-erp { fill: rgba(47, 143, 150, 0.9); }
  .node-yunque { fill: rgba(184, 134, 63, 0.92); }
  .node-no { fill: rgba(255, 255, 255, 0.55); font-size: 11px; letter-spacing: 1px; }
  .node-name { fill: #fff; font-size: 17px; font-weight: 700; }
  .node-sub { fill: rgba(255, 255, 255, 0.72); font-size: 12px; }
}

.dg-chip {
  position: absolute;
  padding: 9px 15px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neutral-700);
  background: #fff;
  box-shadow: var(--shadow-md);
  animation: floaty 5s ease-in-out infinite;

  &.chip-a { left: 12px; top: 26px; }
  &.chip-b { right: 16px; top: 44%; animation-delay: -1.6s; }
  &.chip-c { left: 20px; bottom: 26px; animation-delay: -3s; }
}

@keyframes dashflow {
  to { stroke-dashoffset: -48; }
}
@keyframes corepulse {
  0% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.82); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); }
}
@keyframes floaty {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

/* ═══ 02 · 产品矩阵 ═══ */
.products, .solutions, .cases, .resource { padding: 96px 0; }

.products { background: #fff; }

.sec-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 56px;

  .section-title { margin-bottom: 0; }
}

.to-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 12px 18px;
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
}

/* 非对称：左大 + 右两栏 */
.product-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
}

.spotlight {
  position: relative;
  padding: 44px;
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 90% 0%, rgba(47, 143, 150, 0.12), transparent 40%),
    linear-gradient(160deg, #f4fbfb 0%, #ffffff 60%);
  border: 1px solid var(--neutral-200);
  overflow: hidden;

  .spotlight-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
  }
  .spot-no {
    font-size: 64px;
    font-weight: 800;
    line-height: 1;
    color: var(--neutral-100);
    letter-spacing: -0.04em;
  }
  .spot-icon {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    background: var(--brand-color-bg);
    color: var(--brand-color-active);
  }
  h3 { margin: 0 0 14px; font-size: 30px; color: var(--text-primary); }
  .spot-desc {
    max-width: 46ch;
    margin: 0 0 28px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--text-secondary);
  }
  .spot-list {
    list-style: none;
    margin: 0 0 32px;
    padding: 0;
    display: grid;
    gap: 12px;

    li {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: var(--text-primary);

      &::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 2px;
        background: var(--brand-color);
        flex-shrink: 0;
      }
    }
  }
  .spot-link .t-icon { transition: transform var(--transition-fast); }
  &:hover .spot-link .t-icon { transform: translateX(3px); }
}

.spot-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--brand-color-bg);
  color: var(--brand-color-active);
}

.product-side {
  display: grid;
  gap: 24px;
}

.side-card {
  display: flex;
  flex-direction: column;
  padding: 30px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--neutral-200);
  background: #fff;
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  .side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .side-no { font-size: 40px; font-weight: 800; line-height: 1; color: var(--neutral-100); letter-spacing: -0.03em; }
  .side-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    background: var(--brand-color-bg);
    color: var(--brand-color-active);
  }
  h3 { margin: 0 0 12px; font-size: 22px; color: var(--text-primary); }
  p { margin: 0 0 20px; font-size: 14px; line-height: 1.75; color: var(--text-secondary); }
  .side-link { margin-top: auto; align-self: flex-start; }
  .side-link .t-icon { transition: transform var(--transition-fast); }
  &:hover .side-link .t-icon { transform: translateX(3px); }

  &.yunque {
    .side-icon { background: var(--color-yunque-bg); color: var(--color-yunque); }
    .side-link { color: var(--color-yunque); }
  }
}

/* ═══ 03 · 行业与场景 ═══ */
.solutions {
  background: linear-gradient(180deg, #fff 0%, var(--neutral-50) 100%);
  border-top: 1px solid var(--neutral-100);
}

.solution-rows {
  border-top: 1px solid var(--neutral-200);
}

.s-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 52px;
  gap: 24px;
  align-items: start;
  padding: 34px 8px;
  border-bottom: 1px solid var(--neutral-200);
  cursor: pointer;
  transition: background var(--transition-fast), padding var(--transition-fast);

  &:hover {
    background: #fff;
    padding-left: 18px;
    padding-right: 18px;
    .row-arrow {
      border-color: var(--brand-color);
      color: var(--brand-color-active);
      transform: translateX(3px);
    }
  }

  .row-no {
    font-size: 22px;
    font-weight: 800;
    color: var(--brand-color-active);
    letter-spacing: -0.02em;
    padding-top: 4px;
  }
  .row-body {
    h3 {
      margin: 0 0 10px;
      font-size: 24px;
      color: var(--text-primary);
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
    }
    .row-aud { font-size: 13px; font-weight: 500; color: var(--text-tertiary); }
    .row-desc { margin: 0 0 16px; max-width: 64ch; font-size: 15px; line-height: 1.75; color: var(--text-secondary); }
  }
  .row-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    span {
      padding: 5px 12px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid var(--neutral-200);
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
  .row-arrow {
    width: 46px;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--neutral-200);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
    align-self: center;
  }
}

/* ═══ 04 · 案例 ═══ */
.cases { background: #fff; }

.case-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 24px;
}

.case-feature {
  padding: 40px;
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, var(--neutral-50), #fff);
  border: 1px solid var(--neutral-200);

  .cf-band {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 28px;
    font-size: 13px;
    font-weight: 700;
    color: var(--brand-color-active);
  }
  h3 { margin: 0 0 16px; font-size: 28px; color: var(--text-primary); line-height: 1.3; }
  .cf-desc { margin: 0 0 40px; max-width: 48ch; font-size: 15px; line-height: 1.8; color: var(--text-secondary); }

  .cf-foot {
    display: flex;
    gap: 48px;
    border-top: 1px solid var(--neutral-200);
    padding-top: 24px;
  }
  .cf-metric {
    font-size: 28px;
    font-weight: 800;
    color: var(--brand-color-active);
    letter-spacing: -0.02em;

    small { display: block; margin-top: 6px; font-size: 12px; font-weight: 500; color: var(--text-tertiary); }
  }
}

.case-stack {
  display: grid;
  gap: 24px;
}

.case-mini {
  padding: 30px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--neutral-200);
  background: #fff;
  transition: transform var(--transition-normal), box-shadow var(--transition-normal), border-color var(--transition-normal);

  &:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--neutral-200); }

  .cm-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .cm-band {
    font-size: 13px;
    font-weight: 700;
    color: var(--brand-color-active);
    &.yb { color: var(--color-yunque); }
  }
  .cm-no { font-size: 30px; font-weight: 800; color: var(--neutral-100); letter-spacing: -0.02em; }
  h3 { margin: 0 0 10px; font-size: 20px; color: var(--text-primary); }
  p { margin: 0 0 20px; font-size: 14px; line-height: 1.75; color: var(--text-secondary); }
  .cm-tag {
    display: inline-flex;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--brand-color-bg);
    color: var(--brand-color-active);
    &.yb { background: var(--color-yunque-bg); color: var(--color-yunque); }
  }
}

/* ═══ 05 · 资源 ═══ */
.resource { background: var(--neutral-50); }

.res-inner {
  text-align: center;
  .section-title { margin-top: 0; }
}

.res-links {
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 14px;
  text-align: left;
}

.res-link {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 28px;
  gap: 18px;
  align-items: center;
  padding: 22px 26px;
  border-radius: var(--radius-md);
  background: #fff;
  border: 1px solid var(--neutral-200);
  cursor: pointer;
  transition: all var(--transition-fast);

  .rl-no { font-size: 20px; font-weight: 800; color: var(--brand-color); }
  .rl-main {
    strong { display: block; font-size: 17px; color: var(--text-primary); margin-bottom: 4px; }
    small { font-size: 14px; color: var(--text-secondary); }
  }
  .rl-arrow { color: var(--text-tertiary); transition: all var(--transition-fast); }

  &:hover {
    border-color: var(--brand-color);
    transform: translateX(4px);
    .rl-arrow { color: var(--brand-color-active); transform: translateX(3px); }
  }
}

/* ═══ 06 · CTA ═══ */
.cta { padding: 0 0 96px; }

.cta-panel {
  position: relative;
  padding: 64px 56px 48px;
  border-radius: 32px;
  background: linear-gradient(150deg, #0c2a2e 0%, #133d42 55%, #1b5f65 100%);
  overflow: hidden;
  isolation: isolate;
  color: #fff;

  .grid-texture { z-index: -1; }
}

.cta-head {
  text-align: center;
  margin-bottom: 40px;

  h2 { margin: 0 0 12px; font-size: clamp(28px, 3.6vw, 40px); font-weight: 800; }
  p { margin: 0 auto; max-width: 56ch; font-size: 15px; line-height: 1.8; color: rgba(255, 255, 255, 0.74); }
}

.cta-rows {
  display: grid;
  gap: 12px;
}

.cta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 26px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.22);
    transform: translateX(4px);
  }

  .cr-left { display: flex; align-items: center; gap: 18px; }
  .cr-icon {
    width: 46px;
    height: 46px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    background: rgba(47, 143, 150, 0.2);
    color: #7fd3d8;
    &.yunque { background: rgba(184, 134, 63, 0.2); color: #e2b978; }
  }
  h3 { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #fff; }
  p { margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.66); }

  .cr-act {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }
}

/* ═══ Responsive ═══ */
@media (max-width: 1080px) {
  .hero-shell,
  .product-layout,
  .case-layout {
    grid-template-columns: 1fr;
  }
  .hero-diagram { min-height: 0; }
  .sec-head.split { flex-direction: column; align-items: flex-start; }

  .hero-strip { grid-template-columns: 1fr; gap: 14px; }
  .hero-stat + .hero-stat { padding-left: 0; border-left: 0; border-top: 1px solid var(--neutral-100); padding-top: 14px; }
}

@media (max-width: 768px) {
  .hero { padding: 48px 0 64px; }
  .products, .solutions, .cases, .resource { padding: 64px 0; }
  .cta { padding-bottom: 64px; }

  .hero-actions { flex-direction: column; align-items: stretch; }
  .hero-btn { width: 100%; }

  .cta-panel { padding: 44px 22px 36px; }
  .cta-row { flex-direction: column; align-items: flex-start; }
  .cr-act { align-self: flex-start; }

  .spotlight { padding: 32px 24px; }
  .case-feature { padding: 28px 22px; }
  .cf-foot { flex-direction: column; gap: 18px; }
  .s-row { grid-template-columns: 44px minmax(0, 1fr); padding: 24px 4px; }
  .s-row .row-arrow { display: none; }
}
</style>