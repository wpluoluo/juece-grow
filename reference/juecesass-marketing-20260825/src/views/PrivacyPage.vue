<template>
  <div class="legal-page">
    <div class="site-container">
      <div class="legal-content">
        <h1>隐私政策</h1>
        <p class="update-time">最近更新日期：2025年1月1日</p>

        <section>
          <h2>1. 引言</h2>
          <p>
            欢迎使用觉策智云企业数字化运营平台（以下简称“本平台”）。我们非常重视您的隐私保护和个人信息安全。本隐私政策旨在向您说明我们如何收集、使用、存储和分享您的个人信息，以及您享有的权利。
          </p>
        </section>

        <section>
          <h2>2. 我们收集的信息</h2>
          <p>在您使用本平台服务的过程中，我们可能会收集以下类型的信息：</p>
          <ul>
            <li><strong>账号信息：</strong> 当您注册或登录账号时，我们需要收集您的手机号码、邮箱地址、用户名等信息。</li>
            <li><strong>企业信息：</strong> 如果您代表企业注册，我们需要收集企业的名称、营业执照信息、联系人信息等。</li>
            <li><strong>使用数据：</strong> 我们会收集您使用本平台服务的日志信息，包括登录时间、操作记录、IP地址等。</li>
            <li><strong>交易信息：</strong> 如果您使用平台的支付或交易功能，我们会收集相关的订单信息、支付记录等。</li>
          </ul>
        </section>

        <section>
          <h2>3. 我们如何使用信息</h2>
          <p>我们收集的信息将用于以下目的：</p>
          <ul>
            <li>提供、维护和改进我们的服务；</li>
            <li>处理您的订单和交易；</li>
            <li>向您发送服务通知、验证码或营销信息；</li>
            <li>保障账号安全，防范欺诈和滥用；</li>
            <li>遵守法律法规的要求。</li>
          </ul>
        </section>

        <section>
          <h2>4. 信息共享与披露</h2>
          <p>我们承诺不会出售您的个人信息。但在以下情况下，我们可能会共享您的信息：</p>
          <ul>
            <li><strong>获得您的明确同意：</strong> 在获得您同意的情况下共享信息。</li>
            <li><strong>法律要求：</strong> 根据法律法规、法院命令或政府要求披露信息。</li>
            <li><strong>服务提供商：</strong> 与协助我们提供服务的第三方（如支付机构、云服务商）共享必要信息。</li>
          </ul>
        </section>

        <section>
          <h2>5. 数据安全</h2>
          <p>
            我们采取业界标准的安全措施（如SSL加密、访问控制等）来保护您的信息安全，防止数据泄露、丢失或被滥用。
          </p>
        </section>

        <section>
          <h2>6. 您的权利</h2>
          <p>
            您可以随时登录账号查看、修改您的个人信息。如果您希望删除账号或撤回同意，请通过官方联系方式与我们联系。
          </p>
        </section>

        <section>
          <h2>7. 联系我们</h2>
          <p>
            如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：<br />
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
