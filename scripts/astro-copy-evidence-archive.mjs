/**
 * 台账证据归档门禁（spec H-1 的机器对面，零参数、只读、可重复跑）。
 *
 * 动因：`evidence/verification.jsonl` 的 artifact 指针 100% 指向 gitignored 的
 * `.aiws/tmp/astro-page-copy-cms/`——换一台 clone 就全部失效，而台账是本 change 唯一被设计成
 * 「机器可复核」的证据载体。对策是把台账引用到的工件按原文件名镜像进 `evidence/logs/`（入库），
 * 本门禁核对镜像是否忠实。
 *
 * 判定（任一不成立即非零退出并逐条列出）：
 *   1. 台账每行都有 artifact 字段；
 *   2. 不同 artifact 的 basename 两两不相等（撞名 ⇒ 镜像会互相覆盖，比对无意义）；
 *   3. `evidence/logs/<basename>` 存在；
 *   4. 原件仍在 tmp 时，镜像与原件 sha256 必须逐字节相等；原件已被清理时只断言镜像存在，
 *      并把这类行数统计打出来（不静默跳过）。
 *
 * 用法：`node scripts/astro-copy-evidence-archive.mjs`（不写任何文件）
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_REL = '.aiws/changes/astro-page-copy-cms/evidence/verification.jsonl'
const ARCHIVE_REL = '.aiws/changes/astro-page-copy-cms/evidence/logs'

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

const lines = readFileSync(join(repoRoot, LEDGER_REL), 'utf8').trim().split(/\r?\n/)
const problems = []
/** artifact 路径 → 指向它的台账行号（同一工件可被多行引用）。 */
const pointers = new Map()
let linesWithoutArtifact = 0

for (const [i, line] of lines.entries()) {
  const rec = JSON.parse(line)
  if (typeof rec.artifact !== 'string' || rec.artifact.length === 0) {
    linesWithoutArtifact++
    problems.push(`台账第 ${i + 1} 行缺 artifact 字段（command=${rec.command}）`)
    continue
  }
  const artifact = rec.artifact.replace(/\\/g, '/')
  if (!pointers.has(artifact)) pointers.set(artifact, [])
  pointers.get(artifact).push(i + 1)
}

// basename 撞名检查：镜像用原文件名存放，两个不同工件同名 ⇒ 后者覆盖前者。
const byBasename = new Map()
for (const artifact of pointers.keys()) {
  const base = artifact.slice(artifact.lastIndexOf('/') + 1)
  if (!byBasename.has(base)) byBasename.set(base, [])
  byBasename.get(base).push(artifact)
}
for (const [base, artifacts] of byBasename) {
  if (artifacts.length > 1) problems.push(`basename 撞名：${base} ← ${artifacts.join(' | ')}`)
}

let shaVerifiedLines = 0
let originalGoneLines = 0
for (const [artifact, lineNos] of pointers) {
  const base = artifact.slice(artifact.lastIndexOf('/') + 1)
  const mirror = join(repoRoot, ARCHIVE_REL, base)
  const where = `台账第 ${lineNos.join(',')} 行 → ${artifact}`
  if (!existsSync(mirror)) {
    problems.push(`缺归档件 ${ARCHIVE_REL}/${base}（${where}）`)
    continue
  }
  const original = join(repoRoot, artifact)
  if (!existsSync(original)) {
    originalGoneLines += lineNos.length
    continue
  }
  const mirrorSum = sha256(readFileSync(mirror))
  const originalSum = sha256(readFileSync(original))
  if (mirrorSum !== originalSum) {
    problems.push(`sha256 不一致 ${base}\n    归档=${mirrorSum}\n    原件=${originalSum}（${where}）`)
    continue
  }
  shaVerifiedLines += lineNos.length
}

console.log(
  `[evidence-archive] 台账行数=${lines.length} 无 artifact 行=${linesWithoutArtifact} ` +
    `不同 artifact=${pointers.size} 归档目录=${ARCHIVE_REL}`,
)
console.log(
  `  台账行 sha256 与原件一致=${shaVerifiedLines} 原件已清理（仅断言归档件存在）=${originalGoneLines} ` +
    `问题=${problems.length}`,
)
for (const p of problems) console.error(`  ✗ ${p}`)
console.log(
  problems.length === 0
    ? `[evidence-archive] 台账全部 artifact 均已归档且逐字节可核对（原件缺失、仅核归档件存在的行数 ${originalGoneLines} 已如实计数）`
    : `[evidence-archive] 归档不完整 ⇒ 台账证据不可跨 clone 复核`,
)
process.exitCode = problems.length === 0 ? 0 : 1
