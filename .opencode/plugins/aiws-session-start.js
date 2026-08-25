/**
 * aiws Session Start Plugin
 *
 * Injects aiws context (spec index, change status, handoff) when user
 * sends the first message in a new session.
 *
 * Hook: chat.message — modifies the output to prepend context.
 *
 * Reference: trellis/packages/cli/src/templates/opencode/plugins/session-start.js
 */

import { AiwsContext, buildSessionContext, contextCollector, debugLog } from "../lib/aiws-context.js"

export default async ({ directory, client }) => {
  const ctx = new AiwsContext(directory)
  debugLog("session", "Plugin loaded, directory:", directory)

  return {
    event: ({ event }) => {
      try {
        if (event?.type === "session.compacted" && event?.properties?.sessionID) {
          contextCollector.clear(event.properties.sessionID)
          debugLog("session", "Cleared processed flag after compaction for session:", event.properties.sessionID)
        }
      } catch (error) {
        debugLog("session", "Error in event hook:", error instanceof Error ? error.message : String(error))
      }
    },

    "chat.message": async (input, output) => {
      try {
        const sessionKey = ctx.getSessionKey(input)
        if (!sessionKey) {
          debugLog("session", "No session key available, skipping")
          return
        }

        const agent = input.agent || ""
        if (agent && (agent.startsWith("trellis-") || agent.startsWith("aiws-"))) {
          debugLog("session", "Skipping sub-agent turn:", agent)
          return
        }

        if (process.env.AIWS_HOOKS === "0" || process.env.AIWS_DISABLE_HOOKS === "1") {
          debugLog("session", "Skipping — AIWS_HOOKS disabled")
          return
        }

        if (process.env.OPENCODE_NON_INTERACTIVE === "1") {
          debugLog("session", "Skipping — non-interactive mode")
          return
        }

        if (contextCollector.isProcessed(sessionKey)) {
          debugLog("session", "Skipping — session already processed:", sessionKey)
          return
        }

        const context = buildSessionContext(ctx, input)
        debugLog("session", "Built context, length:", context.length)

        if (!context) {
          debugLog("session", "Empty context, nothing to inject")
          return
        }

        const parts = output?.parts || []
        const textPartIndex = parts.findIndex(p => p.type === "text" && p.text !== undefined)

        if (textPartIndex !== -1) {
          const originalText = parts[textPartIndex].text || ""
          parts[textPartIndex].text = `${context}\n\n---\n\n${originalText}`
          debugLog("session", "Injected context into chat.message text part, length:", context.length)
        } else {
          const injectedPart = { type: "text", text: context }
          parts.unshift(injectedPart)
          debugLog("session", "Prepended new text part with context, length:", context.length)
        }

        contextCollector.markProcessed(sessionKey)
      } catch (error) {
        debugLog("session", "Error in chat.message:", error.message, error.stack)
      }
    },
  }
}
