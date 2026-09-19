import { defineConfig } from '@playwright/test'
import { WEB_ORIGIN } from './helpers/origins'

export default defineConfig({
  testDir: './tests',
  // 用例级 30s。dev 下单路由冷编译实测 ~48s 会吃掉整个预算，故 setup/global-setup.ts 在跑测前预热各路由。
  timeout: 30_000,
  // 全链路串行：用例共用一个本地库与同一个管理员账号。
  // 1) Payload 3 默认 useSessions，登录时把 sessions 数组整体读-改-写回用户行，并发登录会互相顶掉会话，
  //    老 token 被降级为匿名（表现为 403，而非 401）——见 findings。
  // 2) reminders/leads-assign/sites-clone 用「快照 id 差集」自清，并行会误删其他文件的记录。
  fullyParallel: false,
  workers: 1,
  // 跑测前两步：1) 预热各路由（避开 dev 冷编译吃掉用例级 timeout，见上方注释）；
  // 2) 注入 .aiws/secrets/test-accounts.json 里的管理员凭据（CMS_ADMIN_USERNAME / CMS_ADMIN_PASSWORD），
  //    使 `pnpm --filter e2e test` 零参数即可跑到真断言；无凭据文件时保持用例 skip 语义。
  globalSetup: './setup/global-setup.ts',
  use: {
    baseURL: WEB_ORIGIN,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})