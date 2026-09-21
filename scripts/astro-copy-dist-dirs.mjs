/**
 * 三站构建产物目录的唯一清单 + dist 新鲜度断言（quality HIGH-3 主项 / W-2 的修法）。
 *
 * 由 `astro-copy-render-diff.mjs` / `astro-copy-hero-diff.mjs` / `astro-copy-client-bundle.mjs` import，
 * 三站链条共享同一份清单与同一个校验（此前各自硬编码一份 dist 列表、且只做 existsSync）。
 *
 * 新鲜度判据：`apps/astro/src` 下文件的最大 mtime 必须严格早于每个 dist 目录内文件的最大 mtime。
 * 不用 gitRev 判：`astro-copy-render-text.mjs` 记录的 gitRev 是提取时的 HEAD，本 change 全程未提交
 * ⇒ 基线与本轮 HEAD 相同而工作树不同，比较 gitRev 分辨不出新鲜度。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const SRC_REL = 'apps/astro/src'

// 构建入口名真值 = 根 package.json scripts（astro:build / astro:build:erp / astro:build:yunque）。
export const DIST_SITES = [
  { site: 'juece', distRel: 'apps/astro/dist', buildScript: 'astro:build' },
  { site: 'erp', distRel: 'apps/astro/dist-erp', buildScript: 'astro:build:erp' },
  { site: 'yunque', distRel: 'apps/astro/dist-yunque', buildScript: 'astro:build:yunque' },
]

/** 目录（含子目录）内文件的最大 mtime（ms）；目录不存在返回 null，由调用方判为缺陷。 */
export function maxMtimeMs(dir) {
  if (!existsSync(dir)) return null
  let max = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = maxMtimeMs(abs)
      if (sub !== null && sub > max) max = sub
      continue
    }
    const t = statSync(abs).mtimeMs
    if (t > max) max = t
  }
  return max
}

/** 站点 → { site, distRel, distDir(绝对), buildCmd }；buildCmd 与根 package.json 不符即抛。 */
export function resolveDistSites(repoRoot) {
  const scripts = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).scripts
  return DIST_SITES.map(({ site, distRel, buildScript }) => {
    if (!(buildScript in scripts)) {
      throw new Error(`根 package.json 无 scripts.${buildScript} ⇒ 构建入口真值已漂，请核对后更新本清单`)
    }
    return { site, distRel, distDir: join(repoRoot, distRel), buildCmd: `pnpm ${buildScript}` }
  })
}

/**
 * 三站 dist 是否都比 `apps/astro/src` 新。
 * 返回 { rows（实测 mtime 明细，供日志留痕）, problems（非空即须红） }。
 */
export function checkDistFreshness(repoRoot) {
  const srcDir = join(repoRoot, SRC_REL)
  const srcMax = maxMtimeMs(srcDir)
  if (srcMax === null) {
    throw new Error(`缺源码目录 ${SRC_REL}，新鲜度无判据`)
  }
  const rows = []
  const problems = []
  for (const { site, distRel, distDir, buildCmd } of resolveDistSites(repoRoot)) {
    const distMax = maxMtimeMs(distDir)
    if (distMax === null) {
      problems.push(`${site}：缺构建产物 ${distRel} ⇒ 先跑 ${buildCmd}`)
      rows.push(`${site} ${distRel} = 不存在`)
      continue
    }
    const fresh = distMax > srcMax
    rows.push(
      `${site.padEnd(7)} ${distRel.padEnd(22)} dist最大mtime=${new Date(distMax).toISOString()} ` +
        `src最大mtime=${new Date(srcMax).toISOString()} 判定=${fresh ? '新鲜' : '陈旧'}`,
    )
    if (!fresh) {
      problems.push(
        `${site}：产物不新于源码（${distRel} 最大 mtime ${new Date(distMax).toISOString()} ` +
          `≤ ${SRC_REL} 最大 mtime ${new Date(srcMax).toISOString()}）⇒ 该站须重建：${buildCmd}`,
      )
    }
  }
  return { rows, problems }
}
