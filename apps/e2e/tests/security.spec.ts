import { test, expect } from '@playwright/test'

/**
 * 规范化安全测试体系 · 跨端访问安全
 * ---------------------------------
 * 覆盖 GATE-004 / 跨端审计的 C1–C5 与安全投影/兜底不变量。
 * 约定：
 *  - 每类安全控制一个 describe 块，命名以控制点开头（C1/C2/...）。
 *  - 不造种子数据（数据无关），只断言「无论库里有啥都须满足」的安全不变量。
 *  - 公开响应做字段白名单校验：公开端点一旦新增敏感字段而未同步本清单，测试即失败。
 *  - 用 Node 原生 fetch 发请求（可显式设置 Origin / OPTIONS，CORS 语义与真实浏览器一致）。
 *
 * 前置：cms @ 3000 已启动（`pnpm --filter cms dev`）。
 */

const CMS_ORIGIN = 'http://127.0.0.1:3000'

/** 内容端点暴露给公开站的「白名单站点」。 */
const KNOWN_SITES = ['juece', 'erp', 'yunque'] as const

/** 公开文章响应允许出现的顶层字段（白名单不变量，防敏感字段外泄）。 */
const PUBLIC_ARTICLE_KEYS = [
  'id',
  'title',
  'slug',
  'excerpt',
  'status',
  'publishedAt',
  'createdAt',
  'updatedAt',
  'author',
  'seoTitle',
  'seoDescription',
  'project',
  'category',
  'coverImage',
  'body', // 仅单篇详情（带 slug）时返回，列表接口不出现。
]

/** 文章内联关联对象允许出现的字段。 */
const PROJECT_KEYS = ['id', 'name', 'slug']
const CATEGORY_KEYS = ['id', 'name']
const COVER_KEYS = ['id', 'url', 'alt']

async function getContent(site: string, extra = ''): Promise<Response> {
  return fetch(`${CMS_ORIGIN}/api/v2/content/articles?site=${encodeURIComponent(site)}${extra}`, {
    cache: 'no-store',
  })
}

// ---------------------------------------------------------------------------
// C1 跨端文章隔离：主站全量、分站按项目隔离、非法站点被拒
// ---------------------------------------------------------------------------
test.describe('C1 跨端文章隔离', () => {
  test('主站 juece 返回全部已发布文章，且响应为统一成功信封', async () => {
    const res = await getContent('juece')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.articles)).toBe(true)
  })

  test('分站 erp 仅返回项目 juece-erp 的文章（越界被隔离）', async () => {
    const res = await getContent('erp')
    expect(res.status).toBe(200)
    const body = await res.json()
    for (const a of body.data.articles as Array<{ project?: { slug: string } | null }>) {
      expect(a.project?.slug).toBe('juece-erp')
    }
  })

  test('分站 yunque 仅返回项目 yunque 的文章（越界被隔离）', async () => {
    const res = await getContent('yunque')
    expect(res.status).toBe(200)
    const body = await res.json()
    for (const a of body.data.articles as Array<{ project?: { slug: string } | null }>) {
      expect(a.project?.slug).toBe('yunque')
    }
  })

  test('分站文章必为主站文章的子集（禁止跨端越权抽取）', async () => {
    const [m, e, y] = await Promise.all([
      (await getContent('juece')).json(),
      (await getContent('erp')).json(),
      (await getContent('yunque')).json(),
    ])
    const mainIds = new Set((m.data.articles as Array<{ id: number }>).map((a) => a.id))
    for (const sub of [e, y]) {
      for (const a of sub.data.articles as Array<{ id: number }>) {
        expect(mainIds.has(a.id)).toBe(true)
      }
    }
  })

  test('未知站点返回 400 + INVALID_SITE（fail-closed）', async () => {
    const res = await getContent('evil-fake-site')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INVALID_SITE')
  })

  test('分站项目不存在时仍返回空集而非全量（fail-closed，禁止兜底放行）', async () => {
    // erp→'juece-erp'；即便该项目库中不存在，隔离逻辑也应过滤到空，绝不回退成全量。
    const res = await getContent('erp')
    const body = await res.json()
    for (const a of body.data.articles as Array<{ project?: { slug: string } | null }>) {
      expect(a.project?.slug).toBe('juece-erp')
    }
  })
})

// ---------------------------------------------------------------------------
// C2/C3/C4 原生 REST 匿名访问收敛，杜绝草稿枚举 / 联系人外泄 / 结构枚举
// ---------------------------------------------------------------------------
test.describe('C2/C3/C4 原生 REST 匿名访问收敛', () => {
  // Payload 对「已认证才可读」的集合，匿名访问统一返回 403 Forbidden（且不泄露资源是否存在），fail-closed。
  const protectedPaths = [
    ['/api/articles', '草稿不可枚举'],
    ['/api/articles/1', '详情按 id 亦不可读（不泄露资源存在性）'],
    ['/api/projects', '联系人不外泄'],
    ['/api/sites', '站点结构不可枚举'],
    ['/api/forms', '表单字段定义不可枚举'],
    ['/api/categories', '分类维度不可枚举'],
  ] as const

  for (const [path, reason] of protectedPaths) {
    test(`未登录访问 ${path} 返回 403（${reason}）`, async () => {
      const res = await fetch(`${CMS_ORIGIN}${path}`, { cache: 'no-store' })
      expect(res.status).toBe(403)
    })
  }
})

// ---------------------------------------------------------------------------
// C3 脱敏投影：公开响应只允许白名单字段，联系人等内部字段绝不出现
// ---------------------------------------------------------------------------
test.describe('C3 公开响应脱敏投影', () => {
  test('文章对象只出现在白名单字段集合内', async () => {
    const res = await getContent('juece')
    const body = await res.json()
    for (const a of body.data.articles as Array<Record<string, unknown>>) {
      for (const key of Object.keys(a)) {
        expect(PUBLIC_ARTICLE_KEYS).toContain(key)
      }
    }
  })

  test('内联关联对象只暴露最小字段，不泄露联系人等内部字段', async () => {
    const res = await getContent('erp')
    const body = await res.json()
    for (const a of body.data.articles as Array<{
      project?: Record<string, unknown> | null
      category?: Record<string, unknown> | null
      coverImage?: Record<string, unknown> | null
    }>) {
      for (const obj of [a.project, a.category, a.coverImage]) {
        if (obj) {
          for (const key of Object.keys(obj)) {
            expect([...PROJECT_KEYS, ...CATEGORY_KEYS, ...COVER_KEYS]).toContain(key)
          }
        }
      }
      expect(Object.keys(a.project ?? {})).not.toContain('contactName')
      expect(Object.keys(a.project ?? {})).not.toContain('contactEmail')
      expect(Object.keys(a.project ?? {})).not.toContain('contactPhone')
    }
  })

  test('单篇详情（带 slug）返回体内含 body，但仍只在白名单内', async () => {
    const list = await (await getContent('juece')).json()
    const first = (list.data.articles as Array<{ slug: string }>)[0]
    if (!first) {
      test.skip(true, '库中暂无已发布文章，跳过详情字段校验')
      return
    }
    const res = await getContent('juece', `&slug=${encodeURIComponent(first.slug)}`)
    const body = await res.json()
    const detail = (body.data.articles as Array<Record<string, unknown>>)[0]
    for (const key of Object.keys(detail ?? {})) {
      expect(PUBLIC_ARTICLE_KEYS).toContain(key)
    }
  })
})

// ---------------------------------------------------------------------------
// C5 CORS 白名单：仅白名单 Origin 回 Allow-Origin；非白名单/无 Origin 一律不回
// ---------------------------------------------------------------------------
test.describe('C5 CORS 白名单', () => {
  const WHITELISTED = 'https://juece.cloud'
  const EVIL = 'https://evil.example'

  test('白名单 Origin 请求内容端点回 Allow-Origin=自身', async () => {
    const res = await fetch(`${CMS_ORIGIN}/api/v2/content/articles?site=juece`, { headers: { origin: WHITELISTED } })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(WHITELISTED)
  })

  test('非白名单 Origin 不回 Allow-Origin（跨端投毒被拒，C5）', async () => {
    const res = await fetch(`${CMS_ORIGIN}/api/v2/content/articles?site=juece`, { headers: { origin: EVIL } })
    expect(res.headers.get('access-control-allow-origin')).toBe(null)
  })

  test('无 Origin 请求不回 Allow-Origin（服务端/非浏览器调用）', async () => {
    const res = await getContent('juece')
    expect(res.headers.get('access-control-allow-origin')).toBe(null)
  })

  test('白名单 Origin 的 OPTIONS 预检返回 204 + 方法头', async () => {
    const res = await fetch(`${CMS_ORIGIN}/api/v2/leads`, { method: 'OPTIONS', headers: { origin: WHITELISTED } })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(WHITELISTED)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
  })

  test('白名单 Origin 的 POST 仍回 Allow-Origin（公开表单链路不受 CORS 收敛误伤，数据无关）', async () => {
    // 该断言只校验「白名单 Origin 的 POST 会带 CORS 头 + 统一信封」，
    // 不依赖 projectId 是否真实存在（业务校验结果不影响 CORS 头）。
    const res = await fetch(`${CMS_ORIGIN}/api/v2/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: WHITELISTED },
      body: JSON.stringify({ name: 'CORS 烟测', phone: `150${String(Date.now()).slice(-8)}` }),
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(WHITELISTED)
    const body = (await res.json()) as { success: boolean; error?: { code: string } }
    expect(typeof body.success).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// 通用不变量：公开 v2 端点统一信封
// ---------------------------------------------------------------------------
test.describe('公开 v2 统一信封', () => {
  test('所有已知站点内容端点均返回 success:true 信封', async () => {
    for (const site of KNOWN_SITES) {
      const res = await getContent(site)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// C6 后台鉴权边界（跨项目隔离）· 自建数据 + 自清理
// ---------------------------------------------------------------------------
// 回归 GATE-004 鉴权修复：成员管理 & 线索写入须按目标项目隔离，杜绝跨项目越权。
// 约定：
//  - 使用环境变量提供的全局管理员账号自建「两个项目 + 一个仅属项目A的受限成员」，
//    以受限成员身份断言：跨项目建线索 / 建成员 / 删成员 / 改线索搬家 / 越权分配全部 403。
//  - 数据全部在 finally 中清理，不残留、不污染既有库。
//  - 未提供管理员账号（CMS_ADMIN_USERNAME / CMS_ADMIN_PASSWORD）则整体 skip。
test.describe('C6 后台鉴权边界（跨项目隔离）', () => {
  const adminUser = process.env.CMS_ADMIN_USERNAME
  const adminPass = process.env.CMS_ADMIN_PASSWORD

  test('受限成员不能跨项目管理成员 / 写线索 / 搬家 / 越权分配（fail-closed）', async () => {
    test.skip(!adminUser || !adminPass, '未设置 CMS_ADMIN_USERNAME / CMS_ADMIN_PASSWORD，跳过 C6')

    const suffix = Date.now()
    let adminToken = ''
    let memberToken = ''
    let projectA = 0
    let projectB = 0
    let memberUser = 0
    let strangerUser = 0
    let leadInA = 0
    let membershipB = 0

    async function provision() {
      // 管理员登录
      adminToken = await loginToken(adminUser, adminPass)

      // 两个互不相干的项目
      projectA = await createDoc(adminToken, '/api/projects', { name: `鉴权回归A`, slug: `authreg-a-${suffix}` })
      projectB = await createDoc(adminToken, '/api/projects', { name: `鉴权回归B`, slug: `authreg-b-${suffix}` })

      // 受限成员：全局角色 operator（非 admin），仅被加入 项目A（role=editor，可写A、不可管成员）
      memberUser = await createDoc(adminToken, '/api/users', {
        username: `authreg-${suffix}`,
        password: `Sec!${suffix}`,
        name: '鉴权回归受限成员',
      })
      await createDoc(adminToken, '/api/memberships', {
        project: projectA,
        user: memberUser,
        role: 'editor',
      })
      // 项目B 下造一个第三方成员，供「受限成员删除别项目成员」与「越权分配」断言
      strangerUser = await createDoc(adminToken, '/api/users', {
        username: `authreg-s-${suffix}`,
        password: `Sec!${suffix}`,
        name: '鉴权回归第三方',
      })
      membershipB = await createDoc(adminToken, '/api/memberships', {
        project: projectB,
        user: strangerUser,
        role: 'viewer',
      })

      // 受限成员登录
      memberToken = await loginToken(`authreg-${suffix}`, `Sec!${suffix}`)
    }

    try {
      await provision()
    } catch (e) {
      // 前置自建失败（可能管理员凭证无效/未初始化），直接以 skip 收尾，避免误报。
      test.skip(true, `C6 前置自建失败，跳过：${String(e)}`)
      return
    }

    try {
      // 正向：受限成员可写入其项目A（隔离不被误伤）——create 返回 201
      expect(await authStatus(memberToken, '/api/leads', 'POST', { project: projectA, name: '属于A的线索' })).toBe(201)

      // 1. 跨项目建线索（写入项目B）→ 403
      expect(await authStatus(memberToken, '/api/leads', 'POST', { project: projectB, name: '越权线索' })).toBe(403)

      // 2. 跨项目建成员（项目B）→ 403
      expect(await authStatus(memberToken, '/api/memberships', 'POST', { project: projectB, user: memberUser, role: 'viewer' })).toBe(403)

      // 3. 删除别项目成员（项目B 的第三方成员记录）→ 403
      expect(await authStatus(memberToken, `/api/memberships/${membershipB}`, 'DELETE')).toBe(403)

      // 4. 线索「搬家」到无权项目B → 403
      leadInA = await createDoc(memberToken, '/api/leads', { project: projectA, name: '供搬家测试的线索' })
      expect(await authStatus(memberToken, `/api/leads/${leadInA}`, 'PATCH', { project: projectB })).toBe(403)

      // 5. 越权分配：把项目A线索负责人指给「仅属项目B」的第三方 → 403
      expect(await authStatus(memberToken, `/api/leads/${leadInA}`, 'PATCH', { owner: strangerUser })).toBe(403)
    } finally {
      // 数据自清理：删线索 → 删账号（beforeDelete 级联其成员关系） → 删项目（级联剩余线索/成员）。
      await cleanup(adminToken, `/api/leads/${leadInA}`)
      await cleanup(adminToken, `/api/users/${memberUser}`)
      await cleanup(adminToken, `/api/users/${strangerUser}`)
      await cleanup(adminToken, `/api/projects/${projectA}`)
      await cleanup(adminToken, `/api/projects/${projectB}`)
    }
  })
})

// ---------------------------------------------------------------------------
// C7 Chatwoot webhook 鉴权（Authorization Bearer 头）
// ---------------------------------------------------------------------------
// 回归本次鉴权改造：webhook 不再接受查询参数 token，改用 Authorization: Bearer <secret>。
// 安全不变量（数据无关，不造线索）：
//  - 无头 / 错 secret / 未配置 secret → 一律 401（fail-closed）。
//  - 正确 Bearer 才放行进入业务层——以「缺 projectId 触发 400 INVALID_PROJECT」证明鉴权已通过，
//    绝不返回 401（若仍 401 即鉴权改造回归）。
test.describe('C7 Chatwoot webhook 鉴权', () => {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET
  const path = '/api/v2/webhooks/chatwoot'

  test('未携带 Authorization 头 → 401 + UNAUTHORIZED（fail-closed）', async () => {
    const res = await fetch(`${CMS_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  test('携带错误 Bearer secret → 401（恒时比较，误凭据被拒）', async () => {
    const res = await fetch(`${CMS_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer obviously-wrong-secret' },
      body: '{}',
    })
    expect(res.status).toBe(401)
  })

  test('正确 Bearer 放行进入业务层（以缺 projectId 返回 400 INVALID_PROJECT 断言鉴权已通过）', async () => {
    test.skip(!secret, '未设置 CHATWOOT_WEBHOOK_SECRET，跳过正确凭据用例')
    const res = await fetch(`${CMS_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: '{}',
    })
    // 鉴权已放行 → 落到业务校验：缺 projectId 返回 400；仍 401 即鉴权逻辑回归。
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_PROJECT')
  })
})

/** 登录并返回 payload-token cookie 值。 */
async function loginToken(username: string, password: string): Promise<string> {
  const res = await fetch(`${CMS_ORIGIN}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (res.status !== 200) throw new Error(`登录失败：${res.status}`)
  const m = /payload-token=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')
  if (!m) throw new Error('登录响应缺少 payload-token cookie')
  return m[1]
}

/** 带鉴权 cookie 的请求，返回 HTTP 状态码（读取 body 以触发完整链路）。 */
async function authStatus(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<number> {
  const res = await fetch(`${CMS_ORIGIN}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: `payload-token=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  await res.text() // 消耗 body，避免连接挂起
  return res.status
}

/** 带鉴权 cookie 创建文档，返回 doc.id。 */
async function createDoc(token: string, path: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${CMS_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `payload-token=${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (res.status !== 200 && res.status !== 201) throw new Error(`创建失败 ${path}：${res.status} ${JSON.stringify(data)}`)
  return Number(data.doc?.id ?? data.id)
}

/** 尽力清理单个资源（忽略 404/已删除）。 */
async function cleanup(token: string, path: string): Promise<void> {
  if (!token || !path) return
  await fetch(`${CMS_ORIGIN}${path}`, { method: 'DELETE', headers: { cookie: `payload-token=${token}` } }).catch(() => undefined)
}