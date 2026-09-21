/**
 * 页面文案的读模型投影（design D8③）——CMS 存储形态 ⇄ Astro 类型形态的唯一换算处。
 *
 * 谁用这条缝：
 *  - 导入脚本 apps/cms/scripts/import-astro-copy.ts：写库前施加 toSchemaShape（TS 形状 → 存储形状）。
 *  - 读端点 src/app/api/v2/content/pages/route.ts：响应前施加 toReaderShape（存储形状 → Astro 形状）。
 *  - parity 门禁 scripts/astro-copy-parity.mjs 与覆盖度门禁 scripts/astro-copy-coverage.mjs：期望侧都用 toSchemaShape，
 *    与导入脚本同处一个形状空间才可比（parity 的实际侧经 HTTP 读端点，即间接走 toReaderShape）。
 * 三处共用本文件；各写一份形变规则就是 AGENTS.md §4 禁的双写，改一处漏一处会让比对悄悄放水。
 *
 * 三条规则各自只属于一个页面，且都在入口处硬校验前提；前提不满足即抛，不静默跳过：
 *   R1 foldHeroTitlePair   features / solutions / pricing：`hero.titleA` + `hero.titleEm`
 *                          → `hero.titleLines[{text, emphasis}]`（design D4 收敛成一种高亮机制）。
 *                          `titleLines[].text` 在 schema 里 required，故空 `titleEm` 不成行——
 *                          这是 schema 约束推出来的规则，不是兜底：空串本来就渲染不出任何字。
 *   R2 renameHeroLineKey   home：`hero.titleLines[].em` → `emphasis`（同名同义，全仓一套字段名）。
 *   R3 renamePanelKind     features：`caps[].panel.kind` → `blockType`，并把单对象包成
 *                          恰好一行的数组（Payload `blocks` 字段只能是数组，判别键由框架字段承载）。
 */

export type CopyRecord = Record<string, unknown>

const PANEL_KINDS = ['blocks', 'chips', 'bars', 'journey', 'agent']

function fail(page: string, rule: string, detail: string): never {
  throw new Error(`投影失败 [${page}/${rule}]：${detail}`)
}

const isPlainObject = (v: unknown): v is CopyRecord =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Payload 自己加在数据里的记账键：行主键、block 的展示名、数组序。
 * 这些不是文案字段，Astro 类型里也不存在，出端点前必须剥掉。
 */
const FRAMEWORK_KEYS = new Set(['id', 'blockName', '_order'])
/** 记录级元数据：站归属/状态/时间戳由端点自己按契约决定，不作为文案返回。 */
const RECORD_META_KEYS = new Set(['project', 'status', 'createdAt', 'updatedAt'])

/**
 * CMS 记录 → 去掉框架记账的形状：剥 FRAMEWORK_KEYS（记录根上还剥 RECORD_META_KEYS），
 * 并把值为 null 的键折回「不存在」——实测 12 份快照的 null 与空串叶子数都是 0，
 * 所以这条只会消掉「后台没填的可选字段」，不可能擦掉任何真实文案。
 */
export function stripRecordKeys(value: unknown, atRecordRoot = false): unknown {
  if (Array.isArray(value)) return value.map((item) => stripRecordKeys(item))
  if (!isPlainObject(value)) return value
  const drop = atRecordRoot ? new Set([...FRAMEWORK_KEYS, ...RECORD_META_KEYS]) : FRAMEWORK_KEYS
  const out: CopyRecord = {}
  for (const [key, raw] of Object.entries(value)) {
    if (drop.has(key)) continue
    const cleaned = stripRecordKeys(raw)
    if (cleaned === null) continue
    out[key] = cleaned
  }
  return out
}

/** R1：把两段式标题折成可重复的 { text, emphasis } 组。 */
function foldHeroTitlePair(page: string, content: CopyRecord): void {
  const hero = content.hero
  if (!isPlainObject(hero)) fail(page, 'R1', '缺少 hero 组')
  if ('titleLines' in hero) fail(page, 'R1', 'hero 同时存在 titleA 与 titleLines')
  if (typeof hero.titleA !== 'string') fail(page, 'R1', 'hero.titleA 不是字符串')
  if (typeof hero.titleEm !== 'string') fail(page, 'R1', 'hero.titleEm 不是字符串')

  const lines: CopyRecord[] = [{ text: hero.titleA, emphasis: false }]
  if (hero.titleEm !== '') lines.push({ text: hero.titleEm, emphasis: true })
  const { titleA, titleEm, ...rest } = hero
  content.hero = { ...rest, titleLines: lines }
}

/** R2：home 的 `em` 统一改名为 `emphasis`。 */
function renameHeroLineKey(page: string, content: CopyRecord): void {
  const lines = content.hero && isPlainObject(content.hero) ? content.hero.titleLines : undefined
  if (!Array.isArray(lines)) fail(page, 'R2', 'hero.titleLines 不是数组')
  for (const [i, line] of lines.entries()) {
    if (!isPlainObject(line)) fail(page, 'R2', `第 ${i} 行不是对象`)
    if (!('em' in line)) fail(page, 'R2', `第 ${i} 行缺少 em 键`)
    if (typeof line.em !== 'boolean') fail(page, 'R2', `第 ${i} 行 em 不是布尔`)
    if ('emphasis' in line) fail(page, 'R2', `第 ${i} 行同时存在 em 与 emphasis`)
    const emphasis = line.em
    delete line.em
    line.emphasis = emphasis
  }
}

/** R3：单对象面板 → 恰好一行的 blocks 数组，kind 改由 blockType 承载。 */
function renamePanelKind(page: string, content: CopyRecord): void {
  if (!Array.isArray(content.caps)) fail(page, 'R3', '缺少 caps 数组')
  for (const [i, raw] of content.caps.entries()) {
    if (!isPlainObject(raw)) fail(page, 'R3', `caps[${i}] 不是对象`)
    if (!isPlainObject(raw.panel)) fail(page, 'R3', `caps[${i}].panel 不是对象`)
    const panel = raw.panel as CopyRecord
    const kind = panel.kind
    if (typeof kind !== 'string' || !PANEL_KINDS.includes(kind)) {
      fail(page, 'R3', `caps[${i}].panel.kind=${JSON.stringify(kind)} 不在五形态之内`)
    }
    const { kind: _dropped, ...panelFields } = panel
    raw.panel = [{ blockType: kind, ...panelFields }]
  }
}

/** 每个页面适用的规则；不在表里的页面即无投影规则。 */
const RULES: Record<string, Array<(page: string, content: CopyRecord) => void>> = {
  home: [renameHeroLineKey],
  features: [foldHeroTitlePair, renamePanelKind],
  solutions: [foldHeroTitlePair],
  pricing: [foldHeroTitlePair],
}

/**
 * 快照（TS 形状）→ 存储形状。返回新对象，不修改入参。
 * 未知页面名直接抛——静默原样返回会让导入把不合形状的文案写进库。
 */
export function toSchemaShape(page: string, content: unknown): CopyRecord {
  const rules = RULES[page]
  if (!rules) {
    fail('toSchemaShape', 'rules', `页面 "${page}" 没有投影规则（可选：${Object.keys(RULES).join(', ')}）`)
  }
  if (!isPlainObject(content)) fail(page, 'input', '待投影内容不是对象')
  const cloned = structuredClone(content) as CopyRecord
  for (const rule of rules) rule(page, cloned)
  return cloned
}

/**
 * 存储记录 → schema 形状。与 toSchemaShape 的产物同处一个形状空间：
 * 只去框架记账，不解包 panel、不改判别键，这样比对结果不受读投影影响。仅供本模块 toReaderShape 前置使用。
 */
function fromRecord(record: unknown): CopyRecord {
  const stripped = stripRecordKeys(record, true)
  if (!isPlainObject(stripped)) fail('fromRecord', 'shape', '记录不是对象')
  return stripped
}

/**
 * 存储记录 → Astro 类型形态（读端点在响应前施加，design D8③）。
 * 先归一（剥框架记账、把未填可选键折回不存在），再把恰好一行的 panel blocks 解包成单对象、
 * blockType 改回 kind。解包前提不成立即抛，不静默原样返回——那会让渲染器读到数组。
 */
export function toReaderShape(page: string, record: unknown): CopyRecord {
  const cloned = fromRecord(record)
  if (page === 'features') {
    if (!Array.isArray(cloned.caps)) fail(page, 'R3⁻¹', '缺少 caps 数组')
    for (const [i, raw] of cloned.caps.entries()) {
      if (!isPlainObject(raw)) fail(page, 'R3⁻¹', `caps[${i}] 不是对象`)
      const panel = raw.panel
      if (!Array.isArray(panel) || panel.length !== 1) {
        fail(page, 'R3⁻¹', `caps[${i}].panel 应为恰好一行的数组，实为 ${JSON.stringify((panel as unknown[])?.length)} 行`)
      }
      const row = panel[0]
      if (!isPlainObject(row)) fail(page, 'R3⁻¹', `caps[${i}].panel[0] 不是对象`)
      const blockType = row.blockType
      if (typeof blockType !== 'string' || !PANEL_KINDS.includes(blockType)) {
        fail(page, 'R3⁻¹', `caps[${i}].panel[0].blockType=${JSON.stringify(blockType)} 不在五形态之内`)
      }
      const { blockType: _dropped, ...panelFields } = row
      raw.panel = { kind: blockType, ...panelFields }
    }
  }
  return cloned
}
