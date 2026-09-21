/**
 * 负向构建门禁（tasks 3.6 的机器对面，零手填参数）：CMS 拉不到时构建必须**硬失败**，不许静默出站。
 *
 * 为什么需要它：REQ-0003 非目标第 1 条与 D5 定了「构建期拉不到 CMS 即失败，不回退代码内旧文案」。
 * 这条性质用正向构建永远证不到（正向绿不代表失败路径有牙），而 P5 的 `content/*.ts` 已删除 ⇒
 * 一旦失败路径被写成 catch-and-continue，公开站会静默产出空白区块并照常上线。
 *
 * 做法：把 `PUBLIC_CMS_ORIGIN`（`src/lib/cmsOrigin.ts` 的唯一读取处，服务端构建期取数也走它）指向
 * 本机死端口，跑真实的 `pnpm astro:build`。不改 `apps/astro/.env`——进程环境变量优先级高于 `.env`
 * （Vite `loadEnv` 语义），断言里用「报错含该死端口」反过来证明覆盖真的生效了，避免假绿。
 *
 * 四条判定（任一不成立即非零退出）：
 *   1. 死端口确实没人监听（否则「拉不到」前提不成立，直接 FAIL）；
 *   2. 构建退出码 != 0（只要求非零：本机 Windows/Node24 的 Astro 退出阶段 libuv 崩溃会把 `1` 变成
 *      `3221226505`（日志 `231` 实测），按精确码判会造出一只随机闪红的门禁）；
 *   3. 输出含 `ECONNREFUSED` + 该端口 ⇒ 打的是死地址；含「不回退」⇒ 错误可读且指明硬失败口径；
 *   4. `apps/astro/dist` 下 HTML 计数 == 0 ⇒ 不产出空白区块（Astro 写盘前清空 outDir，失败即无产物）。
 *
 * 副作用（必须知道）：本脚本会让 `astro build` 失败一次，从而**清空 `apps/astro/dist`**（只影响主站；
 * `dist-erp`/`dist-yunque` 不动）⇒ 四道逐字一致产物门禁须在它之前跑完，或在它之后重建主站再跑。
 *
 * 用法：`node scripts/astro-copy-cms-unreachable.mjs`
 */
import { connect } from 'node:net'
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASTRO_ROOT = path.join(REPO_ROOT, 'apps', 'astro')
const DEAD_PORT = 59999
const DEAD_ORIGIN = `http://127.0.0.1:${DEAD_PORT}`

/** 端口是否可连。可连即死端口前提不成立。 */
function portListenable() {
  return new Promise((resolve) => {
    const sock = connect({ host: '127.0.0.1', port: DEAD_PORT })
    const done = (value) => {
      sock.destroy()
      resolve(value)
    }
    sock.setTimeout(1500)
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
  })
}

/** 产物目录里的 HTML 计数（递归）；目录不存在即 0。 */
function countHtml(dir) {
  if (!existsSync(dir)) return 0
  let n = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countHtml(path.join(dir, entry.name))
    else if (entry.name.endsWith('.html')) n += 1
  }
  return n
}

const failures = []
const listenable = await portListenable()
if (listenable) {
  failures.push(`死端口前提不成立：${DEAD_ORIGIN} 可连接 ⇒ 本轮不构成「拉不到 CMS」`)
}

let build = { status: null, text: '' }
if (!listenable) {
  const ran = spawnSync('pnpm astro:build', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, PUBLIC_CMS_ORIGIN: DEAD_ORIGIN },
  })
  build = { status: ran.status, text: `${ran.stdout ?? ''}${ran.stderr ?? ''}${ran.error?.message ?? ''}` }
}

const html = countHtml(path.join(ASTRO_ROOT, 'dist'))
const hitRefused = build.text.includes('ECONNREFUSED') && build.text.includes(String(DEAD_PORT))
const hitReadable = build.text.includes('不回退')

if (failures.length === 0 && build.status === 0) {
  failures.push(`构建意外成功（exit=0）：拉不到 CMS 仍产出页面 ⇒ 失败路径被写成了静默兜底（dist HTML=${html}）`)
}
if (failures.length === 0 && build.status === null) {
  failures.push('构建进程没跑起来（spawn 失败），本轮什么都没证到')
}
if (!hitRefused) failures.push('构建输出未出现 ECONNREFUSED + 死端口号 ⇒ 无法证明取数打的是死地址（可能进程 env 没覆盖 .env）')
if (!hitReadable) failures.push('构建输出未出现「不回退」⇒ 错误不可读：没说明硬失败口径（PROB-028）')
if (html !== 0) failures.push(`失败构建仍产出 ${html} 个 HTML ⇒ 会发布空白区块`)

console.log(
  `[cms-unreachable] dead_origin=${DEAD_ORIGIN} 可连接=${listenable} build_exit=${build.status} ` +
    `ECONNREFUSED+端口命中=${hitRefused} 可读错误命中=${hitReadable} dist_html=${html}`,
)
for (const f of failures) console.log(`  FAIL ${f}`)
console.log(failures.length === 0 ? '判定=OK：拉不到 CMS 即非零退出、错误可读、无产物' : '判定=FAIL')
process.exitCode = failures.length === 0 ? 0 : 1
