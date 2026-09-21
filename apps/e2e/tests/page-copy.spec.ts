import { expect, test, type Page } from '@playwright/test'

import {
  adminCredentials,
  adminSession,
  expectErr,
  expectOk,
  listDocs,
  rawRequest,
  updateDoc,
  type Reply,
} from '../helpers/cmsRest'
import { WEB_ORIGIN } from '../helpers/origins'

/**
 * task 2.17 · 页面文案入 CMS 的公开读路径回归（Astro ⇄ GET {CMS}/api/v2/content/pages）。
 * 固化此前只在临时探针 102-endpoint-contract-negatives.mjs 里验过的三类断言：
 *  1. 分站读对内容：同一 page 在不同 site 下必须是**不同**文案（主站没把分站文案聚合/串台）。
 *  2. 浏览器侧读路径贯通：/pricing 页头标题逐行等于端点的 `copy.hero.titleLines`——读的是 CMS 而非
 *     代码里的旧文案（`apps/astro/src/content/*.ts` 已删除，无处可回退）。
 *  3. 参数契约负向 + 草稿不可见 + 原生 REST 匿名不可枚举（fail-closed：缺参不回退主站）。
 *  4. 后台自助改稿（REQ-0003 的产品目标本身）：管理员改一条已发布文案 → 端点与公开页都读出新串、旧串消失。
 *  5. 首页 hero / CTA 增删换序（REQ-0003 验收第 2 条，第 7 组）：后台一次写入「追加一行 + 删一行 + 全部倒序」
 *     → 公开站首页 `h1.hero-title > span.line` 与 `.cta-rows .cta-row h3` **逐位**等于后台数组序。
 *     这条不能由 `scripts/astro-copy-hero-diff.mjs` 代劳：那个门禁判的是「渲染与**导入前**基线逐字节一致」，
 *     是迁移期守卫，合法改稿必然让它变红，因此它看不见「改了顺序之后渲染跟不跟着变」。
 * 三处写（第 5、6、7 组）都无条件在 `finally` 复原成改前的样子并复断，不留测试数据（Astro 构建读到草稿或
 * 半成品文案即硬失败）。前置：CMS dev @3000、公开站 dev @4321 已启动。
 */

/** 公开站 dev 服务的站点：`apps/astro/package.json` 的 dev 脚本即 cross-env SITE_ID=juece。 */
const WEB_SITE = 'juece'

type TitleLine = { text: string; emphasis?: boolean }
type Copy = Record<string, unknown>

function str(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(`${label} 应为非空字符串，实为 ${JSON.stringify(value)}`)
  return value
}

function group(value: unknown, label: string): Copy {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 应为对象，实为 ${JSON.stringify(value)}`)
  return value as Copy
}

/** 匿名请求公开端点：与 Astro 构建期同一个入口，不带任何 cookie。 */
function publicPage(site: string, page: string): Promise<Reply> {
  return rawRequest('GET', `/api/v2/content/pages?${new URLSearchParams({ site, page })}`, null)
}

/** 断言统一成功信封与 `data.{site,page}` 回显，返回 `data.copy`。 */
async function readCopy(site: string, page: string): Promise<Copy> {
  const data = expectOk(await publicPage(site, page))
  expect(data.site, `data.site 应回显 ${site}`).toBe(site)
  expect(data.page, `data.page 应回显 ${page}`).toBe(page)
  return group(data.copy, 'data.copy')
}

/** 摊出 pricing 的 meta + hero：缺键即抛，不用 `?? {}` 把契约不符糊过去。 */
function pricingCopy(copy: Copy) {
  const meta = group(copy.meta, 'copy.meta')
  const hero = group(copy.hero, 'copy.hero')
  if (!Array.isArray(hero.titleLines) || hero.titleLines.length === 0) {
    throw new Error(`copy.hero.titleLines 应为非空数组，实为 ${JSON.stringify(hero.titleLines)}`)
  }
  const titleLines: TitleLine[] = hero.titleLines.map((raw, i) => {
    const line = group(raw, `titleLines[${i}]`)
    if (line.emphasis !== undefined && typeof line.emphasis !== 'boolean') throw new Error(`titleLines[${i}].emphasis 应为布尔，实为 ${JSON.stringify(line.emphasis)}`)
    return { text: str(line.text, `titleLines[${i}].text`), emphasis: line.emphasis }
  })
  return {
    title: str(meta.title, 'copy.meta.title'),
    description: str(meta.description, 'copy.meta.description'),
    heroDescription: str(hero.description, 'copy.hero.description'),
    titleLines,
  }
}

/** hero 标题的逐段拼接：Astro 内页渲染成 `{text}<br /><em>`，纯文本按此顺序相连。 */
function joinedTitle(copy: ReturnType<typeof pricingCopy>): string {
  return copy.titleLines.map((line) => line.text).join('')
}

// ── 1. 分站读对内容：同 page 不同 site 必须是两套文案 ──────────────────────────
test('juece 与 erp 的 pricing 各自独立（meta.description 与页头标题都不相等，无串台）', async () => {
  const juece = pricingCopy(await readCopy('juece', 'pricing'))
  const erp = pricingCopy(await readCopy('erp', 'pricing'))
  expect(juece.description).not.toBe(erp.description)
  expect(joinedTitle(juece)).not.toBe(joinedTitle(erp))
  // 判据 = 两两不等（聚合会让它们相等）+ 两侧都非空（`str()` 已强制）。
  // 不锚具体话术：这些文字自 REQ-0003 起归 CMS、运营可随时改稿，写死话术会让本用例因无关改稿而红。
})

// ── 2. 浏览器侧读路径：/pricing 的页头标题来自端点 copy.hero.titleLines ────────
test('/pricing 页头标题逐段等于端点 copy.hero.titleLines，强调行落在 <em> 内', async ({ page }) => {
  const copy = pricingCopy(await readCopy(WEB_SITE, 'pricing'))
  await page.goto(`${WEB_ORIGIN}/pricing`)
  const heroTitle = page.locator('.page-hero h1')
  await expect(heroTitle).toBeVisible()
  // textContent 不为 `<br>` 插换行；两侧同法去空白，避免把 Astro 的空白归一算进断言。
  const rendered = await heroTitle.evaluate((el) => (el.textContent as string).replace(/\s+/g, ''))
  expect(rendered).toBe(joinedTitle(copy).replace(/\s+/g, ''))
  for (const line of copy.titleLines) {
    await expect(heroTitle).toContainText(line.text)
  }
  const emphasized = copy.titleLines.filter((line) => line.emphasis === true)
  const emNodes = heroTitle.locator('em')
  await expect(emNodes).toHaveCount(emphasized.length)
  for (const [i, line] of emphasized.entries()) {
    await expect(emNodes.nth(i)).toHaveText(line.text)
  }
  await expect(page.locator('.page-hero .hero-desc')).toHaveText(copy.heroDescription)
})

// ── 3. 参数契约负向：四种非法组合一律 400，不回退主站 ──────────────────────────
const NEGATIVES: Array<[name: string, path: string, code: 'INVALID_SITE' | 'INVALID_PAGE']> = [
  ['缺 site', '/api/v2/content/pages?page=pricing', 'INVALID_SITE'],
  ['未知 site', '/api/v2/content/pages?site=nope&page=pricing', 'INVALID_SITE'],
  ['缺 page', '/api/v2/content/pages?site=juece', 'INVALID_PAGE'],
  ['未知 page', '/api/v2/content/pages?site=juece&page=about', 'INVALID_PAGE'],
]

for (const [name, path, code] of NEGATIVES) {
  test(`${name} → 400 ${code}（匿名请求，fail-closed 不回退主站）`, async () => {
    expectErr(await rawRequest('GET', path, null), 400, code)
  })
}

// ── 4. 原生 REST 匿名不可枚举：公开读取只走 /api/v2/content/pages ──────────────
test('原生 REST /api/page-pricing 匿名不可枚举（403）', async () => {
  const res = await rawRequest('GET', '/api/page-pricing?limit=1', null)
  expect(res.status, `期望 403，实际 ${res.status}：${JSON.stringify(res.body).slice(0, 200)}`).toBe(403)
})

/** 原生 REST 改状态（Payload 返回 `{doc}` 而非统一信封），断言写成功且状态落库。 */
async function patchStatus(token: string, id: number, status: 'draft' | 'published'): Promise<void> {
  const res = await updateDoc(token, `/api/page-pricing/${id}`, { status })
  expect(res.status, `置 ${status} 失败：${JSON.stringify(res.body).slice(0, 300)}`).toBe(200)
  if (res.body.doc === undefined) throw new Error(`PATCH /api/page-pricing/${id} 响应缺 doc：${JSON.stringify(res.body).slice(0, 300)}`)
  expect(group(res.body.doc, `记录 ${id} 的 doc`).status, `记录 ${id} 的 status 未落成 ${status}`).toBe(status)
}

// ── 5. 草稿不可见：置 draft → 404；finally 复原 published → 再断言 200 ─────────
test.describe('草稿不可见', () => {
  test.skip(!adminCredentials(), '未提供 CMS 管理员凭据（.aiws/secrets/test-accounts.json），跳过')

  test('yunque 的 pricing 置 draft → 端点 404 PAGE_COPY_NOT_FOUND；复原 published → 端点 200', async () => {
    const { token } = await adminSession()
    // where 精确锁定那一条（pageCopyContract 的 SITE_PROJECT_SLUG.yunque = 'yunque'），不按 limit 取第一条瞎改。
    const projects = await listDocs(token, 'projects', { where: [['slug', 'equals', 'yunque']], depth: 0 })
    if (projects.length !== 1) throw new Error(`项目 slug=yunque 应恰有 1 条，实际 ${projects.length} 条`)
    const records = await listDocs(token, 'page-pricing', { where: [['project', 'equals', Number(projects[0].id)]], depth: 0 })
    if (records.length !== 1) throw new Error(`yunque 的 page-pricing 应恰有 1 条，实际 ${records.length} 条`)
    const recordId = Number(records[0].id)
    if (records[0].status !== 'published') throw new Error(`前置要求记录 ${recordId} 为 published，实为 ${JSON.stringify(records[0].status)}`)
    const before = pricingCopy(await readCopy('yunque', 'pricing'))

    try {
      await patchStatus(token, recordId, 'draft')
      expectErr(await publicPage('yunque', 'pricing'), 404, 'PAGE_COPY_NOT_FOUND')
    } finally {
      // 无条件收尾：即便上面的断言已失败也要写回 published，并确认端点恢复 200 且文案与翻改前一致。
      await patchStatus(token, recordId, 'published')
      const restored = pricingCopy(await readCopy('yunque', 'pricing'))
      expect(restored.title).toBe(before.title)
      expect(joinedTitle(restored)).toBe(joinedTitle(before))
    }
  })
})

// ── 6. 后台自助改稿（REQ-0003 的产品目标本身）：改一条已发布文案 → 公开页读新串 ──
test.describe('后台自助改稿', () => {
  test.skip(!adminCredentials(), '未提供 CMS 管理员凭据（.aiws/secrets/test-accounts.json），跳过')

  /**
   * 整份替换 `hero`（不做局部合并）：传入的就是刚从原生 REST 读回来的对象，只换要改的那个字段，
   * 不依赖 Payload 对嵌套 group 的深合并语义；写完按响应的 `doc.hero.description` 断言已落库。
   */
  async function patchHero(token: string, id: number, hero: Copy, expectDescription: string): Promise<void> {
    const res = await updateDoc(token, `/api/page-pricing/${id}`, { hero })
    expect(res.status, `PATCH hero 失败：${JSON.stringify(res.body).slice(0, 300)}`).toBe(200)
    const doc = group(res.body.doc, `记录 ${id} 的 PATCH 响应 doc`)
    const written = str(group(doc.hero, `记录 ${id} 的 doc.hero`).description, 'doc.hero.description')
    expect(written, '后台写入未落库').toBe(expectDescription)
  }

  test('juece 的 pricing hero.description 改成新串 → 端点与 /pricing 都是新串、旧串消失；finally 原样复原', async ({ page }) => {
    const { token } = await adminSession()
    // 同第 5 组口径：where 精确锁定 juece 那一条（SITE_PROJECT_SLUG.juece = 'juece-grow'），不按 limit 取第一条瞎改。
    const projects = await listDocs(token, 'projects', { where: [['slug', 'equals', 'juece-grow']], depth: 0 })
    if (projects.length !== 1) throw new Error(`项目 slug=juece-grow 应恰有 1 条，实际 ${projects.length} 条`)
    const records = await listDocs(token, 'page-pricing', { where: [['project', 'equals', Number(projects[0].id)]], depth: 0 })
    if (records.length !== 1) throw new Error(`juece 的 page-pricing 应恰有 1 条，实际 ${records.length} 条`)
    const recordId = Number(records[0].id)
    const heroBefore = group(records[0].hero, 'doc.hero')
    const oldText = str(heroBefore.description, 'doc.hero.description')
    const newText = `E2E 自助改稿 ${Date.now()} 的新文案`
    // 改前整份 copy 的快照：复原后深比，防「PATCH hero 连带损坏别的字段」。
    const snapshot = JSON.stringify(await readCopy(WEB_SITE, 'pricing'))

    try {
      await patchHero(token, recordId, { ...heroBefore, description: newText }, newText)
      expect(pricingCopy(await readCopy(WEB_SITE, 'pricing')).heroDescription, '公开端点没读到后台刚写的新串').toBe(newText)
      await page.goto(`${WEB_ORIGIN}/pricing`)
      const desc = page.locator('.page-hero .hero-desc')
      await expect(desc).toHaveText(newText)
      await expect(desc).not.toContainText(oldText)
    } finally {
      await patchHero(token, recordId, heroBefore, oldText)
      expect(JSON.stringify(await readCopy(WEB_SITE, 'pricing')), '复原后的整份 copy 与改前快照不等').toBe(snapshot)
      await page.goto(`${WEB_ORIGIN}/pricing`)
      await expect(page.locator('.page-hero .hero-desc')).toHaveText(oldText)
    }
  })
})

// ── 7. 首页 hero / CTA 的增删换序（REQ-0003 验收第 2 条：公开站按后台顺序渲染）────
test.describe('首页 hero 与 CTA 增删换序', () => {
  test.skip(!adminCredentials(), '未提供 CMS 管理员凭据（.aiws/secrets/test-accounts.json），跳过')

  /** 摊 home 的 `hero.titleLines`：只认 `{ text, emphasis }`，缺键 / 类型不符即抛（与 pricingCopy 同法）。 */
  function titleLinesOf(value: unknown, label: string): TitleLine[] {
    const raw = group(value, label).titleLines
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(`${label}.titleLines 应为非空数组，实为 ${JSON.stringify(raw)}`)
    }
    return raw.map((item, i) => {
      const line = group(item, `${label}.titleLines[${i}]`)
      if (line.emphasis !== undefined && typeof line.emphasis !== 'boolean') {
        throw new Error(`${label}.titleLines[${i}].emphasis 应为布尔，实为 ${JSON.stringify(line.emphasis)}`)
      }
      return { text: str(line.text, `${label}.titleLines[${i}].text`), emphasis: line.emphasis === true }
    })
  }

  /** 摊 home 的 `cta.rows`：行对象原样返回（除三个必填键外的字段随行携带），顺序即数组序。 */
  function ctaRowsOf(value: unknown, label: string): Copy[] {
    const raw = group(value, label).rows
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(`${label}.rows 应为非空数组，实为 ${JSON.stringify(raw)}`)
    }
    return raw.map((item, i) => {
      const row = group(item, `${label}.rows[${i}]`)
      str(row.head, `${label}.rows[${i}].head`)
      str(row.icon, `${label}.rows[${i}].icon`)
      str(row.action, `${label}.rows[${i}].action`)
      return row
    })
  }

  /**
   * 去掉数组行的框架主键 `id`（Payload 记账键，不是文案）：整份替换时不带回旧主键，行由库重新分配 id，
   * 写入的数组序就是顺序真值。groups、标量与 `null`（未填的可选键）原样保留。
   */
  function dropRowIds(value: unknown, insideRow = false): unknown {
    if (Array.isArray(value)) return value.map((item) => dropRowIds(item, true))
    if (value === null || typeof value !== 'object') return value
    const out: Copy = {}
    for (const [key, raw] of Object.entries(value)) {
      if (insideRow && key === 'id') continue
      out[key] = dropRowIds(raw)
    }
    return out
  }

  /**
   * 一次 PATCH 同时整份替换 `hero` 与 `cta`（与第 6 组 `patchHero` 同语义：不做局部合并），
   * 并按送进去的数组序逐行断言已落库。
   */
  async function patchHeroAndCta(
    token: string,
    id: number,
    hero: Copy,
    cta: Copy,
    expectLines: TitleLine[],
    expectHeads: string[],
  ): Promise<void> {
    const res = await updateDoc(token, `/api/page-home/${id}`, { hero, cta })
    expect(res.status, `PATCH hero+cta 失败：${JSON.stringify(res.body).slice(0, 300)}`).toBe(200)
    const doc = group(res.body.doc, `记录 ${id} 的 PATCH 响应 doc`)
    const lines = titleLinesOf(doc.hero, 'doc.hero')
    expect(lines, '落库的 hero.titleLines 逐行序列不等于写入的数组序').toEqual(expectLines)
    const rows = ctaRowsOf(doc.cta, 'doc.cta')
    expect(rows.map((row) => str(row.head, 'doc.cta.rows[].head')), '落库的 cta.rows 逐行 head 序列不等于写入的数组序').toEqual(
      expectHeads,
    )
  }

  /**
   * 渲染侧逐位断言：`span.line` 与 `.cta-row h3` 都按后台数组序逐条比。只比拼接串会把「两行互换」判成通过
   * （拼接结果不变），所以这里必须是 nth(i) 对第 i 项。
   */
  async function expectRenderedOrder(page: Page, lines: TitleLine[], heads: string[]): Promise<void> {
    const heroTitle = page.locator('h1.hero-title')
    await expect(heroTitle).toBeVisible()
    const lineNodes = page.locator('h1.hero-title > span.line')
    await expect(lineNodes, 'span.line 的行数与后台 titleLines 的行数不等').toHaveCount(lines.length)
    for (const [i, line] of lines.entries()) {
      await expect(lineNodes.nth(i), `h1 第 ${i} 个 span.line 不是后台 titleLines 的第 ${i} 项`).toHaveText(line.text)
    }
    const emphasized = lines.filter((line) => line.emphasis === true)
    const emNodes = page.locator('h1.hero-title em')
    await expect(emNodes, '<em> 的数量与新顺序里 emphasis 为真的行数不等').toHaveCount(emphasized.length)
    for (const [i, line] of emphasized.entries()) {
      await expect(emNodes.nth(i), `第 ${i} 个 <em> 没有跟随它的行走到新位置`).toHaveText(line.text)
    }
    const rowHeads = page.locator('.cta-rows .cta-row h3')
    await expect(rowHeads, '.cta-row h3 的行数与后台 cta.rows 的行数不等').toHaveCount(heads.length)
    for (const [i, head] of heads.entries()) {
      await expect(rowHeads.nth(i), `.cta-rows 第 ${i} 个 h3 不是后台 cta.rows 的第 ${i} 项`).toHaveText(head)
    }
  }

  test('juece 首页 hero 删一行+追加一行+倒序、cta 倒序+追加一行 → h1 逐行与 .cta-row 逐行都是后台数组序、删掉的行消失；finally 整份复原', async ({
    page,
  }) => {
    const { token } = await adminSession()
    // 同第 5、6 组口径：where 精确锁定那一条（SITE_PROJECT_SLUG.juece = 'juece-grow'），不按 limit 取第一条瞎改。
    const projects = await listDocs(token, 'projects', { where: [['slug', 'equals', 'juece-grow']], depth: 0 })
    if (projects.length !== 1) throw new Error(`项目 slug=juece-grow 应恰有 1 条，实际 ${projects.length} 条`)
    const records = await listDocs(token, 'page-home', { where: [['project', 'equals', Number(projects[0].id)]], depth: 0 })
    if (records.length !== 1) throw new Error(`juece 的 page-home 应恰有 1 条，实际 ${records.length} 条`)
    const recordId = Number(records[0].id)
    if (records[0].status !== 'published') {
      throw new Error(`前置要求记录 ${recordId} 为 published，实为 ${JSON.stringify(records[0].status)}`)
    }

    // 改前的整份 hero / cta（未改的 stats、diagram 等一并随行）：finally 原样写回这两个组。
    const heroBefore = group(dropRowIds(records[0].hero), 'doc.hero')
    const ctaBefore = group(dropRowIds(records[0].cta), 'doc.cta')
    const linesBefore = titleLinesOf(heroBefore, 'doc.hero')
    const rowsBefore = ctaRowsOf(ctaBefore, 'doc.cta')
    const headsBefore = rowsBefore.map((row) => str(row.head, 'doc.cta.rows[].head'))
    if (linesBefore.length < 2) {
      throw new Error(`验「换序 + 删一行」要求基线 hero.titleLines ≥2 行，实为 ${linesBefore.length} 行`)
    }
    // 改前整份 copy 的快照：复原后深比，防「PATCH hero/cta 连带损坏别的字段」。
    const snapshot = JSON.stringify(await readCopy(WEB_SITE, 'home'))

    // 增 + 删 + 换序：基线倒序 → 删掉基线首行（= 倒序后的末行）→ 追加一行带本轮唯一标记的行。
    // 保留 ≥1 行，满足 schema 的 minRows: 1；emphasis 随行一起搬，因此它在页面上的落点变化就是「按后台顺序渲染」的可断言点。
    const marker = `E2E 增删换序 ${Date.now()}`
    const reversed = [...linesBefore].reverse()
    const deletedLine = reversed[reversed.length - 1]
    const linesAfter: TitleLine[] = [...reversed.slice(0, -1), { text: marker, emphasis: false }]
    const addedRow: Copy = {
      icon: 'saas',
      head: marker,
      desc: `${marker}：后台追加的入口行，渲染应落在最后一位。`,
      act: '看新增入口',
      action: 'lead',
    }
    const reversedRows = [...rowsBefore].reverse()
    const rowsAfter = [...reversedRows, addedRow]
    const headsAfter = rowsAfter.map((row) => str(row.head, '写入体 cta.rows[].head'))

    try {
      await patchHeroAndCta(
        token,
        recordId,
        { ...heroBefore, titleLines: linesAfter },
        { ...ctaBefore, rows: rowsAfter },
        linesAfter,
        headsAfter,
      )
      // 端点侧（Astro 构建读的同一个接缝）也必须是后台数组序，公开页与端点才不会各排各的。
      const after = await readCopy(WEB_SITE, 'home')
      expect(titleLinesOf(group(after.hero, 'copy.hero'), 'copy.hero'), '公开端点的 titleLines 不是后台数组序').toEqual(linesAfter)
      expect(
        ctaRowsOf(group(after.cta, 'copy.cta'), 'copy.cta').map((row) => str(row.head, 'copy.cta.rows[].head')),
        '公开端点的 cta.rows 不是后台数组序',
      ).toEqual(headsAfter)

      await page.goto(`${WEB_ORIGIN}/`)
      await expectRenderedOrder(page, linesAfter, headsAfter)
      await expect(page.locator('h1.hero-title'), '删掉的那一行仍留在 h1 里').not.toContainText(deletedLine.text)
      await expect(page.locator('body'), '删掉的那一行仍出现在页面上').not.toContainText(deletedLine.text)
    } finally {
      // 无条件收尾：即便上面的断言已失败也要把两个组整份写回，并复断端点与首页渲染都回到改前。
      await patchHeroAndCta(token, recordId, heroBefore, ctaBefore, linesBefore, headsBefore)
      expect(JSON.stringify(await readCopy(WEB_SITE, 'home')), '复原后的整份 copy 与改前快照不等').toBe(snapshot)
      await page.goto(`${WEB_ORIGIN}/`)
      await expectRenderedOrder(page, linesBefore, headsBefore)
      await expect(page.locator('h1.hero-title'), '复原后 h1 里仍留着新增的标记行').not.toContainText(marker)
      await expect(page.locator('.cta-rows'), '复原后 .cta-rows 里仍留着新增的标记行').not.toContainText(marker)
    }
  })
})
