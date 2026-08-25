<template>
  <div class="legal-page">
    <div class="site-container">
      <div class="legal-content">
        <h1>服务条款</h1>
        <p class="update-time">最近更新日期：2025年1月1日</p>

        <section>
          <h2>1. 接受条款</h2>
          <p>
            欢迎使用觉策智云企业数字化运营平台（以下简称“本平台”）。通过访问或使用本平台，即表示您同意接受本服务条款的所有内容。如果您不同意本条款的任何部分，请停止使用本服务。
          </p>
        </section>

        <section>
          <h2>2. 服务内容</h2>
          <p>
            本平台为企业提供数字化运营解决方案，包括但不限于会员管理、营销工具、数据分析、插件市场等功能。我们保留随时修改、暂停或终止部分或全部服务的权利。
          </p>
        </section>

        <section>
          <h2>3. 账号注册与安全</h2>
          <ul>
            <li>您在注册账号时应提供真实、准确的信息，并及时更新。</li>
            <li>您有责任妥善保管您的账号和密码，并对该账号下发生的所有活动负责。</li>
            <li>如发现账号被盗用或存在安全漏洞，请立即通知我们。</li>
          </ul>
        </section>

        <section>
          <h2>4. 用户行为规范</h2>
          <p>在使用本平台服务时，您承诺不进行以下行为：</p>
          <ul>
            <li>违反法律法规或侵犯他人合法权益；</li>
            <li>发布违法、色情、暴力或垃圾信息；</li>
            <li>干扰或破坏本平台的正常运行；</li>
            <li>利用本平台进行任何非法商业活动。</li>
          </ul>
        </section>

        <section>
          <h2>5. 知识产权</h2>
          <p>
            本平台包含的所有内容（包括但不限于文字、图片、代码、界面设计等）均受版权法和知识产权法律保护。未经我们书面许可，您不得复制、修改或用于商业目的。
          </p>
        </section>

        <section>
          <h2>6. 免责声明</h2>
          <p>
            本平台服务按“现状”提供。我们不保证服务不会中断或没有错误。在法律允许的范围内，我们不对因使用本平台而产生的任何直接或间接损失承担责任。
          </p>
        </section>

        <section>
          <h2>7. 协议修改</h2>
          <p>
            我们有权随时修改本服务条款。修改后的条款将在本平台发布，并在发布时生效。您继续使用本平台即视为接受修改后的条款。
          </p>
        </section>

        <section>
          <h2>8. 联系我们</h2>
          <p>
            如有任何问题，请联系我们：<br />
            邮箱：58379760@qq.com
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.legal-page {
  padding: 80px 0;
  background: #f9f9f9;
  min-height: 60vh;
}

.legal-content {
  background: white;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  max-width: 900px;
  margin: 0 auto;

  h1 {
    font-size: 32px;
    margin-bottom: 16px;
    text-align: center;
    color: #333;
  }

  .update-time {
    text-align: center;
    color: #999;
    margin-bottom: 48px;
    font-size: 14px;
  }

  section {
    margin-bottom: 32px;

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #333;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }

    p {
      line-height: 1.8;
      color: #555;
      margin-bottom: 16px;
    }

    ul {
      padding-left: 20px;
      li {
        line-height: 1.8;
        color: #555;
        margin-bottom: 8px;
        list-style-type: disc;
      }
    }
  }
}

@media (max-width: 768px) {
  .legal-content {
    padding: 24px;
  }
}
</style>
