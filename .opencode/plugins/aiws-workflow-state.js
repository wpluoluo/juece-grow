/**
 * aiws Workflow State Injection Plugin
 *
 * Per-turn chat.message breadcrumb showing active change + current phase.
 * Unlike session-start, this fires on EVERY user message so long
 * conversations don't lose context of what's being worked on.
 *
 * Reference: trellis/packages/cli/src/templates/opencode/plugins/inject-workflow-state.js
 */

import { AiwsContext, AiwsSessionJournal, debugLog, promptHasSkipKeyword, resolveWorkflowSkipKeyword } from "../lib/aiws-context.js"

// Re-export for tests (TOOLING-003A / #427)
export { promptHasSkipKeyword, resolveWorkflowSkipKeyword }

/**
 * Build the workflow-state breadcrumb block.
 */
function buildBreadcrumb(change, phase) {
  const parts = []
  parts.push("<workflow-state>")

  if (change) {
    parts.push(`Active Change: ${change.id}`)
    parts.push(`Change Dir: changes/${change.id}/`)

    if (change.planFiles.length > 0) {
      parts.push(`Plans: ${change.planFiles.slice(0, 3).join(", ")}`)
    }
  } else {
    parts.push("Active Change: none")
  }

  if (phase) {
    parts.push(`Phase: ${phase} (${AiwsContext.PHASES.indexOf(phase) + 1}/${AiwsContext.PHASES.length})`)
  }

  // Phase-specific next actions — aligned with AiwsContext.PHASES state machine
  // Subagent-first policy: ready-for-dev defaults to aiws-worker; in-progress defaults to aiws-reviewer
  const nextActions = {
    intake: "Next: ws-plan to create a change and execution plan",
    planning: "Next: aiws plan-verify to review the plan, or ws-dev to begin implementation",
    "ready-for-dev": "Next: dispatch aiws-worker (subagent-first); main session coordinates, does not write code directly",
    "in-progress": "Next: dispatch aiws-reviewer + ws-review to audit changes",
    review: "Next: aiws commit to validate and commit",
    finished: "Next: ws-finish to finalize and archive the change",
  }
  if (phase && nextActions[phase]) {
    parts.push(nextActions[phase])
  }

  if (!change && !phase) {
    parts.push("No active work detected. Start with ws-preflight or ws-plan.")
  }

  // Available phases reference — aligned with AiwsContext.PHASES
  parts.push(`Phases: ${AiwsContext.PHASES.join(" → ")}`)

  parts.push("</workflow-state>")
  return parts.join("\n")
}

export default async ({ directory }) => {
  const ctx = new AiwsContext(directory)
  debugLog("workflow-state", "Plugin loaded, directory:", directory)

  return {
    "chat.message": async (input, output) => {
      try {
        // Skip sub-agent turns
        const agent = input?.agent || ""
        if (agent.startsWith("trellis-") || agent.startsWith("aiws-")) {
          debugLog("workflow-state", "Skipping subagent turn:", agent)
          return
        }

        if (process.env.AIWS_HOOKS === "0" || process.env.AIWS_DISABLE_HOOKS === "1") {
          return
        }

        if (process.env.OPENCODE_NON_INTERACTIVE === "1") {
          return
        }

        // Escape hatch (trellis #427): skip keyword in user prompt (default no-aiws)
        const partsProbe = output?.parts || []
        const originalText = partsProbe
          .filter(p => p && p.type === "text" && typeof p.text === "string")
          .map(p => p.text)
          .join("\n")
        const skipKeyword = resolveWorkflowSkipKeyword()
        if (promptHasSkipKeyword(originalText, skipKeyword)) {
          debugLog("workflow-state", "Skipping turn: skip keyword present in prompt", skipKeyword)
          return
        }

        if (!ctx.isAiwsProject()) {
          return
        }

        const change = ctx.getActiveChange()
        const phase = change ? change.phase : null
        const breadcrumb = buildBreadcrumb(change, phase)

        // Inject into the output text part (no dedup — show every turn)
        const parts = output?.parts || []
        const textIdx = parts.findIndex(p => p.type === "text" && p.text !== undefined)
        if (textIdx !== -1) {
          parts[textIdx].text = `${breadcrumb}\n\n${parts[textIdx].text}`
        } else {
          parts.unshift({ type: "text", text: breadcrumb })
        }

        debugLog("workflow-state", "Injected breadcrumb:", change?.id || "none", "phase:", phase || "none")

        // Record breadcrumb event to journal (non-blocking)
        try {
          const sessionKey = ctx.getSessionKey(input)
          if (sessionKey) {
            const journal = new AiwsSessionJournal(ctx.directory)
            journal.writeBreadcrumb(sessionKey, phase || "unknown", change?.id || null)
          }
        } catch {
          // Journal write failure should never break the plugin
        }
      } catch (error) {
        debugLog("workflow-state", "Error in chat.message:", error instanceof Error ? error.message : String(error))
      }
    },
  }
}
