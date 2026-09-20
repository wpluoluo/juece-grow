import { expect, test } from '@playwright/test'

import {
  adminCredentials,
  adminSession,
  createRequired,
  deleteQuietly,
  expectErr,
  expectOk,
  getDoc,
  listDocs,
  login,
  rawRequest,
  relId,
} from '../helpers/cmsRest'

/**
 * POST /api/sites/clone 端到端覆盖（Payload 自定义端点，见 apps/cms/src/collections/Sites.ts 的 endpoints）。
 *
 * 覆盖点（此前零覆盖）：
 *  1. 克隆产出可查：统一成功信封 data{id,name}，新站点字段按设计复制（subdomain/pathSlug/themeColor/SEO），
 *     且强制 status=draft、isTemplate=false（副本不得继承「已发布/模板」身份）。
 *  2. 与原站点不串：克隆不改源站任何字段；未显式命名时副本名为「<源站名> 副本」；两个副本互不影响。
 *  3. 跨项目落盘：显式 projectId 时克隆进目标项目，源站仍在原项目。
 *  4. 负向信封：未登录 401 UNAUTHORIZED；缺/非法 sourceId 400 MISSING_SOURCE；
 *     sourceId 指向不存在的记录 404 SOURCE_NOT_FOUND（不得被 findByID 抛的 NotFound 混成 500，同 PROB-005 口径）；
 *     projectId 非法 400 INVALID_PROJECT；仅有查看权限的项目成员 403 FORBIDDEN（memberCanWrite=false）。
 *  5. 测后删除克隆体并确认 404。
 *
 * 造数边界：专属测试项目/站点/账号，afterAll 删项目（Sites 随之级联）与账号。
 * 前置：CMS dev @3000；管理员凭据由 setup/global-setup.ts 注入，缺失时整块 skip。
 */

const TS = Date.now()
const TAG = `e2e站点${TS}`
const SOURCE_NAME = `${TAG}源站`
const VIEWER_USERNAME = `e2e-site-viewer-${TS}`
/** 一次性测试账号口令：随进程生成、用例结束即删除，非持久凭据。 */
const VIEWER_PASSWORD = `E2eview!${TS}`

/** 端点应复制过去的字段。 */
const COPIED_FIELDS = ['subdomain', 'pathSlug', 'themeColor', 'metaTitle', 'metaDescription'] as const

let adminToken = ''
let projectA = 0
let projectB = 0
let sourceSite = 0
let viewerToken = ''
let viewerUser = 0

test.describe('站点复制 POST /api/sites/clone', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!adminCredentials(), '未提供 CMS 管理员凭据（.aiws/secrets/test-accounts.json），跳过')

  test.beforeAll(async () => {
    const session = await adminSession()
    adminToken = session.token

    projectA = await createRequired(adminToken, '/api/projects', { name: `${TAG}A`, slug: `e2e-site-a-${TS}` })
    projectB = await createRequired(adminToken, '/api/projects', { name: `${TAG}B`, slug: `e2e-site-b-${TS}` })

    sourceSite = await createRequired(adminToken, '/api/sites', {
      name: SOURCE_NAME,
      project: projectA,
      subdomain: `e2esrc${TS}`,
      pathSlug: '/e2e-src',
      themeColor: '#2f8f96',
      metaTitle: `${TAG}源站标题`,
      metaDescription: `${TAG}源站摘要`,
      status: 'published',
      isTemplate: true,
    })

    viewerUser = await createRequired(adminToken, '/api/users', {
      username: VIEWER_USERNAME,
      password: VIEWER_PASSWORD,
      name: `${TAG}只读成员`,
      role: 'operator',
    })
    await createRequired(adminToken, '/api/memberships', { project: projectA, user: viewerUser, role: 'viewer' })
    const viewer = await login(VIEWER_USERNAME, VIEWER_PASSWORD)
    expect(viewer.status, '只读成员登录失败').toBe(200)
    viewerToken = String(viewer.body.token ?? '')
    expect(viewerToken).not.toBe('')
  })

  test.afterAll(async () => {
    await deleteQuietly(adminToken, `/api/projects/${projectA}`)
    await deleteQuietly(adminToken, `/api/projects/${projectB}`)
    await deleteQuietly(adminToken, `/api/users/${viewerUser}`)
    expect(await listDocs(adminToken, 'sites', { where: [['project', 'equals', projectA]] })).toHaveLength(0)
    expect(await listDocs(adminToken, 'sites', { where: [['project', 'equals', projectB]] })).toHaveLength(0)
    expect(await listDocs(adminToken, 'memberships', { where: [['user', 'equals', viewerUser]] })).toHaveLength(0)
  })

  test('正向：克隆体字段可查、状态与模板位被重置，源站不受影响', async () => {
    const before = await readSite(sourceSite)
    const data = expectOk(
      await rawRequest('POST', '/api/sites/clone', adminToken, { sourceId: sourceSite, name: `${TAG}副本一` }),
    )
    const cloneId = Number(data.id)
    expect(Number.isInteger(cloneId) && cloneId > 0, `克隆未返回合法 id：${JSON.stringify(data)}`).toBe(true)
    expect(cloneId, '克隆必须是一条新记录').not.toBe(sourceSite)
    expect(String(data.name)).toBe(`${TAG}副本一`)
    // 响应面只允许 {id, name}：端点一旦直出整份站点文档（关系字段会带出项目/成员等内部对象）即红。
    expect(Object.keys(data).sort(), `克隆响应字段面异常：${JSON.stringify(data)}`).toEqual(['id', 'name'])

    const clone = await readSite(cloneId)
    expect(clone.name).toBe(`${TAG}副本一`)
    expect(relId(clone.project)).toBe(projectA)
    for (const field of COPIED_FIELDS) {
      expect(clone[field], `字段 ${field} 未从源站复制`).toBe(before[field])
    }
    expect(clone.status, '副本不应继承源站的已发布状态').toBe('draft')
    expect(clone.isTemplate, '副本不应继承模板位').toBe(false)

    // 源站逐字段不变（不串）。
    const after = await readSite(sourceSite)
    expect(after.name).toBe(SOURCE_NAME)
    expect(after.status).toBe('published')
    expect(after.isTemplate).toBe(true)
    expect(relId(after.project)).toBe(projectA)
    for (const field of COPIED_FIELDS) expect(after[field]).toBe(before[field])

    // 测后删除克隆体，并确认真的查不到了。
    await deleteQuietly(adminToken, `/api/sites/${cloneId}`)
    expect((await getDoc(adminToken, `/api/sites/${cloneId}?depth=0`)).status).toBe(404)
  })

  test('未显式命名时副本名为「<源站名> 副本」，且两个副本互不干扰', async () => {
    const first = expectOk(await rawRequest('POST', '/api/sites/clone', adminToken, { sourceId: sourceSite }))
    expect(String(first.name)).toBe(`${SOURCE_NAME} 副本`)

    const second = expectOk(
      await rawRequest('POST', '/api/sites/clone', adminToken, { sourceId: sourceSite, name: `${TAG}副本二` }),
    )
    expect(Number(second.id)).not.toBe(Number(first.id))
    expect(String(second.name)).toBe(`${TAG}副本二`)

    const firstAfter = (await getDoc(adminToken, `/api/sites/${Number(first.id)}?depth=0`)).body
    expect(String(firstAfter.name), '后一次克隆改动了前一次副本').toBe(`${SOURCE_NAME} 副本`)

    await deleteQuietly(adminToken, `/api/sites/${Number(first.id)}`)
    await deleteQuietly(adminToken, `/api/sites/${Number(second.id)}`)
    expect(await listDocs(adminToken, 'sites', { where: [['project', 'equals', projectA]] })).toHaveLength(1)
  })

  test('跨项目：显式 projectId 时克隆落目标项目，源站仍在原项目', async () => {
    const before = await readSite(sourceSite)
    const data = expectOk(
      await rawRequest(
        'POST',
        '/api/sites/clone',
        adminToken,
        { sourceId: sourceSite, projectId: projectB, name: `${TAG}跨项目副本` },
      ),
    )
    const cloneId = Number(data.id)
    const clone = await readSite(cloneId)
    expect(relId(clone.project)).toBe(projectB)
    expect(clone.name).toBe(`${TAG}跨项目副本`)
    for (const field of COPIED_FIELDS) {
      expect(clone[field], `字段 ${field} 未从源站复制`).toBe(before[field])
    }

    const after = await readSite(sourceSite)
    expect(relId(after.project), '克隆把源站搬走了').toBe(projectA)
    expect(after.name).toBe(SOURCE_NAME)
    await deleteQuietly(adminToken, `/api/sites/${cloneId}`)
  })

  test('负向：未登录 401 UNAUTHORIZED', async () => {
    expectErr(
      await rawRequest('POST', '/api/sites/clone', null, { sourceId: sourceSite }),
      401,
      'UNAUTHORIZED',
    )
  })

  test('负向：缺或非法 sourceId → 400 MISSING_SOURCE', async () => {
    for (const body of [{}, { sourceId: 0 }, { sourceId: 'x' }, { sourceId: -1 }]) {
      expectErr(await rawRequest('POST', '/api/sites/clone', adminToken, body), 400, 'MISSING_SOURCE')
    }
  })

  test('负向：sourceId 指向不存在的站点 → 404 SOURCE_NOT_FOUND', async () => {
    // 源站名本身含 TAG，故用「调用前后计数不变」而不是绝对值，避免与前面用例的记录相互干扰。
    const countTagged = async () =>
      (await listDocs(adminToken, 'sites', { where: [['name', 'like', TAG]] })).length
    const before = await countTagged()
    expectErr(
      await rawRequest('POST', '/api/sites/clone', adminToken, { sourceId: 999_999_999 }),
      404,
      'SOURCE_NOT_FOUND',
    )
    expect(await countTagged(), '不存在的源站不得留下任何副本').toBe(before)
  })

  test('负向：projectId 非法 → 400 INVALID_PROJECT', async () => {
    expectErr(
      await rawRequest('POST', '/api/sites/clone', adminToken, { sourceId: sourceSite, projectId: 0 }),
      400,
      'INVALID_PROJECT',
    )
  })

  test('负向：仅查看权限的项目成员不能复制站点 → 403 FORBIDDEN', async () => {
    expectErr(
      await rawRequest('POST', '/api/sites/clone', viewerToken, { sourceId: sourceSite }),
      403,
      'FORBIDDEN',
    )
    expect(
      await listDocs(adminToken, 'sites', { where: [['project', 'equals', projectA]] }),
    ).toHaveLength(1) // 只有源站，越权未落任何副本
  })
})

/** 读取站点文档（depth=0，关系字段取裸 id；每次实读，不用缓存掩盖源站被改动）。 */
async function readSite(id: number): Promise<Record<string, unknown>> {
  const res = await getDoc(adminToken, `/api/sites/${id}?depth=0`)
  expect(res.status, `读取站点 ${id} 失败：${JSON.stringify(res.body).slice(0, 200)}`).toBe(200)
  return res.body
}
