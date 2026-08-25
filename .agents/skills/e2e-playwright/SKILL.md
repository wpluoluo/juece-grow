---
name: e2e-playwright
description: 使用时机：初始化项目的 Playwright E2E 测试、编写/修改 E2E 用例、E2E 测试太慢需要优化时。触发词：E2E、playwright、端到端测试、写 e2e、测试太慢、测试优化、提速测试、滑块验证码、storageState、globalSetup。注意：单测/TDD 请用 tdd skill。
---

# e2e-playwright

用中文输出（命令/路径/代码标识符保持原样不翻译）。

目标：在任意前端项目里**快速搭建并持续维护一套"快且稳"的 Playwright E2E**——遵循性能优化 checklist，绕开 vben/常见项目的已知坑，让 agent 不重复踩坑。
非目标：不替代 `tdd`（单元测试）；不强制硬门禁（性能校验是 WARN 级别，不是阻塞项）；不修改产品代码来迁就测试（测试环境通过 route 拦截解决，非改源码）。

## 核心原则（顺序即优先级）

### 项目 helper 与等待门禁

编写或修改 E2E 前先检查项目实际的 `e2e/common/`，优先复用 `auth`、`wait`、`vxe` helper；不要重复造登录、页面 ready 或 VXE grid 行等待。页面 ready 使用项目 `common/wait.ts` 的 `waitForPageReady`。条件等待优先 `expect`、`expect.poll`、`waitForResponse`、`waitForFunction`。

**naked wait** 指无条件 `waitForTimeout`/sleep 被用作业务同步：大于 800ms 的裸等待禁止；小于 800ms 仅可作为带注释的 settle，且不能替代 ready 条件；`networkidle` 不作为长轮询页面的 ready 判断。

### 视觉证据分支（指针）

截图、trace、多图先落盘；独立 tmux Pi worker 只接收路径，显式使用 `aipper/qwen3` 或 `aipper/gpt-5.5`。主 session 只回收 `summary.md`、结构化结果和 `done.signal`，不读取图片本体。


1. **先配置，后写用例**：`fullyParallel` + `storageState` 复用登录态带来的收益，远大于在用例里抠等待时间。
2. **条件等待取代裸等待**：`expect(...).toBeVisible()` / `expect.poll()` 自动重试；禁止 `waitForTimeout`（>800ms 大段硬等）和 `waitForLoadState('networkidle')`（长轮询页面永远等不到）。
3. **一次登录，全局复用**：`globalSetup` 走一次 UI 登录存 `storageState`，后台页面用例直接 `test.use({ storageState })`，不再重复登录。
4. **trace/video/screenshot 只在失败时保留**，全量录制严重拖慢执行。

## 标准文件骨架（四件套）

```
<app-dir>/
├── playwright.config.ts      # 配置：parallel、workers、trace 策略、globalSetup
└── e2e/
    ├── global-setup.ts       # 登录一次 → 存 .auth.json（storageState）
    ├── common/
    │   └── auth.ts           # loginAs / handleSliderCaptcha / setupApiMock / disableAnimations
    └── *.spec.ts             # 用例：只 import common，不复写逻辑
```

### playwright.config.ts 要点

```typescript
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,                    // test 粒度并行
  workers: process.env.CI ? 4 : undefined, // CI 固定 4，可 --shard 横向扩展
  expect: { timeout: 10 * 1000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    headless: true,
    trace: 'retain-on-failure',           // 只留失败 trace
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
```

### global-setup.ts 要点

```typescript
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
// ⚠️ globalSetup 的 context 没有 baseURL——goto 必须用绝对地址，相对路径会报
//   "Cannot navigate to invalid URL"。loginAs 需支持传入 baseURL 参数。
const AUTH_STATE = 'e2e/.auth.json';

export default async function globalSetup() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await setupApiMock(page);        // 见 common/auth.ts
  await disableAnimations(page);
  await loginAs(page, 'vben', BASE_URL);
  await page.locator('[role=complementary], [class*=layout]').first().waitFor({ timeout: 30_000 });
  await page.context().storageState({ path: AUTH_STATE });
  await browser.close();
}
```

## 性能优化 checklist（对照指南，逐项自查）

- [ ] `fullyParallel: true` 已开，workers 合理（CI 4 + shard）
- [ ] trace/screenshot 仅失败保留，video off
- [ ] 用例零 `waitForTimeout` / `networkidle`
- [ ] **登录复用 storageState**（后台用例不再走 UI 登录——单例收益 20s→4s，最大头）
- [ ] 无关静态资源 abort：`page.route(/\.(png|jpe?g|gif|webp|woff2?|ttf)(\?.*)?$/, r => r.abort())`
- [ ] 禁用 CSS 动画：`page.addInitScript` 注入 `*{transition:none!important;animation:none!important}`
- [ ] 滑块等交互用最少步骤 + 兜底重试（1 步直拖 0.38s vs 10 步 0.89s）
- [ ] 用例数量收敛：业务逻辑校验应下沉单测/API 测试（测试金字塔），E2E 只留核心旅程

## 已知坑位清单（实测踩坑，写用例前先看）

### A. route 拦截类

1. **`page.route('**/api/**')` 会误拦源码模块**：`/src/api/index.ts`、`*.vue`、`*.ts` 这些"路径含 api 但不是接口"的资源会被拦。必须排除：
   ```typescript
   if (!url.includes('/api/') || /\.(ts|vue|js|css|svg|png|json|map)$/.test(url)) return route.continue();
   ```
   否则页面加载直接挂（如 `Failed to fetch dynamically imported module`）。

2. **mock server 只监听 IPv6 `::1`**：nitro 等 dev mock 默认绑 `[::1]`，route 到 `localhost` 走 IPv4 连不上。用 `http://[::1]:5320`。排查法：`curl -4 http://127.0.0.1:PORT` 失败而 `curl -6 http://[::1]:PORT` 成功。

### B. vben 系项目（5.x）

3. **登录按钮不是 `type=submit`**，且 `getByRole({ name: '登录' })` 是**子串匹配**——会误点"手机号登录/扫码登录"tab。用：
   ```typescript
   page.locator('button').filter({ hasText: /^登录$/ }).first()
   ```
4. **侧栏不是 `<aside>`**：vben 用 `div` + `role="complementary"`。选择器用 `[role=complementary], [class*=sidebar]`。
5. **跳转断言别用 `page.url()` 的 `not.toContain('/auth/login')`**：redirect 参数里带着 `/auth/login` 字符串，登录成功也会误判。用 `location.pathname`：
   ```typescript
   await expect.poll(async () => (await page.evaluate(() => location.pathname)), ...).not.toContain('/auth/login');
   ```
6. **滑块验证码是纯前端**（`SliderCaptcha` 组件，无后端校验）：拖到 wrapper 右缘（`offset = wrapperWidth - actionWidth - 6`）即 `checkPass`。1 步直拖即可，带兜底重试。定位：`getByText('请按住滑块拖动')` → 上溯两级取 wrapper → 拖 action 手柄。

### C. 通用

7. **`globalSetup` 无 baseURL**：相对路径 `goto('/#/auth/login')` 报 invalid URL，必须传绝对地址。
8. **登录类用例要显式覆盖 storageState**：`test.use({ storageState: { cookies: [], origins: [] } })`，否则带着全局登录态测登录，永远测不到登录页。

## 编写流程

1. **初始化**：四件套文件（config/global-setup/common/auth.ts），配置项按 checklist。
2. **先跑通最小链路**：登录成功 1 条 + 受保护页访问 1 条，本地跑通再扩展。
3. **写用例**：只 import common 的 `loginAs`/`setupApiMock`，不复写；断言用条件等待。
4. **计时基线**：跑全量，记录总耗时。性能不达标回查 checklist；单用例异常慢优先查 route 误拦 / 硬等 / 选择器重试。
5. **稳定性验证**：同一套用例连跑 2 次确认无 flaky（滑块/懒加载是重灾区）。

## 验证

- 本地：`npx playwright test --reporter=list`（观察总耗时与单用例耗时）
- 失败时检查 `.e2e-results/` 下 trace/screenshot/error-context.md 定位卡点
- 性能：总耗时 > 预期时，用 `--trace on` 单跑慢用例，对照 checklist 逐项排查
