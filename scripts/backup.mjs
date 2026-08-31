#!/usr/bin/env node
/**
 * Payload Postgres 备份脚本：用服务器本机 `pg_dump` 导出，输出到 backups/，按策略清理旧备份。
 * 数据库连接不再依赖容器——生产走服务器原生 PostgreSQL；本地开发用容器暴露的 TCP 端口同样可连。
 * 连接串来源优先级：--uri 参数 > 环境变量 DATABASE_URI > 默认本地 5432。
 *
 * 用法：
 *   node scripts/backup.mjs                    # 用默认/环境连接串，保留最近 14 份
 *   node scripts/backup.mjs --uri '<connstr>'  # 显式指定连接串
 *   node scripts/backup.mjs --keep 30          # 自定义保留份数
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

const DEFAULT_URI = 'postgres://juece:juece@127.0.0.1:5432/juece_grow'
const uriIdx = args.indexOf('--uri')
const uri =
  (uriIdx >= 0 && args[uriIdx + 1]) || process.env.DATABASE_URI || DEFAULT_URI
const DB_NAME = new URL(uri).pathname.replace(/^\//, '') || 'juece_grow'

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
  console.error('[backup] pg_dump 失败。确认连接串正确且本机已安装 pg_dump：', uri)
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