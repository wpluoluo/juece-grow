#!/usr/bin/env node
/**
 * Payload Postgres 备份脚本：用服务器本机 `pg_dump` 导出，输出到 backups/，按策略清理旧备份。
 * 数据库连接不再依赖容器——生产走服务器原生 PostgreSQL；本地开发用容器暴露的 TCP 端口同样可连。
 * 连接串来源：--uri 参数 或 环境变量 DATABASE_URI（二者必给其一，无内置默认——不猜要备份哪个库）。
 *
 * 用法：
 *   DATABASE_URI='postgres://...' node scripts/backup.mjs          # 用环境连接串，保留最近 14 份
 *   node scripts/backup.mjs --uri '<connstr>'                      # 显式指定连接串
 *   node scripts/backup.mjs --uri '<connstr>' --keep 30            # 自定义保留份数
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const backupsDir = resolve(root, 'backups')

const args = process.argv.slice(2)
const keepIdx = args.indexOf('--keep')
const keep = keepIdx >= 0 ? Number(args[keepIdx + 1]) : 14
if (!Number.isInteger(keep) || keep <= 0) {
  console.error('[backup] --keep 必须是正整数。')
  process.exit(1)
}

const uriIdx = args.indexOf('--uri')
const uri = (uriIdx >= 0 && args[uriIdx + 1]) || process.env.DATABASE_URI
if (!uri) {
  console.error(
    '[backup] 缺少数据库连接串：传 --uri \'postgres://...\' 或设置环境变量 DATABASE_URI。' +
      '不提供内置默认，以免在错配的机器上备份到非预期的库。',
  )
  process.exit(1)
}
const url = new URL(uri)
const DB_NAME = url.pathname.replace(/^\//, '')
if (!DB_NAME) {
  console.error(
    `[backup] 连接串缺少库名：${url.protocol}//${url.username}@${url.host}。` +
      '不提供内置默认，以免备份到非预期的库并把文件名与旧备份清理前缀写错。',
  )
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = join(backupsDir, `${DB_NAME}-${stamp}.sql`)

if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true })

let sql
try {
  sql = execFileSync('pg_dump', ['--dbname', uri], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
} catch (e) {
  // 不回显完整连接串：口令会随 cron 邮件/日志外泄
  console.error(
    `[backup] pg_dump 失败。确认连接串正确且本机已安装 pg_dump：` +
      `${url.protocol}//${url.username}@${url.host}${url.pathname}（口令已隐去）`,
  )
  process.exit(1)
}
writeFileSync(file, sql)
console.log(`[backup] 备份完成：${file}`)

// 清理：只保留最新的 keep 份，按文件名时间序，旧的先删。
const files = readdirSync(backupsDir)
  .filter((name) => name.startsWith(`${DB_NAME}-`) && name.endsWith('.sql'))
  .sort()
const overflow = files.length - keep
for (let i = 0; i < overflow; i++) {
  unlinkSync(join(backupsDir, files[i]))
  console.log(`[backup] 已清理旧备份：${files[i]}`)
}
console.log(`[backup] 保留 ${Math.min(files.length, keep)} 份。`)