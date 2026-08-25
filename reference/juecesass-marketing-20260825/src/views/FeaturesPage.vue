<template>
  <div class="features-page">
    <!-- ═══ 01 · 页头（工程暗色面板） ═══ -->
    <section class="page-hero">
      <div class="grid-texture"></div>
      <div class="site-container">
        <div class="hero-inner">
          <span class="kicker kicker--white" v-reveal>功能全景</span>
          <h1 class="hero-title" v-reveal>
            每项能力，<br /><em>都对应一个落地结果</em>
          </h1>
          <p class="hero-desc" v-reveal>
            智云盯线上卖货，ERP 盯制作交付，云雀盯 AI 落地。
            每一项都只对着一类经营结果做深。
          </p>
          <div class="hero-index" v-reveal>
            <span class="hi-item"><b class="tnum">05</b>个能力条目</span>
            <span class="hi-item"><b class="tnum">03</b>条产品线</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 02 · 能力目录（编号编辑式） ═══ -->
    <section class="cap-section">
      <div class="site-container">
        <div class="cap-list">

          <!-- 01 SaaS 可视化搭建 -->
          <article class="cap" v-reveal>
            <div class="cap-head">
              <span class="cap-no tnum">01</span>
              <div class="cap-title-wrap">
                <span class="cap-tag">觉策智云 · 不用写代码</span>
                <h2>商城自己搭，按自己的节奏上线</h2>
              </div>
            </div>
            <div class="cap-body">
              <aside class="cap-aside">
                <p>
                  Banner、商品位、营销位都是现成版块，运营拖拽拼好，
                  一个能卖货的商城就能上线。
                </p>
                <ul class="tick-list">
                  <li>H5 和小程序，一次搭建两端同步</li>
                  <li>每个版块样式可单独调</li>
                  <li>数据面板告诉你哪一页转得好</li>
                </ul>
              </aside>
              <div class="data-panel">
                <div class="dp-head">
                  <span class="dp-title">一个商城的组成</span>
                  <span class="dp-badge">3 端同步</span>
                </div>
                <div class="dp-blocks">
                  <div class="dp-block" v-for="b in shopBlocks" :key="b.name">
                    <span class="db-no tnum">{{ b.no }}</span>
                    <div class="db-body">
                      <span class="db-name">{{ b.name }}</span>
                      <span class="db-note">{{ b.note }}</span>
                    </div>
                    <div class="db-bar"><i :style="{ width: b.w }"></i></div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <!-- 02 SaaS 商城与营销 -->
          <article class="cap" v-reveal>
            <div class="cap-head">
              <span class="cap-no tnum">02</span>
              <div class="cap-title-wrap">
                <span class="cap-tag">觉策智云 · 把货卖出去</span>
                <h2>商城加营销，一套把成交跑通</h2>
              </div>
            </div>
            <div class="cap-body reverse">
              <div class="data-panel">
                <div class="dp-head">
                  <span class="dp-title">私域里常用的几种玩法</span>
                  <span class="dp-badge">按需开启</span>
                </div>
                <div class="dp-chips">
                  <span class="dp-chip">拼团</span>
                  <span class="dp-chip">砍价</span>
                  <span class="dp-chip">秒杀</span>
                  <span class="dp-chip">分销</span>
                  <span class="dp-chip">优惠券</span>
                  <span class="dp-chip">积分兑换</span>
                </div>
                <div class="dp-rows">
                  <div class="dp-row">
                    <span class="dr-label">拉新</span>
                    <div class="dr-track"><i style="width: 84%"></i></div>
                    <span class="dr-val">拼团为主</span>
                  </div>
                  <div class="dp-row">
                    <span class="dr-label">复购</span>
                    <div class="dr-track"><i style="width: 66%"></i></div>
                    <span class="dr-val">优惠券</span>
                  </div>
                  <div class="dp-row">
                    <span class="dr-label">裂变</span>
                    <div class="dr-track"><i style="width: 52%"></i></div>
                    <span class="dr-val">分销带佣</span>
                  </div>
                </div>
              </div>
              <aside class="cap-aside">
                <p>
                  实物、课程、权益都能上架；拼团、砍价、秒杀、分销按需开，
                  成交节奏自己定。
                </p>
                <ul class="tick-list">
                  <li>运费规则按需设，物流状态可跟踪</li>
                  <li>分销佣金自动结算，老客帮忙卖</li>
                  <li>优惠券发放到核销，全程可见</li>
                </ul>
              </aside>
            </div>
          </article>

          <!-- 03 SaaS 会员与数据 -->
          <article class="cap" v-reveal>
            <div class="cap-head">
              <span class="cap-no tnum">03</span>
              <div class="cap-title-wrap">
                <span class="cap-tag">觉策智云 · 把人留下来</span>
                <h2>会员与数据，把一次成交做成回头客</h2>
              </div>
            </div>
            <div class="cap-body">
              <aside class="cap-aside">
                <p>
                  不同渠道来的客人都收敛到一个身份、一份画像。
                  积分、等级、付费会员，把一次成交沉淀为长期关系。
                </p>
                <ul class="tick-list">
                  <li>用 RFM 做分客，该发的券自动发</li>
                  <li>积分商城可异业兑换</li>
                  <li>经营仪表盘，数据每天摊开看</li>
                </ul>
              </aside>
              <div class="data-panel">
                <div class="dp-head">
                  <span class="dp-title">会员增长趋势</span>
                  <span class="dp-badge">近 6 个月</span>
                </div>
                <div class="dp-kpis">
                  <div class="kpi"><span class="kpi-val">+28%</span><span class="kpi-label">复购率</span></div>
                  <div class="kpi"><span class="kpi-val">1.6w</span><span class="kpi-label">在册会员</span></div>
                </div>
                <div class="dp-bars">
                  <div class="bar" style="height: 34%"></div>
                  <div class="bar" style="height: 48%"></div>
                  <div class="bar" style="height: 42%"></div>
                  <div class="bar" style="height: 62%"></div>
                  <div class="bar" style="height: 55%"></div>
                  <div class="bar" style="height: 72%"></div>
                </div>
                <div class="dp-axis"><span>1月</span><span>2月</span><span>3月</span><span>4月</span><span>5月</span><span>6月</span></div>
              </div>
            </div>
          </article>

          <!-- 04 ERP 从报价到回款 -->
          <article class="cap" v-reveal>
            <div class="cap-head">
              <span class="cap-no tnum">04</span>
              <div class="cap-title-wrap">
                <span class="cap-tag">觉策ERP · 从报价到回款</span>
                <h2>报价到回款，每个环节都有记录</h2>
              </div>
            </div>
            <div class="cap-body reverse">
              <div class="data-panel">
                <div class="dp-head">
                  <span class="dp-title">一笔订单的旅程</span>
                  <span class="dp-badge">全程留痕</span>
                </div>
                <ol class="dp-journey">
                  <li><span class="step tnum">1</span>智能报价</li>
                  <li><span class="step tnum">2</span>开工生产</li>
                  <li><span class="step tnum">3</span>物料与排期</li>
                  <li><span class="step tnum">4</span>外协与交付</li>
                  <li><span class="step tnum">5</span>开票与计税</li>
                  <li><span class="step tnum">6</span>对账回款</li>
                </ol>
              </div>
              <aside class="cap-aside">
                <p>
                  报价有准数、生产有进度、回款有凭证。从接到单到收到钱，
                  每一环都摊在系统里，可交代、可追溯。
                </p>
                <ul class="tick-list">
                  <li>素材导入，尺寸价位自动算好</li>
                  <li>生产看板配外协跟踪，进度实时更新</li>
                  <li>数电发票、税负分析，客户可自查进度</li>
                </ul>
              </aside>
            </div>
          </article>

          <!-- 05 云雀智能体 -->
          <article class="cap" v-reveal>
            <div class="cap-head">
              <span class="cap-no tnum">05</span>
              <div class="cap-title-wrap">
                <span class="cap-tag yb">云雀 Yunque · 让智能体落地</span>
                <h2>让智能体从「演示能跑」到「上线能用」</h2>
              </div>
            </div>
            <div class="cap-body">
              <aside class="cap-aside">
                <p>
                  一个工作台，配上记忆与治理，把 AI 项目从"能跑"推进到
                  "能用、好管、能扩"。
                </p>
                <ul class="tick-list">
                  <li>一个空间管对话、画布和文档</li>
                  <li>治理加 RBAC，团队协作规整可控</li>
                  <li>插件化架构，对接外部系统</li>
                </ul>
              </aside>
              <div class="data-panel yb-panel">
                <div class="dp-head">
                  <span class="dp-title">一个智能体的组成</span>
                  <span class="dp-badge">工作台</span>
                </div>
                <div class="agent-map">
                  <div class="agent-core">Yunque</div>
                  <div class="agent-links"></div>
                  <div class="agent-peg p1"><span class="ag-ic"><layers-icon size="18px" /></span><b>任务</b></div>
                  <div class="agent-peg p2"><span class="ag-ic"><shop-icon size="18px" /></span><b>记忆</b></div>
                  <div class="agent-peg p3"><span class="ag-ic"><code-icon size="18px" /></span><b>治理</b></div>
                  <div class="agent-peg p4"><span class="ag-ic"><api-icon size="18px" /></span><b>扩展</b></div>
                </div>
              </div>
            </div>
          </article>

        </div>
      </div>
    </section>

    <!-- ═══ 03 · 基础能力（单行条目） ═══ -->
    <section class="base-cap">
      <div class="site-container">
        <div class="base-head" v-reveal>
          <span class="kicker">基础能力</span>
          <h2>三条产品线共用的一套基础能力</h2>
        </div>
        <div class="base-grid" v-reveal>
          <div class="base-item" v-for="item in moreFeatures" :key="item.title">
            <span class="bi-name">{{ item.title }}</span>
            <p>{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const shopBlocks = [
  { no: "01", name: "首页 Banner", note: "换图、设跳转、挂活动", w: "72%" },
  { no: "02", name: "商品橱窗", note: "价格、库存、排序", w: "86%" },
  { no: "03", name: "营销活动位", note: "拼团、秒杀、优惠券", w: "64%" },
  { no: "04", name: "会员与积分", note: "等级、返利、兑换", w: "58%" }
];

const moreFeatures = [
  { title: '多租户架构', desc: '各家数据隔离，安全可靠' },
  { title: '权限管理', desc: 'RBAC 模型，细到按钮级' },
  { title: '开放 API', desc: '标准接口，想接什么接什么' },
  { title: '自动备份', desc: '每日自动备份，随时可回滚' },
  { title: '多端适配', desc: 'PC / H5 / 小程序 / App 覆盖' },
  { title: '在线客服', desc: '主流客服系统可集成' },
  { title: '消息通知', desc: '短信 / 邮件 / 微信都能发' },
  { title: '扩展脚本', desc: '支持自定义脚本逻辑' }
];

import { LayersIcon, ShopIcon, CodeIcon, ApiIcon } from 'tdesign-icons-vue-next';
</script>

<style scoped lang="scss">
.features-page {
  background: #fff;
  overflow: hidden;
}

/* ═══ 01 · 页头 ═══ */
.page-hero {
  position: relative;
  padding: 88px 0 96px;
  background:
    radial-gradient(circle at 80% 12%, rgba(47, 143, 150, 0.22), transparent 40%),
    linear-gradient(150deg, #0c2a2e 0%, #133d42 55%, #1b5f65 100%);
  color: #fff;
  isolation: isolate;
  overflow: hidden;

  .hero-inner { position: relative; max-width: 720px; }

  .hero-title {
    margin: 0 0 22px;
    font-size: var(--fs-h1);
    font-weight: 800;
    line-height: 1.16;
    letter-spacing: -0.02em;

    em {
      font-style: normal;
      position: relative;
      color: #7fd3d8;
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
    margin: 0 0 34px;
    max-width: 54ch;
    font-size: 17px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.82);
  }

  .hero-index {
    display: flex;
    gap: 28px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.14);

    .hi-item {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.66);
      b { font-size: 18px; font-weight: 800; color: #7fd3d8; margin-right: 4px; }
    }
  }
}

/* ═══ 02 · 能力目录 ═══ */
.cap-section { padding: 96px 0 80px; }

.cap {
  padding: 64px 0;
  border-bottom: 1px solid var(--neutral-200);

  &:last-child { border-bottom: none; }
}

.cap-head {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 40px;

  .cap-no {
    flex-shrink: 0;
    font-size: 30px;
    font-weight: 800;
    color: var(--neutral-200);
    letter-spacing: -0.03em;
    padding-top: 2px;
  }

  .cap-title-wrap {
    .cap-tag {
      display: inline-flex;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
      background: var(--brand-color-bg);
      color: var(--brand-color-active);
      &.yb { background: var(--color-yunque-bg); color: var(--color-yunque); }
    }

    h2 {
      margin: 0;
      font-size: clamp(24px, 2.6vw, 30px);
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }
  }
}

.cap-body {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 48px;
  align-items: center;

  &.reverse { direction: rtl; }
  &.reverse > * { direction: ltr; }
}

.cap-aside {
  p {
    margin: 0 0 26px;
    font-size: 15px;
    line-height: 1.8;
    color: var(--text-secondary);
  }
}

.tick-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;

  li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 15px;
    color: var(--text-primary);

    &::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 2px;
      background: var(--brand-color);
      flex-shrink: 0;
      margin-top: 8px;
    }
  }
}

/* ── 深青数据面板 ── */
.data-panel {
  position: relative;
  padding: 32px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 85% 10%, rgba(47, 143, 150, 0.22), transparent 44%),
    linear-gradient(160deg, #0c2a2e 0%, #123c41 58%, #1a4c52 100%);
  color: #fff;
  box-shadow: 0 30px 60px rgba(9, 34, 38, 0.2);
  overflow: hidden;
  min-height: 300px;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 22px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
    pointer-events: none;
  }
}

.dp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 28px;

  .dp-title { font-size: 15px; font-weight: 700; }
  .dp-badge {
    font-size: 12px;
    font-weight: 600;
    color: #9fe1e5;
    background: rgba(47, 143, 150, 0.25);
    padding: 4px 12px;
    border-radius: 999px;
  }
}

/* 版块组成 */
.dp-blocks {
  display: flex;
  flex-direction: column;
  gap: 22px;

  .dp-block {
    display: flex;
    align-items: center;
    gap: 14px;

    .db-no {
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #9fe1e5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
    }

    .db-body {
      width: 128px;
      flex: none;

      .db-name { display: block; font-size: 14px; font-weight: 600; }
      .db-note { display: block; margin-top: 2px; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
    }

    .db-bar {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;

      i {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: linear-gradient(90deg, var(--brand-color), #5fb3b9);
      }
    }
  }
}

/* 营销玩法 */
.dp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 28px;

  .dp-chip {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: #cfeef0;
    border: 1px solid rgba(127, 211, 216, 0.18);
  }
}

.dp-rows {
  display: flex;
  flex-direction: column;
  gap: 18px;

  .dp-row {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;

    .dr-label { width: 36px; flex: none; color: rgba(255, 255, 255, 0.66); }
    .dr-track {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;

      i {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: linear-gradient(90deg, var(--brand-color), #5fb3b9);
      }
    }
    .dr-val { width: 84px; flex: none; text-align: right; font-size: 12px; color: rgba(255, 255, 255, 0.72); }
  }
}

/* 会员趋势 */
.dp-kpis {
  display: flex;
  gap: 40px;
  margin-bottom: 28px;

  .kpi {
    .kpi-val { display: inline-block; font-size: 24px; font-weight: 800; color: #9fe1e5; }
    .kpi-label { margin-left: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
  }
}

.dp-bars {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 120px;
  padding: 0 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .bar {
    flex: 1;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, #6fc1c7, var(--brand-color));
    opacity: 0.9;
  }
}

.dp-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

/* 订单旅程 */
.dp-journey {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px 24px;

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.07);
    font-size: 14px;
    font-weight: 500;

    .step {
      width: 26px;
      height: 26px;
      flex-shrink: 0;
      border-radius: 8px;
      background: rgba(47, 143, 150, 0.3);
      color: #9fe1e5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
    }
  }
}

/* 云雀 · 智能体组成（静态克制构图） */
.yb-panel {
  background:
    radial-gradient(circle at 82% 12%, rgba(184, 134, 63, 0.2), transparent 44%),
    linear-gradient(160deg, #0c2a2e 0%, #123c41 60%, #1a4c52 100%);

  .dp-badge { color: #e6c48c; background: rgba(184, 134, 63, 0.24); }
}

.agent-map {
  position: relative;
  height: 220px;

  .agent-core {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(135deg, #b8863f, #8a6a2f);
    z-index: 2;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
  }

  .agent-links {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 200px;
    border-radius: 50%;
    border: 1px dashed rgba(230, 196, 140, 0.28);
  }

  .agent-peg {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;

    b { font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.85); }

    .ag-ic {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(184, 134, 63, 0.2);
      color: #e6c48c;
      border: 1px solid rgba(230, 196, 140, 0.2);
    }

    &.p1 { left: 50%; top: 0; transform: translateX(-50%); }
    &.p2 { right: 0; top: 50%; transform: translateY(-50%); }
    &.p3 { left: 50%; bottom: 0; transform: translateX(-50%); }
    &.p4 { left: 0; top: 50%; transform: translateY(-50%); }
  }
}

/* ═══ 03 · 基础能力 ═══ */
.base-cap {
  padding: 88px 0;
  background: var(--neutral-50);
  border-top: 1px solid var(--neutral-100);
}

.base-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 48px;

  .kicker { margin-bottom: 8px; }
  h2 { margin: 0; font-size: clamp(24px, 2.6vw, 32px); font-weight: 800; color: var(--text-primary); }
}

.base-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--neutral-200);
  border: 1px solid var(--neutral-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.base-item {
  padding: 26px 24px;
  background: #fff;

  .bi-name {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  p { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--text-tertiary); }
}

/* ═══ Responsive ═══ */
@media (max-width: 1080px) {
  .base-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 900px) {
  .cap-body { grid-template-columns: 1fr; gap: 32px; }
  .cap-body.reverse { direction: ltr; }
}

@media (max-width: 768px) {
  .page-hero { padding: 56px 0 64px; }
  .cap-section { padding: 56px 0 48px; }
  .base-cap { padding: 56px 0; }
  .base-head { flex-direction: column; align-items: flex-start; }
  .cap { padding: 44px 0; }
  .cap-head { gap: 16px; }
  .dp-blocks .dp-block .db-body { width: 104px; }
  .base-grid { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .dp-journey { grid-template-columns: 1fr; }
}
</style>