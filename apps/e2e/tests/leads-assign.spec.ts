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
  postRawText,
  rawRequest,
  relId,
} from '../helpers/cmsRest'

/**
 * POST /api/leads/assign 端到端覆盖（Payload 自定义端点，见 apps/cms/src/collections/Leads.ts 的 endpoints）。
 *
 * 覆盖点（此前零覆盖）：
 *  1. 正向：管理员把线索分配给同项目成员 → 统一成功信封 data{id,owner}，owner 真正落库，
 *     并写出一条 `lead-activities(type=assigned)`（actor=发起人，meta.owner=被分配人）。
 *     响应面须收敞：data 只有 {id,owner} 且 owner 是裸 id（端点 payload.update 用 depth: 0；默认深度会把
 *     被分配人整份用户文档连鉴权用的 sessions[] 一起回出）。
 *     actor 必须有值：端点内的 payload.update 要透传 req，否则 afterChange 拿不到发起人（PROB-006）。
 *  2. 负向（统一失败信封 {success:false,error:{code,message}}）：
 *     未登录 401 UNAUTHORIZED；非 JSON 体 400 INVALID_JSON；缺/非法 leadId 400 MISSING_LEAD；
 *     缺/非法 assigneeId 400 INVALID_ASSIGNEE；被分配人非本项目成员 400 ASSIGNEE_NOT_IN_PROJECT；
 *     leadId/assigneeId 指向不存在的记录 404 LEAD_NOT_FOUND / ASSIGNEE_NOT_FOUND（按真实原因回，
 *     不得被 findByID 抛的 NotFound 混成 500，PROB-005）；发起人对该项目无写权限 403 FORBIDDEN。
 *
 * 造数边界：专属测试项目 + 一次性测试账号，afterAll 删项目（级联）与账号；不触碰 12 条真实线索。
 * 前置：CMS dev @3000；管理员凭据由 setup/global-setup.ts 注入，缺失时整块 skip。
 */

const TS = Date.now()
const RUN_TAG = `e2e分配${TS}`
const MEMBER_USERNAME = `e2e-assign-member-${TS}`
const OUTSIDER_USERNAME = `e2e-assign-out-${TS}`
/** 一次性测试账号口令：随进程生成、用例结束即删除，非持久凭据。 */
const MEMBER_PASSWORD = `E2emem!${TS}`
const OUTSIDER_PASSWORD = `E2eout!${TS}`

let adminToken = ''
let adminId = 0
let projectA = 0
let projectB = 0
let memberUser = 0 // 项目A 的 editor：合法被分配人
let outsiderUser = 0 // 只属于项目B 的 editor：既是「非本项目成员」负例，也是「无权限发起人」负例
let outsiderToken = ''
let lead = 0

test.describe('线索分配 POST /api/leads/assign', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!adminCredentials(), '未提供 CMS 管理员凭据（.aiws/secrets/test-accounts.json），跳过')

  test.beforeAll(async () => {
    const session = await adminSession()
    adminToken = session.token
    adminId = session.id

    projectA = await createRequired(adminToken, '/api/projects', { name: `${RUN_TAG}A`, slug: `e2e-assign-a-${TS}` })
    projectB = await createRequired(adminToken, '/api/projects', { name: `${RUN_TAG}B`, slug: `e2e-assign-b-${TS}` })

    memberUser = await createRequired(adminToken, '/api/users', {
      username: MEMBER_USERNAME,
      password: MEMBER_PASSWORD,
      name: `${RUN_TAG}成员`,
      role: 'operator',
    })
    await createRequired(adminToken, '/api/memberships', { project: projectA, user: memberUser, role: 'editor' })

    outsiderUser = await createRequired(adminToken, '/api/users', {
      username: OUTSIDER_USERNAME,
      password: OUTSIDER_PASSWORD,
      name: `${RUN_TAG}外项目成员`,
      role: 'operator',
    })
    await createRequired(adminToken, '/api/memberships', { project: projectB, user: outsiderUser, role: 'editor' })

    const outsider = await login(OUTSIDER_USERNAME, OUTSIDER_PASSWORD)
    expect(outsider.status, '外项目成员登录失败').toBe(200)
    outsiderToken = String(outsider.body.token ?? '')
    expect(outsiderToken).not.toBe('')

    lead = await createRequired(adminToken, '/api/leads', {
      project: projectA,
      name: `${RUN_TAG}线索`,
      phone: `158${String(TS).slice(-8)}`,
      status: 'new',
    })
  })

  test.afterAll(async () => {
    await deleteQuietly(adminToken, `/api/projects/${projectA}`)
    await deleteQuietly(adminToken, `/api/projects/${projectB}`)
    await deleteQuietly(adminToken, `/api/users/${memberUser}`)
    await deleteQuietly(adminToken, `/api/users/${outsiderUser}`)
    expect(await listDocs(adminToken, 'leads', { where: [['project', 'equals', projectA]] })).toHaveLength(0)
    expect(await listDocs(adminToken, 'memberships', { where: [['user', 'equals', memberUser]] })).toHaveLength(0)
    // 按 id 实读确认两个测试项目真已消失：slug like 条件写法不当时计数恒为 0（假通过）。
    for (const id of [projectA, projectB]) {
      expect((await getDoc(adminToken, `/api/projects/${id}?depth=0`)).status, `项目 ${id} 未被删除`).toBe(404)
    }
  })

  test('正向：分配给同项目成员 → owner 落库并写 assigned 动态', async () => {
    const data = expectOk(
      await rawRequest('POST', '/api/leads/assign', adminToken, { leadId: lead, assigneeId: memberUser }),
    )
    expect(Number(data.id)).toBe(lead)
    // 响应面收敛到 {id, owner}，且 owner 必须是裸 id：Payload 默认深度会把 owner 填成整份用户文档
    // （含鉴权用的 sessions[]），一旦端点漏掉 depth: 0 这两条断言即红。
    expect(Object.keys(data).sort(), `分配响应字段面异常：${JSON.stringify(data)}`).toEqual(['id', 'owner'])
    expect(typeof data.owner, '分配响应不得回用户对象').toBe('number')
    expect(Number(data.owner)).toBe(memberUser)

    const stored = await getDoc(adminToken, `/api/leads/${lead}?depth=0`)
    expect(stored.status).toBe(200)
    expect(relId(stored.body.owner), '线索 owner 未真正落库').toBe(memberUser)

    const activities = await assignedActivities()
    expect(activities).toHaveLength(1)
    expect(relId(activities[0].project)).toBe(projectA)
    expect((activities[0].meta as { owner?: number }).owner).toBe(memberUser)

    // 两条写入路径的审计结果必须一致：REST 建线索（本用例）与 /assign 端点分配（文件末尾的 actor 用例）
    // 都要把发起人落成 actor。
    const created = await listDocs(adminToken, 'lead-activities', {
      where: [
        ['lead', 'equals', lead],
        ['type', 'equals', 'created'],
      ],
    })
    expect(created).toHaveLength(1)
    expect(relId(created[0].actor), 'REST 写入路径应记录操作人').toBe(adminId)
  })

  test('负向：未登录 401 UNAUTHORIZED', async () => {
    expectErr(
      await rawRequest('POST', '/api/leads/assign', null, { leadId: lead, assigneeId: memberUser }),
      401,
      'UNAUTHORIZED',
    )
  })

  test('负向：请求体非 JSON → 400 INVALID_JSON', async () => {
    expectErr(await postRawText(adminToken, '/api/leads/assign', '这不是 JSON'), 400, 'INVALID_JSON')
  })

  test('负向：leadId 缺失或非法 → 400 MISSING_LEAD', async () => {
    for (const body of [
      { assigneeId: memberUser },
      { leadId: 0, assigneeId: memberUser },
      { leadId: 'not-a-number', assigneeId: memberUser },
    ]) {
      expectErr(await rawRequest('POST', '/api/leads/assign', adminToken, body), 400, 'MISSING_LEAD')
    }
  })

  test('负向：assigneeId 缺失或非法 → 400 INVALID_ASSIGNEE', async () => {
    for (const body of [{ leadId: lead }, { leadId: lead, assigneeId: 0 }, { leadId: lead, assigneeId: 'x' }]) {
      expectErr(await rawRequest('POST', '/api/leads/assign', adminToken, body), 400, 'INVALID_ASSIGNEE')
    }
  })

  test('负向：被分配人不是该项目成员 → 400 ASSIGNEE_NOT_IN_PROJECT', async () => {
    expectErr(
      await rawRequest('POST', '/api/leads/assign', adminToken, { leadId: lead, assigneeId: outsiderUser }),
      400,
      'ASSIGNEE_NOT_IN_PROJECT',
    )
    // 负向不得留下副作用：owner 仍是首次分配的成员
    expect(relId((await getDoc(adminToken, `/api/leads/${lead}?depth=0`)).body.owner)).toBe(memberUser)
  })

  test('负向：发起人对该项目无写权限 → 403 FORBIDDEN', async () => {
    expectErr(
      await rawRequest('POST', '/api/leads/assign', outsiderToken, { leadId: lead, assigneeId: outsiderUser }),
      403,
      'FORBIDDEN',
    )
    expect(relId((await getDoc(adminToken, `/api/leads/${lead}?depth=0`)).body.owner)).toBe(memberUser)
  })

  test('负向：leadId 指向不存在的记录 → 404 LEAD_NOT_FOUND', async () => {
    expectErr(
      await rawRequest('POST', '/api/leads/assign', adminToken, { leadId: 999_999_999, assigneeId: memberUser }),
      404,
      'LEAD_NOT_FOUND',
    )
    // 404 也得按真实原因回，而不是被外层 catch 混成 500；同一次调用不得留下副作用。
    expect(relId((await getDoc(adminToken, `/api/leads/${lead}?depth=0`)).body.owner)).toBe(memberUser)
  })

  test('负向：assigneeId 指向不存在的记录 → 404 ASSIGNEE_NOT_FOUND', async () => {
    expectErr(
      await rawRequest('POST', '/api/leads/assign', adminToken, { leadId: lead, assigneeId: 999_999_999 }),
      404,
      'ASSIGNEE_NOT_FOUND',
    )
    expect(relId((await getDoc(adminToken, `/api/leads/${lead}?depth=0`)).body.owner)).toBe(memberUser)
  })

  test('审计：经 /assign 端点分配写出的动态带发起人 actor', async () => {
    const activities = await assignedActivities()
    expect(activities.length).toBeGreaterThan(0)
    // 端点里的 payload.update 必须透传 req，afterChange 才拿得到 req.user；
    // 与 REST 写入路径同一结果（对照上方正向用例断言的 created 动态 actor）。
    expect(relId(activities[0].actor), '端点分配丢失审计操作人').toBe(adminId)
  })
})

async function assignedActivities(): Promise<Record<string, unknown>[]> {
  return listDocs(adminToken, 'lead-activities', {
    where: [
      ['lead', 'equals', lead],
      ['type', 'equals', 'assigned'],
    ],
  })
}
