#!/usr/bin/env node
/**
 * Payload Postgres 备份脚本：对 juece-grow-postgres 容器执行 pg_dump，
 * 输出到 backups/，按策略清理旧备份。
 *
 * 用法：
 *   node scripts/backup.mjs                # 备份并保留最近 14 份
 *   node scripts/backup.mjs --keep 30      # 自定义保留份数
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

const CONTAINER = 'juece-grow-postgres'
const DB_USER = 'juece'
const DB_NAME = 'juece_grow'

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = join(backupsDir, `${DB_NAME}-${stamp}.sql`)

if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true })

let sql
try {
  sql = execFileSync('docker', ['exec', CONTAINER, 'pg_dump', '-U', DB_USER, '-d', DB_NAME], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
} catch (e) {
  console.error('[backup] pg_dump 失败。确认容器运行且命名正确：', CONTAINER)
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