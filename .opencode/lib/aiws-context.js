/**
 * AiwsContext — Shared utility library for aiws OpenCode plugins
 *
 * Provides file reading, JSONL parsing (5-field format), session dedup,
 * change detection, and spec index building.
 *
 * Zero external dependencies. All JS, no Python.
 * Reference: trellis/packages/cli/src/templates/opencode/lib/trellis-context.js
 */

import { existsSync, readFileSync, appendFileSync, readdirSync, statSync, mkdirSync } from "fs"
import { join, isAbsolute, relative } from "path"

const DEBUG_LOG = "/tmp/aiws-plugin-debug.log"

export function debugLog(prefix, ...args) {
  const ts = new Date().toISOString()
  const msg =
    `[${ts}] [${prefix}] ${args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")}\n`
  try {
    appendFileSync(DEBUG_LOG, msg)
  } catch {
    // ignore
  }
}

/**
 * Check if a string value is non-empty
 */
function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/**
 * Look up a nested key from an object, trying multiple key names
 */
function lookupString(data, keys) {
  if (!data || typeof data !== "object") return null
  for (const key of keys) {
    const v = str(data[key])
    if (v) return v
  }
  // recurse into common wrapper objects
  for (const nested of ["input", "properties", "event", "hook_input", "hookInput"]) {
    const v = lookupString(data[nested], keys)
    if (v) return v
  }
  return null
}

/**
 * Resolve a relative path against the project directory.
 * If already absolute, return as-is.
 */
function resolvePath(directory, relPath) {
  if (isAbsolute(relPath)) return relPath
  return join(directory, relPath)
}

/**
 * Read optional numeric sections from a JSONL entry.
 * Returns null if no sections specified.
 */
function parseSections(entry) {
  const raw = entry.sections
  if (!Array.isArray(raw) || raw.length === 0) return null
  return raw.map(s => {
    if (!Array.isArray(s) || s.length < 2) return null
    return [Math.max(1, s[0]), Math.max(1, s[1])]
  }).filter(Boolean)
}


// ============================================================
// Context injection limits (trellis #441 / TOOLING-003A)
// Defaults mirror trellis: 32KiB / 64KiB / 128KiB; 0 = unlimited
// Env: AIWS_CONTEXT_MAX_FILE_BYTES | AIWS_CONTEXT_MAX_ARTIFACT_BYTES | AIWS_CONTEXT_MAX_TOTAL_BYTES
// ============================================================

export const DEFAULT_CONTEXT_INJECTION_LIMITS = Object.freeze({
  max_file_bytes: 32768,
  max_artifact_bytes: 65536,
  max_total_bytes: 131072,
})

/**
 * Parse a non-negative integer env override; invalid/missing → default.
 * Note: empty string is invalid → default (use "0" for unlimited).
 */
function parseLimitEnv(name, defaultValue) {
  const raw = process.env[name]
  if (raw === undefined || raw === null || raw === "") return defaultValue
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0) return defaultValue
  return n
}

/** Resolve context injection byte limits from env (or defaults). */
export function getContextInjectionLimits() {
  return {
    max_file_bytes: parseLimitEnv("AIWS_CONTEXT_MAX_FILE_BYTES", DEFAULT_CONTEXT_INJECTION_LIMITS.max_file_bytes),
    max_artifact_bytes: parseLimitEnv("AIWS_CONTEXT_MAX_ARTIFACT_BYTES", DEFAULT_CONTEXT_INJECTION_LIMITS.max_artifact_bytes),
    max_total_bytes: parseLimitEnv("AIWS_CONTEXT_MAX_TOTAL_BYTES", DEFAULT_CONTEXT_INJECTION_LIMITS.max_total_bytes),
  }
}

/**
 * Truncate raw bytes to at most `cap` without splitting a UTF-8 multi-byte sequence.
 * `cap <= 0` means unlimited — returns data unchanged.
 * @param {Buffer} data
 * @param {number} cap
 * @returns {Buffer}
 */
export function truncateUtf8(data, cap) {
  if (!Buffer.isBuffer(data)) {
    data = Buffer.from(data ?? "", "utf8")
  }
  if (cap <= 0 || data.length <= cap) return data

  let truncated = data.subarray(0, cap)
  let i = truncated.length
  // Back off over continuation bytes (10xxxxxx)
  while (i > 0 && (truncated[i - 1] & 0xc0) === 0x80) {
    i -= 1
  }
  if (i === 0) return Buffer.alloc(0)

  const lead = truncated[i - 1]
  if (lead & 0x80) {
    let seqLen = 1
    if ((lead & 0xe0) === 0xc0) seqLen = 2
    else if ((lead & 0xf0) === 0xe0) seqLen = 3
    else if ((lead & 0xf8) === 0xf0) seqLen = 4
    // Drop the lead byte too if its full sequence didn't fit
    if (i - 1 + seqLen > truncated.length) {
      i -= 1
    }
  }
  return truncated.subarray(0, i)
}

function truncateNotice(path, cap) {
  return `\n[AIWS: truncated at ${cap} bytes — read ${path} for the full content]`
}

function indexNotice(path, size, reason) {
  return (
    `[AIWS: not inlined (total context limit reached) — ` +
    `${path} (${size} bytes): ${reason || "budget"}]`
  )
}

class ContextBudget {
  constructor(maxTotalBytes) {
    this.maxTotalBytes = maxTotalBytes
    this.used = 0
  }
  hasRoom(size) {
    if (this.maxTotalBytes <= 0) return true
    return this.used + size <= this.maxTotalBytes
  }
  add(size) {
    this.used += size
  }
}

// ============================================================
// Workflow skip keyword (trellis #427 / TOOLING-003A)
// Default: no-aiws; env AIWS_WORKFLOW_SKIP_KEYWORD ("" disables)
// ============================================================

export const DEFAULT_WORKFLOW_SKIP_KEYWORD = "no-aiws"

/**
 * Resolve per-turn workflow-state skip keyword.
 * - unset → "no-aiws"
 * - "" → disabled (never matches)
 * - any other string → custom keyword
 */
export function resolveWorkflowSkipKeyword() {
  if (!Object.prototype.hasOwnProperty.call(process.env, "AIWS_WORKFLOW_SKIP_KEYWORD")) {
    return DEFAULT_WORKFLOW_SKIP_KEYWORD
  }
  return String(process.env.AIWS_WORKFLOW_SKIP_KEYWORD)
}

/**
 * Case-insensitive, word-boundary match of `keyword` in `text`.
 * Hyphen counts as a word char so "no-aiwsx" / "foo-no-aiws" don't match.
 * Empty keyword never matches.
 */
export function promptHasSkipKeyword(text, keyword) {
  if (!keyword || typeof text !== "string") return false
  const escaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i")
  return pattern.test(text)
}


// ============================================================
// AiwsContext
// ============================================================

export class AiwsContext {
  constructor(directory) {
    this.directory = directory
    debugLog("context", "AiwsContext initialized", { directory })
  }

  // -- Project detection ---------------------------------------

  /** True when this is an aiws-managed project */
  isAiwsProject() {
    return (
      existsSync(join(this.directory, "packages", "spec")) ||
      existsSync(join(this.directory, "AI_PROJECT.md"))
    )
  }

  // -- Session identity -----------------------------------------

  /**
   * Derive a stable session key from the environment or hook input.
   *
   * Priority order (matching trellis getContextKey):
   *   1. OPENCODE_RUN_ID (set by OpenCode runtime)
   *   2. input.sessionID (from chat.message or tool.execute.before hook)
   *   3. input.conversationID
   *
   * Returns null when no identity source is available.
   */
  getSessionKey(platformInput = null) {
    const runId = str(process.env.OPENCODE_RUN_ID)
    if (runId) return `opencode_run_${runId}`

    if (!platformInput || typeof platformInput !== "object") return null

    const sid = lookupString(platformInput, ["session_id", "sessionId", "sessionID"])
    if (sid) return `session_${sid}`

    const cid = lookupString(platformInput, ["conversation_id", "conversationId", "conversationID"])
    if (cid) return `conv_${cid}`

    return null
  }

  // -- File reading ---------------------------------------------

  /** Read a file, returning null on any error */
  readFile(filePath) {
    try {
      if (existsSync(filePath)) return readFileSync(filePath, "utf-8")
    } catch {
      // ignore
    }
    return null
  }

  /** Read a file relative to the project root */
  readProjectFile(relPath) {
    return this.readFile(resolvePath(this.directory, relPath))
  }

  // -- JSONL parsing (5-field format) ---------------------------

  /**
   * Read a JSONL file and load referenced file contents.
   *
   * Supports aiws 5-field format:
   *   {"glob": "path/to/file.md", "sections": [[25,50]], "priority": "high", "kind": "truth", "reason": "why"}
   *
   * Returns array of { path, content, priority, kind, reason }
   * Sorted by priority: high → medium → low
   */
  /**
   * Read a JSONL file and load referenced file contents with byte caps (#441).
   *
   * Supports aiws 5-field format:
   *   {"file"|"glob": "...", "sections": [[25,50]], "priority": "high", "kind": "truth", "reason": "why"}
   *
   * Pipeline per entry (after priority sort of *candidates*):
   *   1. read file bytes
   *   2. optional section filter (line-based on UTF-8 text)
   *   3. per-file truncateUtf8 (max_file_bytes; 0 = unlimited)
   *   4. total budget: if full block won't fit → mode "index" notice only
   *
   * Returns array of:
   *   { path, content, priority, kind, reason, mode: "inline"|"truncated"|"index", byteSize?, originalByteSize? }
   * Sorted by priority: high → medium → low (stable relative to JSONL order within tier).
   */
  readJsonlWithFiles(jsonlPath, limits = null) {
    const content = this.readFile(jsonlPath)
    if (!content) return []

    const lim = limits || getContextInjectionLimits()
    const candidates = []

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue
      try {
        const item = JSON.parse(line)

        const globPattern = item.glob || item.file
        if (!globPattern) continue

        const priority = item.priority || "medium"
        const kind = item.kind || "unknown"
        const reason = item.reason || ""
        const sections = parseSections(item)

        const fullPath = resolvePath(this.directory, globPattern)
        let rawBytes
        try {
          if (!existsSync(fullPath)) continue
          rawBytes = readFileSync(fullPath)
        } catch {
          continue
        }
        if (!rawBytes || rawBytes.length === 0) {
          // empty file still allowed as empty content
          rawBytes = Buffer.alloc(0)
        }

        let text = rawBytes.toString("utf8")
        const originalByteSize = Buffer.byteLength(text, "utf8")

        // Apply section filtering if specified (before byte caps)
        if (sections) {
          const lines = text.split("\n")
          const filtered = []
          for (const [start, end] of sections) {
            const from = Math.max(0, start - 1)
            const to = Math.min(lines.length, end)
            filtered.push(...lines.slice(from, to))
          }
          text = filtered.join("\n")
        }

        candidates.push({
          path: globPattern,
          text,
          priority,
          kind,
          reason,
          originalByteSize,
        })
      } catch {
        // Skip malformed lines
      }
    }

    // Sort: high → medium → low (preserve relative order within tier via stable sort)
    const order = { high: 0, medium: 1, low: 2 }
    candidates.sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2))

    const budget = new ContextBudget(lim.max_total_bytes)
    const entries = []

    for (const c of candidates) {
      const sectionBytes = Buffer.from(c.text, "utf8")
      const fileCap = lim.max_file_bytes
      const truncatedBytes = truncateUtf8(sectionBytes, fileCap)
      let body = truncatedBytes.toString("utf8")
      let mode = "inline"
      if (truncatedBytes.length < sectionBytes.length) {
        mode = "truncated"
        body += truncateNotice(c.path, fileCap)
      }

      // Budget the emitted block the same shape as buildContextFromEntries header+content
      const header = `=== ${c.path} ===${c.reason ? ` (${c.reason})` : ""}`
      const block = `${header}\n${body}`
      const blockBytes = Buffer.byteLength(block, "utf8")

      if (!budget.hasRoom(blockBytes)) {
        const notice = indexNotice(c.path, c.originalByteSize, c.reason)
        budget.add(Buffer.byteLength(notice, "utf8"))
        entries.push({
          path: c.path,
          content: notice,
          priority: c.priority,
          kind: c.kind,
          reason: c.reason,
          mode: "index",
          byteSize: Buffer.byteLength(notice, "utf8"),
          originalByteSize: c.originalByteSize,
        })
        continue
      }

      budget.add(blockBytes)
      entries.push({
        path: c.path,
        content: body,
        priority: c.priority,
        kind: c.kind,
        reason: c.reason,
        mode,
        byteSize: Buffer.byteLength(body, "utf8"),
        originalByteSize: c.originalByteSize,
      })
    }

    return entries
  }

  // -- Context building ------------------------------------------

  /**
   * Build injected context text from JSONL entries.
   * Returns a formatted string with file separators.
   */
  buildContextFromEntries(entries) {
    if (!entries || entries.length === 0) return ""
    return entries
      .map(e => {
        // index mode content is already a self-describing notice (no === header)
        if (e.mode === "index") return e.content
        const modeTag = e.mode && e.mode !== "inline" ? ` [mode=${e.mode}]` : ""
        const header = `=== ${e.path} ===${e.reason ? ` (${e.reason})` : ""}${modeTag}`
        return `${header}\n${e.content}`
      })
      .join("\n\n")
  }

  /** Build context and return a wrapped message block */
  buildContextBlock(entries) {
    const body = this.buildContextFromEntries(entries)
    if (!body) return ""
    return `<aiws-context>\n${body}\n</aiws-context>`
  }

  // -- Change detection ------------------------------------------

  /**
   * Detect currently active change by scanning .aiws/changes/<id>/.
   * Returns the most recently modified change's id and detail, or null.
   */
  getActiveChange() {
    const changesDir = join(this.directory, ".aiws", "changes")
    if (!existsSync(changesDir)) return null

    let dirs
    try {
      dirs = readdirSync(changesDir)
        .filter(name => name !== "archive" && name !== "templates")
        .map(name => {
          const full = join(changesDir, name)
          try {
            return { name, mtime: statSync(full).mtimeMs, dir: full }
          } catch {
            return null
          }
        })
        .filter(Boolean)
    } catch {
      return null
    }

    if (dirs.length === 0) return null

    // Most recently modified directory wins
    dirs.sort((a, b) => b.mtime - a.mtime)
    return this.getChangeDetail(dirs[0].name)
  }

  /**
   * Get detailed info about a specific change directory.
   * Scans plan/, analysis/, evidence/, patches/ subdirs.
   */
  getChangeDetail(changeId) {
    const changeDir = join(this.directory, ".aiws", "changes", changeId)
    if (!existsSync(changeDir)) return null

    const detail = {
      id: changeId,
      dir: changeDir,
      proposal: null,
      planFiles: [],
      analysisFiles: [],
      contextRoles: [],
      evidenceFiles: [],
      patchesCount: 0,
      hasHandoff: false,
      phase: "unknown",
    }

    const proposalPath = join(changeDir, "proposal.md")
    if (existsSync(proposalPath)) {
      detail.proposal = this.readFile(proposalPath)
    }

    const planDir = join(changeDir, "plan")
    if (existsSync(planDir)) {
      try {
        detail.planFiles = readdirSync(planDir)
          .filter(f => f.endsWith(".md"))
          .sort()
          .reverse()
      } catch { /* ignore */ }
    }

    const analysisDir = join(changeDir, "analysis")
    if (existsSync(analysisDir)) {
      try {
        const files = readdirSync(analysisDir)
        detail.analysisFiles = files.filter(f => f.endsWith(".md"))
        detail.contextRoles = files
          .filter(f => f.endsWith("-context.jsonl"))
          .map(f => f.replace("-context.jsonl", ""))
      } catch { /* ignore */ }
    }

    // Evidence dir
    const evidenceDir = join(changeDir, "evidence")
    if (existsSync(evidenceDir)) {
      try {
        detail.evidenceFiles = readdirSync(evidenceDir)
          .filter(f => f.endsWith(".md"))
      } catch { /* ignore */ }
    }

    // Patches dir
    const patchesDir = join(changeDir, "patches")
    if (existsSync(patchesDir)) {
      try {
        detail.patchesCount = readdirSync(patchesDir).length
      } catch { /* ignore */ }
    }

    // Handoff
    detail.hasHandoff = existsSync(join(changeDir, "handoff.md"))

    // Authoritative phase from .ws-change.json (CLI writes it back idempotently);
    // fall back to file-structure estimation when absent/invalid.
    let metaPhase = null
    const metaPath = join(changeDir, ".ws-change.json")
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(this.readFile(metaPath))
        if (meta && typeof meta.phase === "string") metaPhase = meta.phase
      } catch { /* ignore malformed meta */ }
    }

    // Phase estimation
    detail.phase = this._estimatePhase(detail, metaPhase)

    return detail
  }

  // State machine: intake → planning → ready-for-dev → in-progress → review → finished
  static PHASES = [
    "intake",
    "planning",
    "ready-for-dev",
    "in-progress",
    "review",
    "finished",
  ]

  static PHASE_TRANSITIONS = {
    intake:        new Set(["planning"]),
    planning:      new Set(["ready-for-dev", "intake"]),
    "ready-for-dev": new Set(["in-progress", "planning"]),
    "in-progress": new Set(["review", "ready-for-dev"]),
    review:        new Set(["finished", "in-progress"]),
    finished:      new Set(["intake"]),
  }

  static isValidTransition(from, to) {
    const allowed = AiwsContext.PHASE_TRANSITIONS[from]
    return allowed ? allowed.has(to) : false
  }

  _estimatePhase(detail, metaPhase) {
    if (metaPhase && AiwsContext.PHASES.includes(metaPhase)) return metaPhase
    if (!detail.proposal) return "intake"
    if (detail.planFiles.length === 0) return "planning"
    if (detail.patchesCount > 0) return "in-progress"
    if (detail.evidenceFiles.length > 0) return "review"
    if (detail.hasHandoff) return "finished"
    return "ready-for-dev"
  }

  getPhaseSuggestions(changeId) {
    const detail = this.getChangeDetail(changeId)
    if (!detail) return []
    const current = detail.phase
    return [...(AiwsContext.PHASE_TRANSITIONS[current] || new Set())]
  }

  getPhaseSummary(changeId) {
    const detail = this.getChangeDetail(changeId)
    if (!detail) return ""
    const current = detail.phase
    const suggestions = this.getPhaseSuggestions(changeId)
    const idx = AiwsContext.PHASES.indexOf(current)
    const total = AiwsContext.PHASES.length
    return (
      `Phase: ${current} (${idx + 1}/${total})\n` +
      `Valid next: ${suggestions.join(", ") || "(none)"}\n` +
      `Proposal: ${detail.proposal ? "yes" : "no"}\n` +
      `Plans: ${detail.planFiles.length}\n` +
      `Analysis files: ${detail.analysisFiles.length}\n` +
      `Context JSONLs: ${detail.contextRoles.join(", ") || "none"}\n` +
      `Evidence: ${detail.evidenceFiles.length}\n` +
      `Patches: ${detail.patchesCount}\n` +
      `Handoff: ${detail.hasHandoff ? "yes" : "no"}`
    )
  }

  // -- Goal FSM (TOOLING-003D L1 inject) -------------------------------

  /**
   * Scan `.aiws/goals/*.state.json` for active/paused goals.
   * Preference: status=active first, then paused.
   * Within a status tier, most recently updated wins (updated_at ISO or file mtime).
   *
   * Returns array of goal summary objects (may be empty). Never throws.
   * Each entry:
   *   { goal_id, status, current_phase, checkpoint_summary, md_path, state_path,
   *     next_action, updated_at, mtime_ms, others_note? }
   */
  getActiveGoals() {
    const goalsDir = join(this.directory, ".aiws", "goals")
    if (!existsSync(goalsDir)) return []

    let files
    try {
      files = readdirSync(goalsDir).filter(f => f.endsWith(".state.json"))
    } catch {
      return []
    }

    const active = []
    const paused = []

    for (const file of files) {
      const statePath = join(goalsDir, file)
      let raw
      try {
        raw = readFileSync(statePath, "utf-8")
      } catch {
        continue
      }

      let state
      try {
        state = JSON.parse(raw)
      } catch {
        // malformed JSON — skip without crashing
        continue
      }
      if (!state || typeof state !== "object") continue

      const status = str(state.status)
      if (status !== "active" && status !== "paused") continue

      const goalId =
        str(state.goal_id) ||
        str(state.goalId) ||
        file.replace(/\.state\.json$/, "")

      let mtimeMs = 0
      try {
        mtimeMs = statSync(statePath).mtimeMs
      } catch {
        mtimeMs = 0
      }

      const updatedAt = str(state.updated_at) || str(state.updatedAt) || null
      let sortKey = mtimeMs
      if (updatedAt) {
        const t = Date.parse(updatedAt)
        if (!Number.isNaN(t)) sortKey = t
      }

      const currentPhase =
        state.current_phase == null
          ? null
          : (str(state.current_phase) || String(state.current_phase))

      const checkpointSummary = this._summarizeGoalCheckpoints(state.checkpoints)
      const mdPath = join(".aiws", "goals", `${goalId}.md`)
      const nextAction = this._suggestGoalNextAction({
        goal_id: goalId,
        status,
        current_phase: currentPhase,
        checkpoints: state.checkpoints,
      })

      const entry = {
        goal_id: goalId,
        status,
        current_phase: currentPhase,
        checkpoint_summary: checkpointSummary,
        md_path: mdPath,
        state_path: join(".aiws", "goals", file),
        next_action: nextAction,
        updated_at: updatedAt,
        mtime_ms: mtimeMs,
        _sort: sortKey,
      }

      if (status === "active") active.push(entry)
      else paused.push(entry)
    }

    const byRecency = (a, b) => b._sort - a._sort
    active.sort(byRecency)
    paused.sort(byRecency)

    const ordered = [...active, ...paused]
    return ordered.map(({ _sort, ...rest }) => rest)
  }

  /**
   * Primary goal for session inject: first of getActiveGoals() (active preferred).
   * When multiple actives exist, the most recently updated is primary; callers can
   * list others via getActiveGoals().
   */
  getActiveGoal() {
    const goals = this.getActiveGoals()
    return goals.length > 0 ? goals[0] : null
  }

  _summarizeGoalCheckpoints(checkpoints) {
    if (!checkpoints || typeof checkpoints !== "object") return "(no checkpoints)"
    const pending = []
    const complete = []
    for (const [name, cp] of Object.entries(checkpoints)) {
      const st =
        cp && typeof cp === "object"
          ? str(cp.status) || "unknown"
          : "unknown"
      if (st === "complete" || st === "done") complete.push(name)
      else pending.push(`${name}:${st}`)
    }
    const parts = []
    if (pending.length) parts.push(`pending=[${pending.join(", ")}]`)
    if (complete.length) parts.push(`complete=${complete.length}`)
    return parts.join(" ") || "(empty checkpoints)"
  }

  /**
   * Suggest next_action text for L1 inject (READ-ONLY; no skill execution).
   * Frozen Q3=A: plugins only inject text; model/user runs /ws-goal.
   */
  _suggestGoalNextAction({ goal_id, status, current_phase, checkpoints }) {
    const id = goal_id || "?"
    if (status === "paused") {
      return `/ws-goal resume ${id}`
    }
    // active
    if (!current_phase || current_phase === "null") {
      return `/ws-goal continue ${id} (establish current_phase via advance if needed)`
    }
    // Find first incomplete checkpoint name if useful
    let nextCp = null
    if (checkpoints && typeof checkpoints === "object") {
      for (const [name, cp] of Object.entries(checkpoints)) {
        const st =
          cp && typeof cp === "object" ? str(cp.status) : null
        if (st && st !== "complete" && st !== "done") {
          nextCp = name
          break
        }
      }
    }
    if (nextCp && nextCp !== current_phase) {
      return `/ws-goal continue ${id} — phase=${current_phase}, next checkpoint=${nextCp}`
    }
    return `/ws-goal continue ${id} — phase=${current_phase}`
  }

  /**
   * Compact <goal-context> block for session-start inject.
   * Empty string when no active/paused goal.
   */
  buildGoalContextBlock() {
    const goals = this.getActiveGoals()
    if (!goals.length) return ""

    const primary = goals[0]
    const others = goals.slice(1)
    const lines = [
      "<goal-context>",
      "## Active / Paused Goal (FSM L1 inject — advisory routing only)",
      `goal_id: ${primary.goal_id}`,
      `status: ${primary.status}`,
      `current_phase: ${primary.current_phase ?? "null"}`,
      `checkpoints: ${primary.checkpoint_summary}`,
      `goal_md: ${primary.md_path}`,
      `state: ${primary.state_path}`,
      `next_action: ${primary.next_action}`,
    ]
    if (others.length) {
      const brief = others
        .map(g => `${g.goal_id}(${g.status}, phase=${g.current_phase ?? "null"})`)
        .join("; ")
      lines.push(`other_goals: ${brief}`)
      lines.push(
        "note: multiple active/paused — primary is most recently updated; " +
          "resolve conflict before parallel goal work"
      )
    }
    lines.push(
      "authority: phase writes via `aiws goal advance` only; " +
        "this block does not execute skills (L1 text inject)."
    )
    lines.push("</goal-context>")
    return lines.join("\n")
  }

  // -- Spec index ------------------------------------------------

  /**
   * Build an index of packages/spec/docs/*.md files.
   * Returns a formatted markdown string listing all spec docs with descriptions.
   */
  getSpecIndex() {
    const specDir = join(this.directory, "packages", "spec", "docs")
    if (!existsSync(specDir)) return ""

    let files
    try {
      files = readdirSync(specDir)
        .filter(f => f.endsWith(".md"))
        .sort()
    } catch {
      return ""
    }

    if (files.length === 0) return ""

    const parts = ["## packages/spec/docs/ — Spec Index"]
    for (const f of files) {
      // Extract first heading as description
      const content = this.readFile(join(specDir, f))
      let desc = ""
      if (content) {
        const firstH1 = content.match(/^#\s+(.+)/m)
        const firstH2 = content.match(/^##\s+(.+)/m)
        desc = firstH1?.[1] || firstH2?.[1] || f.replace(/\.md$/, "")
      }
      parts.push(`- \`spec/docs/${f}\` — ${desc}`)
    }

    return parts.join("\n") + "\n"
  }

  // -- Change state for continuation / new-session resume -------

  /**
   * Get the current change state for continuation routing.
   *
   * Returns { changeId, phase, lastEvent, lastDelegation, nextAction }
   *
   * - `lastEvent`: last breadcrumb event from today's journal (or null)
   * - `lastDelegation`: last delegation entry from today's journal (or null)
   * - `nextAction`: derived from phase + delegation status using the
   *    continuation decision table defined in the using-aiws SKILL.md.
   *
   * Safe to call even when no active change or journal exists — returns
   * a minimal state object with phase="none" and nextAction pointing to
   * ws-intake/ws-plan.
   */
  getChangeState(changeId = null) {
    const id = changeId || this.getActiveChange()?.id || null
    if (!id) {
      return {
        changeId: null,
        phase: "none",
        lastEvent: null,
        lastDelegation: null,
        nextAction: "Start with ws-intake or ws-plan to establish a change context",
      }
    }

    const detail = this.getChangeDetail(id)
    const phase = detail?.phase || "unknown"

    // Read today's journal for last event and delegation
    const journal = new AiwsSessionJournal(this.directory)
    const todayEntries = journal.readToday()
    const delegationEntries = todayEntries.filter(e => e.event === "delegation")
    const breadcrumbEntries = todayEntries.filter(e => e.event === "breadcrumb")

    const lastEvent = breadcrumbEntries.length > 0
      ? breadcrumbEntries[breadcrumbEntries.length - 1]
      : null

    const lastDelegation = delegationEntries.length > 0
      ? delegationEntries[delegationEntries.length - 1]
      : null

    // Derive next action from continuation decision table
    const nextAction = this._deriveNextAction(phase, lastDelegation, detail)

    return {
      changeId: id,
      phase,
      lastEvent,
      lastDelegation,
      nextAction,
    }
  }

  /**
   * Derive next action from phase + delegation status + detail artifacts.
   * Mirrors the continuation decision table in using-aiws/SKILL.md.
   */
  _deriveNextAction(phase, lastDelegation, detail) {
    // Check for blocked delegation
    if (lastDelegation && lastDelegation.status === "BLOCKED") {
      return `BLOCKED from previous delegation: ${lastDelegation.reason || "unknown reason"}. Resolve blocker before continuing.`
    }

    // Check for NEEDS_CONTEXT delegation
    if (lastDelegation && lastDelegation.status === "NEEDS_CONTEXT") {
      return `NEEDS_CONTEXT: missing context for ${lastDelegation.role || "worker"}. Supplement context and re-dispatch.`
    }

    // Phase-based routing
    switch (phase) {
      case "intake":
        return "ws-intake or ws-plan to create a change and execution plan"
      case "planning": {
        // If plan files exist, recommend verify; otherwise recommend plan
        if (detail && detail.planFiles.length > 0) {
          return "aiws plan-verify to review existing plan"
        }
        return "ws-plan to complete planning"
      }
      case "ready-for-dev":
        return "dispatch aiws-worker (subagent-first — main session does not write code directly)"
      case "in-progress": {
        // If worktree is dirty (patches exist) → recommend reviewer
        if (detail && detail.patchesCount > 0) {
          return "dispatch aiws-reviewer + ws-review to audit changes"
        }
        // If we have a prior delegation that was DONE_WITH_CONCERNS
        if (lastDelegation && lastDelegation.status === "DONE_WITH_CONCERNS") {
          return "ws-quality-review to assess residual risk before continuing"
        }
        return "continue implementation or dispatch aiws-reviewer"
      }
      case "review": {
        if (detail && detail.evidenceFiles.length > 0) {
          return "ws-finish or aiws commit — evidence exists, ready to finalize"
        }
        return "collect evidence first, then aiws commit"
      }
      case "finished":
        return "ws-finish to finalize and archive the change"
      default:
        return "Review phase and artifacts; consider ws-preflight to reassess"
    }
  }

  // -- Git status ------------------------------------------------

  // -- Spec auto-update (P2 #1) ---------------------------------

  /**
   * Scan the active change's analysis/ directory for spec-update.jsonl.
   * Returns parsed entries, or empty array if none found.
   *
   * Format: same 5-field as context-injection, plus optional "proposal" text.
   *   {"file": "packages/spec/docs/some-spec.md", "reason": "rule about X missing",
   *    "sections": [[25,50]], "proposal": "Add: new rule prohibiting async in constructors",
   *    "priority": "high", "kind": "spec-update"}
   */
  scanSpecUpdates(changeId) {
    const changeDir = join(this.directory, ".aiws", "changes", changeId)
    if (!existsSync(changeDir)) return []

    const jsonlPath = join(changeDir, "analysis", "spec-update.jsonl")
    const raw = this.readFile(jsonlPath)
    if (!raw) return []

    const entries = []
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      try {
        const item = JSON.parse(trimmed)
        const filePath = item.file || item.glob
        if (!filePath) continue
        entries.push({
          file: filePath,
          sections: parseSections(item),
          priority: item.priority || "medium",
          kind: item.kind || "spec-update",
          reason: item.reason || "",
          proposal: item.proposal || "",
          status: item.status || "pending",
        })
      } catch {
        // skip malformed lines
      }
    }

    return entries
  }

  /**
   * Generate structured spec-update alert text from a change's spec-update.jsonl.
   * For each entry, loads the current spec file content and shows the proposal.
   */
  proposeSpecUpdates(changeId) {
    const entries = this.scanSpecUpdates(changeId)
    if (entries.length === 0) return ""

    const parts = ["## Spec Updates Pending"]
    for (const e of entries) {
      const fullPath = resolvePath(this.directory, e.file)
      const currentContent = this.readFile(fullPath)
      const excerpt = currentContent
        ? currentContent.split("\n").slice(0, 15).join("\n")
        : "(file not found)"

      parts.push(`\n### ${e.file}`)
      parts.push(`**Reason:** ${e.reason}`)
      if (e.proposal) parts.push(`**Proposal:** ${e.proposal}`)
      parts.push(`**Current (first 15 lines):**\n\`\`\`\n${excerpt}\n\`\`\``)
    }

    parts.push(
      "\n**Action required:** Review each proposal. " +
      "Edit the spec file directly, then update `spec-update.jsonl` with `status: \"applied\"`."
    )

    return parts.join("\n")
  }

  /** Get a short git status summary string */
  getGitStatus() {
    const head = str(process.env.GIT_HEAD) || null
    const branch = str(process.env.GIT_BRANCH) || null

    const parts = []
    if (branch) parts.push(`branch: ${branch}`)
    if (head) parts.push(`HEAD: ${head.slice(0, 8)}`)
    return parts.length > 0 ? parts.join(", ") : ""
  }
}

// ============================================================
// Session journal (G11)
// ============================================================

/**
 * AiwsSessionJournal — Writes structured JSONL entries to .aiws/journal/.
 *
 * Each entry is a single JSONL line with:
 *   {"ts": "<ISO-time>", "event": "<type>", "session": "<key>", ...data}
 *
 * Event types: session_start, delegation, phase_transition, spec_change, milestone
 */
export class AiwsSessionJournal {
  constructor(directory) {
    this.directory = directory
    this.journalDir = join(directory, ".aiws", "journal")
    this._ensureDir()
  }

  _ensureDir() {
    try {
      mkdirSync(this.journalDir, { recursive: true })
    } catch { /* ignore */ }
  }

  get _journalPath() {
    return join(this.journalDir, `${new Date().toISOString().slice(0, 10)}.jsonl`)
  }

  write(eventType, sessionKey, data = {}) {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      event: eventType,
      session: sessionKey,
      ...data,
    })
    try {
      appendFileSync(this._journalPath, entry + "\n")
    } catch { /* ignore */ }
  }

  readToday() {
    try {
      const content = readFileSync(this._journalPath, "utf-8")
      return content
        .split(/\r?\n/)
        .filter(Boolean)
        .map(l => { try { return JSON.parse(l) } catch { return null } })
        .filter(Boolean)
    } catch {
      return []
    }
  }

  getRecentSessions(count = 5) {
    const entries = this.readToday()
    const seen = new Set()
    return entries
      .filter(e => { const k = e.session; return seen.has(k) ? false : (seen.add(k), true) })
      .slice(-count)
  }

  /**
   * Record a delegation event (subagent dispatched).
   *
   * Example:
   *   journal.writeDelegation(sessionKey, "worker", "change-123", {
   *     taskDescription: "implement auth middleware",
   *     contextFiles: 3,
   *   })
   */
  writeDelegation(sessionKey, role, changeId, extra = {}) {
    this.write("delegation", sessionKey, {
      role,
      changeId,
      ...extra,
    })
  }

  /**
   * Record a per-turn breadcrumb event.
   *
   * Example:
   *   journal.writeBreadcrumb(sessionKey, "dev", changeId, { turn: 5 })
   */
  writeBreadcrumb(sessionKey, phase, changeId, extra = {}) {
    this.write("breadcrumb", sessionKey, {
      phase,
      changeId,
      ...extra,
    })
  }

  /**
   * Record a phase transition event.
   *
   * Example:
   *   journal.writePhaseTransition(sessionKey, "planning", "ready-for-dev", changeId)
   */
  writePhaseTransition(sessionKey, fromPhase, toPhase, changeId, extra = {}) {
    this.write("phase_transition", sessionKey, {
      from: fromPhase,
      to: toPhase,
      changeId,
      ...extra,
    })
  }

  /**
   * Read today's journal and produce a structured summary (markdown).
   * Returns null if no entries exist for today.
   *
   * Summary format:
   *   ## Session Journal (today)
   *   - session_start: N entries
   *   - delegation: N entries (by role: worker=N, explorer=N, ...)
   *   - breadcrumb: N entries
   *   - phase_transition: N entries
   */
  getJournalSummary() {
    const entries = this.readToday()
    if (entries.length === 0) return null

    const counts = {}
    const roleCounts = {}

    for (const e of entries) {
      const ev = e.event || "unknown"
      counts[ev] = (counts[ev] || 0) + 1
      if (ev === "delegation" && e.role) {
        roleCounts[e.role] = (roleCounts[e.role] || 0) + 1
      }
    }

    const lines = ["## Session Journal (today)"]
    for (const [ev, n] of Object.entries(counts).sort()) {
      if (ev === "delegation") {
        const byRole = Object.entries(roleCounts)
          .map(([r, n]) => `${r}=${n}`)
          .join(", ")
        lines.push(`- **delegation**: ${n} entries (by role: ${byRole})`)
      } else {
        lines.push(`- **${ev}**: ${n} entries`)
      }
    }

    return lines.join("\n")
  }
}

// ============================================================
// Spec digest (G2)
// ============================================================

import { createHash } from "crypto"

// sha256 digest of all truth + spec files, hex string or ""
export function computeSpecDigest(directory) {
  const targets = [
    "AI_PROJECT.md",
    "REQUIREMENTS.md",
    "AI_WORKSPACE.md",
  ]
  const specDir = join(directory, "packages", "spec", "docs")
  if (existsSync(specDir)) {
    try {
      const docs = readdirSync(specDir).filter(f => f.endsWith(".json") || f.endsWith(".md"))
      for (const d of docs) targets.push(join("packages", "spec", "docs", d))
    } catch { /* ignore */ }
  }

  const hash = createHash("sha256")
  for (const relPath of targets.sort()) {
    const full = join(directory, relPath)
    try {
      const content = readFileSync(full)
      hash.update(relPath)
      hash.update("\x00")
      hash.update(content)
    } catch { /* skip */ }
  }
  return hash.digest("hex")
}

// ============================================================
// Session context builder (for session-start plugin)
// ============================================================

/**
 * Build the full session-start context block.
 * This is the aiws equivalent of trellis's buildSessionContext.
 */
export function buildSessionContext(ctx, platformInput = null) {
  const parts = []
  const digest = computeSpecDigest(ctx.directory)
  if (digest) {
    parts.push(`<spec-digest>\n${digest}\n</spec-digest>`)
  }

  parts.push(`<aiws-context>
You are starting a new session in an aiws-managed project.
Read and follow the context below.
</aiws-context>`)

  // TOOLING-003D L1: active/paused goal FSM inject (READ-ONLY text)
  try {
    const goalBlock = ctx.buildGoalContextBlock()
    if (goalBlock) parts.push(goalBlock)
  } catch {
    // Non-blocking: goal inject must never crash session-start
  }

  const specIndex = ctx.getSpecIndex()
  if (specIndex) {
    parts.push("<spec-index>")
    parts.push(specIndex.trimEnd())
    parts.push("</spec-index>")
  }

  const activeChange = ctx.getActiveChange()
  if (activeChange) {
    // Prefer STATE.md (derived from journal by aiws change state --write)
    let stateContent = ""
    try {
      const statePath = join(ctx.directory, ".aiws", "changes", activeChange.id, "STATE.md")
      if (existsSync(statePath)) {
        stateContent = readFileSync(statePath, "utf8")
      }
    } catch {
      // STATE.md not available, fall back to phase summary
    }

    if (stateContent) {
      parts.push("<change-state-state-md>")
      parts.push("## Current Change State (from STATE.md)")
      parts.push(stateContent.trimEnd())
      parts.push("</change-state-state-md>")
    } else {
      const phaseSummary = ctx.getPhaseSummary(activeChange.id)
      parts.push("<change-context>")
      parts.push(phaseSummary)
      parts.push("</change-context>")
    }

    // .ws-change.json baseline
    try {
      const wsChangePath = join(ctx.directory, ".aiws", "changes", activeChange.id, ".ws-change.json")
      if (existsSync(wsChangePath)) {
        const wsChangeRaw = readFileSync(wsChangePath, "utf8")
        const wsChange = JSON.parse(wsChangeRaw)
        parts.push("<change-baseline>")
        parts.push("## Change Baseline (.ws-change.json)")
        parts.push(`Base Branch: ${wsChange.base_branch || "unknown"}`)
        parts.push(`Template ID: ${wsChange.template_id || "unknown"}`)
        parts.push("</change-baseline>")
      }
    } catch {
      // .ws-change.json not available
    }

    // Continuation resume recommendation
    try {
      const changeState = ctx.getChangeState(activeChange.id)
      if (changeState && changeState.nextAction) {
        parts.push("<resume-recommendation>")
        parts.push("## Continuation / Resume Recommendation")
        parts.push(`Active Change: ${changeState.changeId}`)
        parts.push(`Phase: ${changeState.phase}`)
        if (changeState.lastDelegation) {
          parts.push(`Last Delegation: ${changeState.lastDelegation.role || "unknown"} (status: ${changeState.lastDelegation.status || "unknown"})`)
        }
        parts.push(`Recommended Next: ${changeState.nextAction}`)
        parts.push("</resume-recommendation>")
      }
    } catch {
      // Non-blocking: resume recommendation is advisory only
    }

    // P2 #1: Check for pending spec-update proposals
    const specUpdates = ctx.proposeSpecUpdates(activeChange.id)
    if (specUpdates) {
      parts.push(`<pending-spec-update>\n${specUpdates}\n</pending-spec-update>`)
    }
  }

  parts.push("<workflow-phases>")
  parts.push(
    "## aiws Workflow Phases\n" +
    "\n" +
    "The aiws workflow follows a linear pipeline with gates at each stage:\n" +
    "1. **ws-preflight** — Pre-flight: reads truth files, checks git state, outputs constraints\n" +
    "2. **ws-plan** — Create change context and execution plan with bindings\n" +
    "3. **aiws plan-verify** — Review plan before execution\n" +
    "4. **ws-dev** — Implementation against plan\n" +
    "5. **ws-review** — Audit changes against spec\n" +
    "6. **aiws commit** — Validate and commit\n" +
    "7. **ws-finish** — Finalize and archive change\n" +
    "8. **aiws deliver** — Push to remote\n" +
    "\n" +
    "Each phase has required inputs, outputs, and verification gates. " +
    "See `packages/spec/docs/workflow-stage-contracts.json` for stage details."
  )
  parts.push("</workflow-phases>")

  // -- Journal summary (today's delegation/breadcrumb activity)
  const journal = new AiwsSessionJournal(ctx.directory)
  const journalSummary = journal.getJournalSummary()
  if (journalSummary) {
    parts.push(`<journal-summary>\n${journalSummary}\n</journal-summary>`)
  }

  // -- Git status
  const gitStatus = ctx.getGitStatus()
  if (gitStatus) {
    parts.push(`<git-status>\n${gitStatus}\n</git-status>`)
  }

  // Guidelines
  parts.push("<guidelines>")
  parts.push(
    "Spec files are listed above under <spec-index> (digest: see <spec-digest>). " +
    "If the digest changed from the previous session, re-read any spec files that may have been updated.\n" +
    "When delegating sub-agents, include role markers (e.g. 'role: worker') so the inject-context plugin provides the correct JSONL context.\n" +
    "If an active change is shown above, work inside that change context."
  )
  parts.push("</guidelines>")

  const sessionKey = ctx.getSessionKey(platformInput)
  if (sessionKey) {
    journal.write("session_start", sessionKey, {
      change: activeChange?.id || null,
      phase: activeChange?.phase || null,
      digest,
    })
  }

  return parts.join("\n\n")
}

// ============================================================
// Context Collector (session dedup — singleton)
// ============================================================

export class AiwsContextCollector {
  constructor(maxSize = 200) {
    this.processed = new Set()
    this.maxSize = maxSize
  }

  markProcessed(sessionKey) {
    this.processed.add(sessionKey)
    this._trim()
  }

  isProcessed(sessionKey) {
    return this.processed.has(sessionKey)
  }

  clear(sessionKey) {
    this.processed.delete(sessionKey)
  }

  _trim() {
    if (this.processed.size <= this.maxSize) return
    // Set preserves insertion order; drop oldest entries
    const entries = [...this.processed]
    const overflow = entries.length - this.maxSize
    this.processed = new Set(entries.slice(overflow))
  }
}

/** Singleton instance */
export const contextCollector = new AiwsContextCollector()
