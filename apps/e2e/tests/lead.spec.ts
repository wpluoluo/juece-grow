import { expect, test } from '@playwright/test'

const CMS_ORIGIN = 'http://127.0.0.1:3000'
const WEB_ORIGIN = 'http://127.0.0.1:4321'

test('健康端点返回统一成功信封', async ({ request }) => {
  const res = await request.get(`${CMS_ORIGIN}/api/v2/health`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body).toEqual({ success: true, data: { status: 'ok' } })
})

test('首页渲染 Payload 数据并展示线索表单', async ({ page }) => {
  await page.goto(`${WEB_ORIGIN}/`)
  await expect(page.getByRole('heading', { name: '觉策增长', exact: true })).toBeVisible()
  await expect(page.locator('#lead-form')).toBeVisible()
})

test('提交表单 → Lead 落库 → /api/v2 返回 success:true', async ({ page }) => {
  const phone = `138${String(Date.now()).slice(-8)}`
  await page.goto(`${WEB_ORIGIN}/`)
  await page.locator('#name').fill('烟测用户')
  await page.locator('#phone').fill(phone)
  await page.locator('#lead-form button').click()
  const status = page.locator('#lead-form-status')
  await expect(status).toHaveText('已收到，我们会尽快联系您。')
})

test('API 直接提交线索，校验信封与业务 id', async ({ request }) => {
  const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: {
      projectId: '1',
      name: 'API 烟测',
      phone: `139${String(Date.now()).slice(-8)}`,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(typeof body.data.id).toBe('number')
})

test('缺 phone/wechat 时返回校验错误信封', async ({ request }) => {
  const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: { projectId: '1' },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.error.code).toBe('VALIDATION')
})

test('仅填 wechat 也能提交成功', async ({ request }) => {
  const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: {
      projectId: '1',
      name: '微信烟测',
      wechat: `wx_${Date.now()}`,
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(typeof body.data.id).toBe('number')
})

test('非法 JSON 返回 INVALID_JSON 信封', async ({ request }) => {
  const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: '这不是 JSON',
    headers: { 'Content-Type': 'text/plain' },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.error.code).toBe('INVALID_JSON')
})

test('缺失 projectId 返回 MISSING_PROJECT', async ({ request }) => {
  const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: { name: '无项目', phone: `137${String(Date.now()).slice(-8)}` },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.error.code).toBe('MISSING_PROJECT')
})

test('非法 projectId 均返回 MISSING_PROJECT', async ({ request }) => {
  for (const pid of ['0', '-1', '1.5', 'abc', '']) {
    const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
      data: { projectId: pid, name: '非法项目', phone: `136${String(Date.now()).slice(-8)}` },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('MISSING_PROJECT')
  }
})

test('OPTIONS 预检返回 204 且带 CORS 头', async ({ request }) => {
  const res = await request.fetch(`${CMS_ORIGIN}/api/v2/leads`, {
    method: 'OPTIONS',
  })
  expect(res.status()).toBe(204)
  expect(res.headers()['access-control-allow-origin']).toBe('*')
  expect(res.headers()['access-control-allow-methods']).toContain('POST')
})

test('手机号格式非法时返回 VALIDATION', async ({ request }) => {
  const res = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: { projectId: '1', name: '格式烟测', phone: '12345' },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.error.code).toBe('VALIDATION')
})

test('同一项目相同联系方式去重返回 duplicate:true', async ({ request }) => {
  const phone = `135${String(Date.now()).slice(-8)}`
  const first = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: { projectId: '1', name: '去重烟测', phone },
  })
  const firstBody = await first.json()
  expect(firstBody.success).toBe(true)

  const second = await request.post(`${CMS_ORIGIN}/api/v2/leads`, {
    data: { projectId: '1', name: '去重烟测', phone },
  })
  const secondBody = await second.json()
  expect(secondBody.success).toBe(true)
  expect(secondBody.data.duplicate).toBe(true)
  // 去重不落新记录，返回原线索 id。
  expect(secondBody.data.id).toBe(firstBody.data.id)
})