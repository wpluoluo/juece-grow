import { expect } from '@playwright/test'
import { CMS_ORIGIN } from './origins'

/**
 * 后台 REST 客户端（e2e 专用工具，被 reminders / leads-assign / sites-clone 三个 spec 共用）。
 *
 * 约定（与 tests/security.spec.ts 的 C6 块同源）：
 *  - CMS origin 见 helpers/origins.ts（唯一定义处），鉴权走 `POST /api/users/login` 的 `payload-token` cookie
 *    （Users 集合 auth.loginWithUsername=true ⇒ 用 username 登录；未启用 API Key）。
 *  - 管理员凭据由 setup/global-setup.ts 从 gitignored 的 `.aiws/secrets/test-accounts.json`
 *    注入 CMS_ADMIN_USERNAME / CMS_ADMIN_PASSWORD；缺失时用例 skip，不造假凭据。
 *  - 所有断言走统一信封：成功 `{success:true,data}`，失败 `{success:false,error:{code,message}}`。
 */
export { CMS_ORIGIN }

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface Envelope {
  success: boolean
  data?: Record<string, unknown>
  error?: { code: string; message: string }
}

export interface Reply {
  status: number
  body: Record<string, unknown>
}

/** 关系字段在 depth=0 时是裸 id、depth>0 时是对象，统一取 id。 */
export function relId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const raw = typeof value === 'object' ? (value as { id?: unknown }).id : value
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

/**
 * 当前可用的全局管理员凭据；未注入时返回 null。
 * 返回 null 时由调用方在 spec 内 `test.skip(...)`，本模块不造假凭据。
 */
export function adminCredentials(): { username: string; password: string } | null {
  const username = process.env.CMS_ADMIN_USERNAME
  const password = process.env.CMS_ADMIN_PASSWORD
  return username && password ? { username, password } : null
}

async function toReply(res: Response): Promise<Reply> {
  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    parsed = { raw: text }
  }
  return { status: res.status, body: parsed }
}

async function request(method: Method, path: string, token: string | null, body?: unknown): Promise<Reply> {
  const res = await fetch(`${CMS_ORIGIN}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { cookie: `payload-token=${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return toReply(res)
}

export function login(username: string, password: string): Promise<Reply> {
  return request('POST', '/api/users/login', null, { username, password })
}

/** 登录全局管理员并返回 `{token,id}`；凭据缺失或登录失败直接抛错（用例应在 spec 内先 skip）。 */
export async function adminSession(): Promise<{ token: string; id: number }> {
  const creds = adminCredentials()
  if (!creds) throw new Error('CMS_ADMIN_USERNAME / CMS_ADMIN_PASSWORD 未注入：该用例应在 spec 内 test.skip')
  const res = await login(creds.username, creds.password)
  if (res.status !== 200) throw new Error(`管理员登录失败 ${res.status}：${JSON.stringify(res.body).slice(0, 200)}`)
  const token = String(res.body.token ?? '')
  const id = relId(res.body.user as { id?: number } | undefined) ?? 0
  if (!token) throw new Error('登录响应缺少 token')
  return { token, id }
}

export function getDoc(token: string, path: string): Promise<Reply> {
  return request('GET', path, token)
}

export function createDoc(token: string, path: string, data: Record<string, unknown>): Promise<Reply> {
  return request('POST', path, token, data)
}

export function updateDoc(token: string, path: string, data: Record<string, unknown>): Promise<Reply> {
  return request('PATCH', path, token, data)
}

export function deleteDoc(token: string, path: string): Promise<Reply> {
  return request('DELETE', path, token)
}

export interface FindOptions {
  where?: WhereClause[]
  limit?: number
  depth?: number
  sort?: string
}

export type WhereClause = [field: string, op: string, value: string | number | boolean]

/** 原生 REST 列表查询（Payload 的 `where[field][op]=value` 括号语法）。 */
export async function findDocs(token: string, slug: string, options: FindOptions = {}): Promise<Reply> {
  const params = new URLSearchParams()
  for (const [field, op, value] of options.where ?? []) params.append(`where[${field}][${op}]`, String(value))
  params.set('limit', String(options.limit ?? 50))
  params.set('depth', String(options.depth ?? 0))
  if (options.sort) params.set('sort', options.sort)
  return request('GET', `/api/${slug}?${params.toString()}`, token)
}

/** 列表查询并断言成功，返回 docs（读侧断言统一入口）。 */
export async function listDocs(
  token: string,
  slug: string,
  options: FindOptions = {},
): Promise<Record<string, unknown>[]> {
  const res = await findDocs(token, slug, options)
  expect(res.status, `查询 /api/${slug} 失败：${JSON.stringify(res.body).slice(0, 300)}`).toBe(200)
  return (res.body.docs as Record<string, unknown>[]) ?? []
}

/** 创建文档并断言 200/201，返回 id。 */
export async function createRequired(token: string, path: string, data: Record<string, unknown>): Promise<number> {
  const res = await createDoc(token, path, data)
  expect([200, 201], `创建 ${path} 失败：${JSON.stringify(res.body).slice(0, 300)}`).toContain(res.status)
  const doc = (res.body.doc as { id?: unknown } | undefined) ?? res.body
  return Number((doc as { id: unknown }).id)
}

/** 删除文档（404 视为已清理，其余状态断言成功）。 */
export async function deleteQuietly(token: string, path: string): Promise<void> {
  const res = await deleteDoc(token, path)
  expect([200, 204, 404], `清理 ${path} 失败：${JSON.stringify(res.body).slice(0, 300)}`).toContain(res.status)
}

/** 统一信封断言：成功响应。 */
export function expectOk(reply: Reply): Record<string, unknown> {
  expect(reply.status, `期望 2xx，实际 ${reply.status}：${JSON.stringify(reply.body).slice(0, 300)}`).toBe(200)
  const env = reply.body as unknown as Envelope
  expect(env.success, `响应缺少 success:true：${JSON.stringify(reply.body).slice(0, 300)}`).toBe(true)
  expect(env.data, '成功信封必须带 data').toBeDefined()
  return env.data as Record<string, unknown>
}

/** 统一信封断言：失败响应（错误码 + message 必填，且不泄露堆栈）。 */
export function expectErr(reply: Reply, status: number, code: string): void {
  expect(reply.status, `期望 ${status}，实际 ${reply.status}：${JSON.stringify(reply.body).slice(0, 300)}`).toBe(status)
  const env = reply.body as unknown as Envelope
  expect(env.success, `失败信封 success 必须为 false：${JSON.stringify(reply.body).slice(0, 300)}`).toBe(false)
  expect(env.error?.code, `错误码应为 ${code}：${JSON.stringify(reply.body).slice(0, 300)}`).toBe(code)
  expect(typeof env.error?.message).toBe('string')
  expect(env.error?.message ?? '').not.toMatch(/at .*\(.*:\d+:\d+\)/) // 不暴露内部堆栈
  expect(reply.body.data, '失败信封不得带 data').toBeUndefined()
}

/** ISO 字符串偏移（用于造 nextFollowUpAt；reminders 的 createdAt 是直接回填过去的绝对时间，不走本函数）。 */
export function isoFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

/** 直接发一次请求（负向用例需要自定义 header 时使用）。 */
export function rawRequest(method: Method, path: string, token: string | null, body?: unknown): Promise<Reply> {
  return request(method, path, token, body)
}

/** 以 text/plain 发请求体：用于断言自定义端点的 INVALID_JSON 分支（不能走 JSON 序列化）。 */
export async function postRawText(token: string, path: string, text: string): Promise<Reply> {
  const res = await fetch(`${CMS_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', cookie: `payload-token=${token}` },
    body: text,
  })
  return toReply(res)
}
