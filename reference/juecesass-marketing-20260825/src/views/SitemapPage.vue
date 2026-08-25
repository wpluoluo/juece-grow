<template>
  <div class="sitemap-page">
    <div class="site-container">
      <div class="sitemap-content">
        <h1>站点地图</h1>
        <p class="sitemap-desc">快速找到您需要的内容</p>

        <div class="sitemap-grid">
          <div class="sitemap-section">
            <h2>主要页面</h2>
            <ul class="link-list">
              <li><a @click="goRoute('home')">首页</a></li>
              <li><a @click="goRoute('solutions')">行业方案</a></li>
              <li><a @click="goRoute('features')">功能全景</a></li>
              <li><a @click="goRoute('pricing')">价格方案</a></li>
            </ul>
          </div>

          <div class="sitemap-section">
            <h2>法律与支持</h2>
            <ul class="link-list">
              <li><a @click="goRoute('privacy')">隐私政策</a></li>
              <li><a @click="goRoute('terms')">服务条款</a></li>
              <li><a @click="goRoute('sitemap')">站点地图</a></li>
            </ul>
          </div>

          <div class="sitemap-section">
            <h2>联系方式</h2>
            <ul class="info-list">
              <li>邮箱：58379760@qq.com</li>
              <li>ICP备案：<a href="https://beian.miit.gov.cn/" target="_blank">渝ICP备2025076099号-1</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goRoute = (name) => {
  router.push({ name });
};
</script>

<style scoped lang="scss">
.sitemap-page {
  padding: 80px 0;
  background: #f9f9f9;
  min-height: 60vh;
}

.sitemap-content {
  background: white;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  max-width: 900px;
  margin: 0 auto;

  h1 {
    font-size: 32px;
    margin-bottom: 8px;
    text-align: center;
    color: #333;
  }

  .sitemap-desc {
    text-align: center;
    color: #666;
    margin-bottom: 48px;
  }
}

.sitemap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 48px;
}

.sitemap-section {
  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 24px;
    color: #333;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--td-brand-color);
    display: inline-block;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    margin-bottom: 12px;
    font-size: 14px;
    color: #555;

    a {
      color: #555;
      text-decoration: none;
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: var(--td-brand-color);
      }
    }
  }
}

@media (max-width: 768px) {
  .sitemap-content {
    padding: 24px;
  }
  
  .sitemap-grid {
    gap: 32px;
  }
}
</style>
