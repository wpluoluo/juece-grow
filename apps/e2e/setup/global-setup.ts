import { connect } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CMS_ORIGIN, WEB_ORIGIN } from '../helpers/origins'

/**
 * Playwright globalSetup：跑测前两件事——路由预热 + 注入管理员凭据，使 `pnpm --filter e2e test` 零参数可跑。
 *
 * 凭据来源（gitignored）：`.aiws/secrets/test-accounts.json` 的 accounts[].username === 'e2e-admin'。
 * 重建该账号（仓库根执行，唯一入口）：
 *   pnpm --filter cms exec payload run scripts/create-e2e-admin.ts
 *
 * 文件不存在 / 无该账号时：不抛错、不写默认值，保持既有的「无 CMS_ADMIN_* ⇒ 用例 skip」行为。
 */

/** 与 apps/cms/scripts/create-e2e-admin.ts 中的账号名保持一致。 */
const ADMIN_ACCOUNT = 'e2e-admin'

const SECRETS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.aiws',
  'secrets',
  'test-accounts.json',
)

interface StoredAccount {
  username?: string
  password?: string
}

/**
 * 待预热端点。next dev(Turbopack) 只在**首次请求**时编译路由，本地实测单路由冷编译 ~48s，
 * 大于 playwright.config.ts 的用例级 30s 预算 ⇒ 不预热会把「编译慢」报成「功能超时」（本批实测踩过）。
 * `/api/v2/leads` 用 GET：与 POST 提交处理器同一模块，命中即完成编译，且 405 不写任何数据。
 */
const WARM_TARGETS = [
  `${WEB_ORIGIN}/`,
  `${CMS_ORIGIN}/api/v2/health`,
  `${CMS_ORIGIN}/api/v2/content/articles?site=juece`,
  `${CMS_ORIGIN}/api/v2/leads`,
  // reminders/run 与上一条 leads 一样只导出 POST：GET 命中 405 即完成编译，不写数据、不触发提醒扫描。
  `${CMS_ORIGIN}/api/v2/reminders/run`,
  // Payload 集合 CRUD 与自定义端点（/api/leads/assign、/api/sites/clone）共用
  // src/app/(payload)/api/[...slug]/route.ts 这一个捕获路由；未登录 GET 返回 403，不读不写。
  `${CMS_ORIGIN}/api/leads`,
]

export default async function globalSetup(): Promise<void> {
  await warmUpRoutes()
  await injectAdminCredentials()
}

/** 端口是否在监听：用 TCP 连接判定，不用 HTTP——冷编译会让探测本身超时。 */
function listening(origin: string): Promise<boolean> {
  const { hostname, port } = new URL(origin)
  return new Promise((resolve) => {
    const sock = connect({ host: hostname, port: Number(port) })
    const done = (value: boolean) => {
      sock.destroy()
      resolve(value)
    }
    sock.setTimeout(2000)
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
  })
}

async function warmUpRoutes(): Promise<void> {
  // 每个 origin 只探测一次端口，预热只覆盖在监听的那个：
  // 「CMS 已起、astro 没起」时 CMS 路由照样该被编译，否则白付冷编译（见文件头注释的根因）。
  const up = new Map<string, boolean>([
    [CMS_ORIGIN, await listening(CMS_ORIGIN)],
    [WEB_ORIGIN, await listening(WEB_ORIGIN)],
  ])
  if (![...up.values()].some(Boolean)) {
    console.info('[e2e] 未检测到 CMS dev(:3000) 与公开站 dev(:4321)：跳过预热，由用例自身的连接错误指明未启动服务')
    return
  }
  for (const url of WARM_TARGETS) {
    if (!up.get(new URL(url).origin)) {
      console.info(`[e2e] 跳过预热 ${url}（所属服务未监听）`)
      continue
    }
    const started = Date.now()
    let outcome: string
    try {
      outcome = String((await fetch(url, { signal: AbortSignal.timeout(180_000) })).status)
    } catch (e) {
      const err = e as { name?: string; message?: string; cause?: { message?: string } }
      outcome = `ERROR ${err.name ?? ''} ${err.cause?.message ?? err.message ?? ''}`.trim()
    }
    console.info(`[e2e] 预热 ${url} -> ${outcome} (${Date.now() - started}ms)`)
  }
}

async function injectAdminCredentials(): Promise<void> {
  if (!existsSync(SECRETS_FILE)) {
    console.info(`[e2e] 未找到 ${SECRETS_FILE}：管理员相关用例将跳过（重建：pnpm --filter cms exec payload run scripts/create-e2e-admin.ts）`)
    return
  }
  const raw = JSON.parse(readFileSync(SECRETS_FILE, 'utf8')) as { accounts?: StoredAccount[] }
  const account = (raw.accounts ?? []).find((a) => a?.username === ADMIN_ACCOUNT)
  if (!account?.password) {
    console.info(`[e2e] ${SECRETS_FILE} 中无 ${ADMIN_ACCOUNT} 账号：管理员相关用例将跳过`)
    return
  }
  process.env.CMS_ADMIN_USERNAME = account.username as string
  process.env.CMS_ADMIN_PASSWORD = account.password
  console.info(`[e2e] 已注入管理员凭据 CMS_ADMIN_USERNAME=${account.username}（口令值不外泄）`)
}
