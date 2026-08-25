/**
 * aiws Context Injection Plugin
 *
 * Injects aiws context JSONL when task() is called with sub-agent types.
 * Hook: tool.execute.before — intercepts task() calls, reads <role>-context.jsonl
 * from changes/<id>/analysis/, and injects into the agent prompt.
 *
 * Reference: trellis/packages/cli/src/templates/opencode/plugins/inject-subagent-context.js
 */

import { existsSync } from "fs"
import { join } from "path"
import { AiwsContext, AiwsSessionJournal, debugLog } from "../lib/aiws-context.js"

// Role detection — check args.subagent_type first, then fall back to prompt marker
// Prompt should include: "role: <role>" as a line in the prompt
const ROLE_MARKER_RE = /^\s*role\s*[:=]\s*(\w+)\s*$/im

function detectRole(args, originalPrompt) {
  // Priority 1: args.subagent_type (set by task() caller)
  if (args?.subagent_type) {
    const t = String(args.subagent_type).toLowerCase().replace(/^(?:trellis|aiws)-/, "")
    if (["worker", "explorer", "reviewer", "planner"].includes(t)) return t
  }
  // Priority 2: "role:" marker in prompt body
  const roleMatch = originalPrompt?.match(ROLE_MARKER_RE)
  if (roleMatch) return roleMatch[1].toLowerCase()
  // Priority 3: "subagent_type" or "agent_type" in prompt body
  const typeMatch = originalPrompt?.match(/\b(?:subagent_type|agent_type)\s*[:=]\s*(\w+)\s*/im)
  if (typeMatch) return typeMatch[1].toLowerCase().replace(/^trellis-/, "")
  return null
}

const FIRST_REPLY_INSTRUCTION = `<aiws-context-instruction>
After reading the JSONL context files, confirm by listing the files you read and their key points (≤3 per file).

**Context file path:** changes/<change-id>/analysis/<role>-context.jsonl

**Execution order:**
1. Read the JSONL file with the Read tool
2. Follow priority order: high → medium → low
3. If sections defined, only read those line ranges for files > 200 lines
4. If any file is inaccessible, flag it but continue with what's available

**Your first response** must begin with:
\`\`\`
Read context files: [list of files read]
Key points: [brief summary per file]
Status: READY | NEEDS_CONTEXT
\`\`\`
</aiws-context-instruction>`

/**
 * Resolve the active change ID by scanning changes/ directory.
 */
function resolveActiveChangeId(ctx) {
  const active = ctx.getActiveChange()
  return active ? active.id : null
}

/**
 * Find JSONL context file for a given role in the active change.
 */
function resolveRoleJsonl(ctx, changeId, role) {
  if (!changeId || !role) return null
  const jsonlPath = join(ctx.directory, "changes", changeId, "analysis", `${role}-context.jsonl`)
  return existsSync(jsonlPath) ? jsonlPath : null
}

/**
 * Build fallback context when no curated JSONL exists (G7).
 * Injects at minimum: change ID, phase, spec index.
 */
function buildFallbackContext(ctx, changeId, role) {
  const parts = []
  parts.push(`<aiws-context-fallback>
No curated context JSONL for role "${role}" in change "${changeId}".
Using project context as minimal scaffold.
</aiws-context-fallback>`)

  const changeDetail = ctx.getChangeDetail(changeId)
  if (changeDetail) {
    const lines = [
      `Change: ${changeDetail.id}`,
      `Phase: ${changeDetail.phase}`,
    ]
    if (changeDetail.planFiles.length > 0) {
      lines.push(`Plans: ${changeDetail.planFiles.join(", ")}`)
    }
    parts.push(`<change-context>\n${lines.join("\n")}\n</change-context>`)
  }

  const specIndex = ctx.getSpecIndex()
  if (specIndex) {
    parts.push(`<spec-index>\n${specIndex.trimEnd()}\n</spec-index>`)
  }

  parts.push(`<aiws-context-instruction>
No JSONL context file was found for your role.
Review the change context and spec index above for relevant constraints.
Focus on the spec documents that apply to your task.
If you need more context, use the Glob and Grep tools to discover the codebase.
</aiws-context-instruction>`)

  return parts.join("\n\n")
}

/**
 * Write journal entry for a fallback context injection.
 * Extracted to avoid repeating the sessionKey/journal creation in both fallback paths.
 */
function _writeFallbackJournal(ctx, input, role, changeId, reason) {
  const sessionKey = ctx.getSessionKey({ sessionID: input?.session_id || "" })
  if (sessionKey) {
    try {
      const journal = new AiwsSessionJournal(ctx.directory)
      journal.writeDelegation(sessionKey, role, changeId, {
        contextFiles: 0,
        hasFallback: true,
        reason,
      })
    } catch {
      // journal write failure should never break plugin flow
    }
  }
}

export default async ({ directory }) => {
  const ctx = new AiwsContext(directory)
  debugLog("inject", "Plugin loaded, directory:", directory)

  return {
    "tool.execute.before": async (input, output) => {
      try {
        if (process.env.AIWS_HOOKS === "0" || process.env.AIWS_DISABLE_HOOKS === "1") {
          return
        }

        const toolName = input?.tool?.toLowerCase()
        if (toolName !== "task") return

        const args = output?.args
        if (!args) return

        const originalPrompt = args.prompt || ""
        if (!originalPrompt) return

        // Extract role using detectRole (checks subagent_type first, then prompt markers)
        const role = detectRole(args, originalPrompt) || "worker"
        debugLog("inject", "Task tool called, role:", role)

        // Resolve active change
        const changeId = resolveActiveChangeId(ctx)
        if (!changeId) {
          debugLog("inject", "No active change found, skipping")
          return
        }

        // Find context JSONL for this role
        const jsonlPath = resolveRoleJsonl(ctx, changeId, role)
        if (!jsonlPath) {
          debugLog("inject", `No context JSONL for role "${role}" in change "${changeId}", injecting fallback`)
          _writeFallbackJournal(ctx, input, role, changeId, "no_jsonl_file")
          const fallbackCtx = buildFallbackContext(ctx, changeId, role)
          args.prompt = `${fallbackCtx}\n\n---\n\n${originalPrompt}`
          return
        }

        // Read JSONL and build context
        const entries = ctx.readJsonlWithFiles(jsonlPath)
        if (entries.length === 0) {
          debugLog("inject", `Empty context JSONL for role "${role}" in change "${changeId}", injecting fallback`)
          _writeFallbackJournal(ctx, input, role, changeId, "empty_jsonl")
          const fallbackCtx = buildFallbackContext(ctx, changeId, role)
          args.prompt = `${fallbackCtx}\n\n---\n\n${originalPrompt}`
          return
        }

        const counts = { inline: 0, truncated: 0, index: 0 }
        for (const e of entries) {
          const m = e.mode || "inline"
          if (m in counts) counts[m] += 1
          else counts.inline += 1
        }
        const metaHeader =
          `<aiws-context-meta>\n` +
          `role: ${role}\n` +
          `change: ${changeId}\n` +
          `files: ${entries.length} (inline=${counts.inline}, truncated=${counts.truncated}, index=${counts.index})\n` +
          `</aiws-context-meta>`
        const contextBlock = `${metaHeader}\n\n${ctx.buildContextBlock(entries)}`
        debugLog("inject", `Injected context for role "${role}", entries: ${entries.length}`, counts)

        // Record delegation event to journal
        const sessionKey = ctx.getSessionKey({ sessionID: input?.session_id || "" })
        if (sessionKey) {
          const journal = new AiwsSessionJournal(ctx.directory)
          journal.writeDelegation(sessionKey, role, changeId, {
            contextFiles: entries.length,
            originalPromptSnippet: originalPrompt.slice(0, 120),
            hasFallback: false,
          })
        }

        // Prepend context + instruction to the prompt
        args.prompt = `${contextBlock}\n\n${FIRST_REPLY_INSTRUCTION}\n\n---\n\n${originalPrompt}`

      } catch (error) {
        debugLog("inject", "Error in tool.execute.before:", error.message, error.stack)
      }
    },
  }
}
