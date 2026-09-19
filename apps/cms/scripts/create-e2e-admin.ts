/**
 * 一次性可重跑脚本：创建（或幂等更新）e2e 自动化测试用的「全局管理员」账号。
 *
 * 重建命令（仓库根执行，唯一入口）：
 *   pnpm --filter cms exec payload run scripts/create-e2e-admin.ts
 *
 * 约定：
 *  - 只走 Payload 官方本地 API（getPayload + payload.create/update），
 *    口令由 Payload 自身加盐哈希（bcrypt），脚本不拼 SQL、不碰 users 表列。
 *  - 口令写入 gitignored 的 `.aiws/secrets/test-accounts.json`（形状见同目录 example）；
 *    本脚本与任何日志都不打印口令。
 *  - 幂等：口令以 secrets 文件里已存值为准（存在即复用，不轮换）；
 *    账号按 username 唯一查找，存在则 update，绝不建出第二个 e2e-admin。
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload } from 'payload'

import config from '../src/payload.config'

// 纯数据脚本：不让 dev 模式把「drizzle pushSchema」顺带跑了（本库是 dev-push 库，
// 见 change 证据步骤 3.5）；置位后 @payloadcms/db-postgres connect.js:110 跳过 push。
process.env.PAYLOAD_MIGRATING = 'true'

/** 测试管理员用户名（与 apps/e2e/setup/global-setup.ts 读取的账号名一致）。 */
const USERNAME = 'e2e-admin'
const EMAIL = 'e2e-admin@e2e.test'
const DISPLAY_NAME = 'E2E 自动化测试管理员（重建命令见 apps/cms/scripts/create-e2e-admin.ts）'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SECRETS_FILE = path.join(REPO_ROOT, '.aiws', 'secrets', 'test-accounts.json')

interface StoredAccount {
  name: string
  username: string
  email: string
  password: string
  role: string
}

function randomPassword(): string {
  return `E2e!${randomBytes(18).toString('base64url')}`
}

interface SecretsFile {
  accounts: StoredAccount[]
  /** 顶层键按原样保留：本脚本只声明并补写自己需要的骨架，不删除其它条目。 */
  [key: string]: unknown
}

/** 仅在 secrets 文件不存在时使用的首次骨架。 */
const SKELETON: SecretsFile = {
  base_url: 'http://127.0.0.1:3000',
  services: {
    cms: { base_url: 'http://127.0.0.1:3000' },
    astro: { base_url: 'http://127.0.0.1:4321' },
  },
  auth: {
    type: 'login',
    login_path: '/api/users/login',
    username_field: 'username',
    password_field: 'password',
    token_cookie: 'payload-token',
  },
  accounts: [],
}

/** 读既有 secrets；文件不存在返回 null。 */
function readSecrets(): SecretsFile | null {
  if (!existsSync(SECRETS_FILE)) return null
  return JSON.parse(readFileSync(SECRETS_FILE, 'utf8')) as SecretsFile
}

/** secrets 里已存的口令；无则返回空串（由调用方生成新口令）。 */
function existingPassword(): string {
  return readSecrets()?.accounts.find((a) => a.username === USERNAME)?.password ?? ''
}

function writeSecrets(account: StoredAccount): void {
  const current = readSecrets()
  const others = (current?.accounts ?? []).filter((a) => a?.username !== USERNAME)
  // 已有文件：顶层键原样保留（可能含其它工具写入的条目），只换 accounts 里属于本脚本的那一条。
  const body: SecretsFile = { ...(current ?? SKELETON), accounts: [...others, account] }
  mkdirSync(path.dirname(SECRETS_FILE), { recursive: true })
  const tmp = `${SECRETS_FILE}.tmp`
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, SECRETS_FILE)
}

const payload = await getPayload({ config })

const stored = existingPassword()
const password = stored || randomPassword()

const data = {
  username: USERNAME,
  email: EMAIL,
  name: DISPLAY_NAME,
  role: 'admin' as const,
  password,
}

const found = await payload.find({
  collection: 'users',
  overrideAccess: true,
  where: { username: { equals: USERNAME } },
  limit: 10,
  depth: 0,
})

if (found.docs.length > 1) {
  throw new Error(`users 集合存在 ${found.docs.length} 个 ${USERNAME}，命名冲突，请先人工核实`)
}

const accountDoc =
  found.docs.length === 1
    ? await payload.update({
        collection: 'users',
        id: found.docs[0].id,
        overrideAccess: true,
        data,
      })
    : await payload.create({ collection: 'users', overrideAccess: true, data })

writeSecrets({ name: USERNAME, username: USERNAME, email: EMAIL, password, role: 'admin' })

console.info(
  `[e2e-admin] ${found.docs.length === 1 ? 'updated' : 'created'} users/${accountDoc.id} ` +
    `role=${accountDoc.role} passwordSource=${stored ? 'reused-from-secrets' : 'freshly-generated'} ` +
    `credentials=<见 .aiws/secrets/test-accounts.json>`,
)

await payload.destroy()
