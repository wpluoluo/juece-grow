/**
 * 临时验证：确认 dealAmount 列就绪、/api/v2/stats/leads 返回 totalAmount 与 bySource 金额。
 * 动态创建一条 converted 线索验证聚合，随后删除该测试数据。
 */
const CMS = 'http://localhost:3000'

async function main() {
  const login = await fetch(`${CMS}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  })
  const { token } = await login.json()
  const auth = { Authorization: `Bearer ${token}` }

  // 取第一个项目
  const projRes = await fetch(`${CMS}/api/projects?limit=1&depth=0`, { headers: auth })
  const projJson = await projRes.json()
  const pid = projJson.docs?.[0]?.id
  if (!pid) throw new Error('无项目，跳过')

  // 创建一条成交线索（金额 8000）
  const createRes = await fetch(`${CMS}/api/leads`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: pid,
      name: '金额验证测试',
      source: 'manual',
      status: 'converted',
      dealAmount: 8000,
    }),
  })
  const created = await createRes.json()
  const leadId = created.doc?.id
  console.log('创建测试线索 id =', leadId, '（create ok=', createRes.ok, '）')

  // 调 stats
  const statsRes = await fetch(`${CMS}/api/v2/stats/leads`, { headers: auth })
  const stats = await statsRes.json()
  console.log('stats ok =', statsRes.ok)
  console.log('totalAmount =', stats.data?.totalAmount)
  console.log('converted =', stats.data?.converted)
  console.log('manual bySource =', JSON.stringify(stats.data?.bySource?.find((s) => s.source === 'manual')))

  // 清理测试数据
  if (leadId) {
    const del = await fetch(`${CMS}/api/leads/${leadId}`, { method: 'DELETE', headers: auth })
    console.log('清理测试线索 ok =', del.ok)
  }
}
main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exit(1)
})