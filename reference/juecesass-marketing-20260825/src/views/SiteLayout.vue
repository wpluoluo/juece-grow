<template>
  <t-layout class="site-layout">
    <t-head-menu v-model="activeValue" theme="light" class="site-header" height="64px">
      <template #logo>
        <div class="brand" @click="goHome">
          <div class="brand-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#brand-grad)"/>
              <path d="M10 22V12L16 8L22 12V22L16 26L10 22Z" stroke="white" stroke-width="1.8" fill="none"/>
              <circle cx="16" cy="17" r="3" fill="white" opacity="0.85"/>
              <defs>
                <linearGradient id="brand-grad" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stop-color="#2f8f96"/>
                  <stop offset="100%" stop-color="#1b5f65"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="brand-text">
            <div class="brand-title">觉策科技</div>
            <div class="brand-subtitle">让经营与智能协同进化</div>
          </div>
        </div>
      </template>

      <t-menu-item value="home" @click="goRoute('home')">首页</t-menu-item>
      <t-menu-item value="solutions" @click="goRoute('solutions')">行业方案</t-menu-item>
      <t-menu-item value="features" @click="goRoute('features')">功能全景</t-menu-item>
      <t-menu-item value="pricing" @click="goRoute('pricing')">价格方案</t-menu-item>

      <template #operations>
        <div class="actions">
          <t-button theme="default" variant="text" @click="goAdminLogin" class="desktop-only">登录</t-button>
          <t-button theme="primary" @click="goAdminLogin" class="desktop-only">免费试用</t-button>
          <t-button theme="default" variant="text" class="mobile-only menu-btn" @click="toggleMobileMenu">
            <view-list-icon size="24px" />
          </t-button>
        </div>
      </template>
    </t-head-menu>

    <t-drawer
      v-model:visible="mobileMenuVisible"
      placement="right"
      header="菜单"
      :footer="false"
      size="60%"
    >
      <div class="mobile-nav">
        <t-menu :value="activeValue" theme="light" class="mobile-menu" vertical>
          <t-menu-item value="home" @click="handleMobileNav('home')">首页</t-menu-item>
          <t-menu-item value="solutions" @click="handleMobileNav('solutions')">行业方案</t-menu-item>
          <t-menu-item value="features" @click="handleMobileNav('features')">功能全景</t-menu-item>
          <t-menu-item value="pricing" @click="handleMobileNav('pricing')">价格方案</t-menu-item>
        </t-menu>
        <div class="mobile-actions">
          <t-button block theme="default" variant="outline" @click="goAdminLogin">登录</t-button>
          <t-button block theme="primary" @click="goAdminLogin">免费试用</t-button>
        </div>
      </div>
    </t-drawer>

    <t-content class="site-content">
      <router-view />
    </t-content>

    <t-footer class="site-footer">
      <div class="site-container">
        <div class="footer-top">
          <!-- Brand Column -->
          <div class="footer-col brand-col">
            <div class="footer-logo">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#2f8f96"/>
                <path d="M10 22V12L16 8L22 12V22L16 26L10 22Z" stroke="white" stroke-width="1.8" fill="none"/>
                <circle cx="16" cy="17" r="3" fill="white" opacity="0.85"/>
              </svg>
              <span>觉策科技</span>
            </div>
            <p class="footer-desc">
              覆盖实体商业数字化、广告行业经营管理与智能体工作系统，
              三条产品线各盯一类经营结果，都在这里找解法。
            </p>
          </div>

          <!-- Product Matrix -->
          <div class="footer-col">
            <h3>产品矩阵</h3>
            <a @click="goRoute('features')">觉策智云 · SaaS平台</a>
            <a href="//erp.juece.cloud" target="_blank">觉策ERP · 广告行业管理系统</a>
            <a href="//yunque.juece.cloud" target="_blank">云雀 Yunque · 智能体工作系统</a>
          </div>

          <!-- 行业方案 -->
          <div class="footer-col">
            <h3>行业方案</h3>
            <a @click="goRoute('solutions')">教育培训</a>
            <a @click="goRoute('solutions')">体育场馆</a>
            <a @click="goRoute('solutions')">餐饮美食</a>
            <a @click="goRoute('solutions')">到店服务</a>
            <a href="//erp.juece.cloud" target="_blank">广告制作行业</a>
          </div>

          <!-- 联系我们 -->
          <div class="footer-col contact-col">
            <h3>联系我们</h3>
            <div class="contact-item">
              <mail-icon /> <span>58379760@qq.com</span>
            </div>
            <div class="contact-item">
              <time-icon /> <span>周一至周五 9:00 - 18:00</span>
            </div>
          </div>
        </div>

        <t-divider />

        <div class="footer-bottom">
          <div class="copyright">
            © {{ year }} 觉策科技. All Rights Reserved.
            <a href="https://beian.miit.gov.cn/" target="_blank" class="icp-link">渝ICP备2025076099号-1</a>
          </div>
          <div class="links">
            <a @click="goRoute('privacy')">隐私政策</a>
            <a @click="goRoute('terms')">服务条款</a>
            <a @click="goRoute('sitemap')">站点地图</a>
          </div>
        </div>
      </div>
    </t-footer>
  </t-layout>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { LogoCodepenIcon, MailIcon, ViewListIcon, TimeIcon } from 'tdesign-icons-vue-next';
import { getAppUrl } from '@shared/navigation';

const router = useRouter();
const route = useRoute();
const year = computed(() => new Date().getFullYear());
const mobileMenuVisible = ref(false);

const activeValue = ref('home');

watch(() => route.name, (name) => {
  const menuRouteNames = ['home', 'solutions', 'features', 'pricing'];
  activeValue.value = menuRouteNames.includes(name) ? name : 'home';
}, { immediate: true });

const goRoute = (name) => {
  router.push({ name });
};

const goHome = () => {
  router.push({ name: 'home' });
};

const toggleMobileMenu = () => {
  mobileMenuVisible.value = !mobileMenuVisible.value;
};

const handleMobileNav = (name) => {
  goRoute(name);
  mobileMenuVisible.value = false;
};

const goAdminLogin = () => {
  window.location.href = '//admin.juece.cloud/';
};
</script>

<style scoped lang="scss">
.site-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 10px rgba(0, 0, 0, 0.05);

  :deep(.t-head-menu__inner) {
    max-width: var(--site-max-width);
    margin: 0 auto;
    height: 100%;
  }
}

.brand {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  height: 64px;
  gap: 10px;

  .brand-icon {
    display: flex;
    align-items: center;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .brand-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--text-primary);
  }

  .brand-subtitle {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.2;
  }
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.desktop-only {
  display: inline-flex;
}

.mobile-only {
  display: none;
}

.site-content {
  flex: 1;
  padding: 0;
}

/* ── Footer ── */
.site-footer {
  background: var(--neutral-50);
  padding: 60px 0 24px;
  color: var(--text-secondary);
  border-top: 1px solid var(--neutral-200);
}

.footer-top {
  display: flex;
  flex-wrap: wrap;
  gap: 40px;
  justify-content: space-between;
  margin-bottom: 40px;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 160px;

  h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 6px;
  }

  a {
    font-size: 14px;
    cursor: pointer;
    transition: color var(--transition-fast);
    color: var(--text-secondary);

    &:hover {
      color: var(--brand-color);
    }
  }
}

.brand-col {
  max-width: 320px;

  .footer-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .footer-desc {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-tertiary);
  }
}

.contact-col {
  .contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  font-size: 13px;

  .copyright {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .icp-link {
    color: var(--text-tertiary);
    text-decoration: none;
    transition: color var(--transition-fast);

    &:hover {
      color: var(--brand-color);
    }
  }

  .links {
    display: flex;
    gap: 24px;
    a {
      cursor: pointer;
      transition: color var(--transition-fast);
      &:hover { color: var(--text-primary); }
    }
  }
}

.mobile-nav {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.mobile-actions {
  margin-top: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 768px) {
  .desktop-only { display: none; }
  .mobile-only { display: inline-flex; }

  .footer-top { flex-direction: column; gap: 30px; }
  .footer-bottom { flex-direction: column; gap: 16px; text-align: center; }

  .brand-subtitle { display: none; }
}
</style>