/**
 * 根 build 编排：串行执行 cms 与 astro 生产构建。
 *
 * astro build 在页面全部生成并输出 "Complete!" 后，进程退出时会触发
 * Windows + Node v24 的 libuv 断言崩溃（退出码 0xC0000409），这是环境
 * 已知问题、与代码无关（见 docs/ 与工程记忆）。该崩溃发生在退出阶段，
 * 产物 dist/ 已完整生成。因此这里在确认 dist/index.html 存在的前提下，
 * 将该特定退出码视为已通过的构建，而非掩盖其它真实的构建失败。
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const cwd = process.cwd()

function run(cmd, args) {
  // shell: true —— Windows 下 pnpm 为 pnpm.cmd，需经 shell 解析
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true })
  return { status: r.status, signal: r.signal }
}
// 0xC0000409 -> 进程退出时的 libuv 崩溃码（已生成产物，非构建失败）
const LIBUV_EXIT = 3221226505

function astroBuildOk(prev) {
  if (prev.status === 0) return true
  if (prev.status !== LIBUV_EXIT) return false
  const built = [
    resolve(cwd, 'apps/astro/dist/index.html'),
    resolve(cwd, 'apps/astro/dist/articles'),
  ].every(existsSync)
  if (!built) {
    console.error('[build] astro 产物缺失，不能放行退出码。')
    return false
  }
  console.warn('[build] astro 页面已生成，忽略退出阶段的 libuv 环境崩溃。')
  return true
}

// 1) CMS 构建（含 TS 校验）
const cms = run('pnpm', ['cms:build'])
if (cms.status !== 0) {
  console.error('[build] CMS 构建失败。')
  process.exit(cms.status ?? 1)
}

// 2) Astro SSG 构建
const astro = run('pnpm', ['astro:build'])
if (!astroBuildOk(astro)) {
  console.error('[build] Astro 构建失败。')
  process.exit(astro.status ?? 1)
}

console.log('[build] 构建全部通过。')
process.exit(0)