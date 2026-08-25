/**
 * Memory Autoload Plugin
 *
 * Injects AIWS memory context at session start so each session
 * has continuity without needing the nocturne_memory MCP server.
 *
 * What it does:
 *   1. On the first user message of a new session, reads:
 *      - Active goal(s) from .aiws/goals/*.state.json
 *      - Recent decisions from .aiws/memory-bank/decision/ (last 3)
 *      - Project overview from .aiws/memory-bank/project/
 *   2. Injects a <memory-context> block into the assistant's first response.
 *   3. Deduplicates per session — injects once only.
 *
 * Disable: export MEMORY_AUTOLOAD_DISABLE=1
 *
 * @module memory-autoload
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MEMORY_BANK = ".aiws/memory-bank";
const GOALS_DIR = ".aiws/goals";

export const MemoryAutoloadPlugin = async ({ project, client, directory }) => {
  const processed = new Set();

  return {
    "chat.message": async (input, output) => {
      const sid = input?.sessionID;
      if (!sid || processed.has(sid)) return;
      if (process.env.MEMORY_AUTOLOAD_DISABLE === "1") {
        processed.add(sid);
        return;
      }

      const root = directory || process.cwd();
      const bankDir = join(root, MEMORY_BANK);
      if (!existsSync(bankDir)) {
        processed.add(sid);
        return;
      }

      const blocks = [];

      // ── 1. Active/paused goals (ADVISORY ONLY — not FSM authority) ─
      // TOOLING-003D: authoritative goal-context + next_action come from
      // session-start → buildSessionContext → getActiveGoal(s).
      // memory-autoload must NOT become authority over goal state.
      try {
        const goalsDir = join(root, GOALS_DIR);
        if (existsSync(goalsDir)) {
          const files = readdirSync(goalsDir).filter((f) =>
            f.endsWith(".state.json"),
          );
          const advisory = [];
          for (const file of files.sort()) {
            try {
              const state = JSON.parse(
                readFileSync(join(goalsDir, file), "utf-8"),
              );
              const st = state.status;
              if (st === "active" || st === "paused") {
                const phase = state.current_phase ?? "?";
                const iter = state.iteration ?? "?";
                advisory.push(
                  `- [${st}] ${state.goal_id || file} — phase=${phase}, iteration=${iter}`,
                );
              }
            } catch {
              /* skip malformed state file */
            }
          }
          if (advisory.length) {
            blocks.push(
              "[Goals — advisory memory only; use session <goal-context> for next_action]",
            );
            blocks.push(...advisory);
          }
        }
      } catch {
        /* goals dir missing */
      }

      // ── 2. Recent decisions (last 3, sorted by filename) ──────────
      try {
        const decDir = join(bankDir, "decision");
        if (existsSync(decDir)) {
          const files = readdirSync(decDir)
            .filter((f) => f.endsWith(".md") && f !== "handoff-evidence.md")
            .sort()
            .reverse()
            .slice(0, 3);
          for (const file of files) {
            try {
              const content = readFileSync(join(decDir, file), "utf-8");
              const title =
                content
                  .split("\n")
                  .find((l) => l.startsWith("#"))
                  ?.replace(/^#+\s*/, "") || file.replace(".md", "");
              const summary = content
                .split("\n")
                .slice(1, 8)
                .filter((l) => l.trim())
                .join("\n")
                .trim();
              blocks.push(`\n[Decision] ${title}\n${summary}`);
            } catch {
              /* skip unreadable file */
            }
          }
        }
      } catch {
        /* decision dir missing */
      }

      // ── 3. Project overview ────────────────────────────────────────
      try {
        const projDir = join(bankDir, "project");
        if (existsSync(projDir)) {
          const files = readdirSync(projDir).filter((f) => f.endsWith(".md"));
          for (const file of files.slice(0, 2)) {
            try {
              const content = readFileSync(join(projDir, file), "utf-8");
              const title =
                content
                  .split("\n")
                  .find((l) => l.startsWith("#"))
                  ?.replace(/^#+\s*/, "") || file.replace(".md", "");
              const excerpt = content
                .split("\n")
                .slice(1, 12)
                .filter((l) => l.trim())
                .join("\n")
                .trim();
              blocks.push(`\n[Project: ${title}]\n${excerpt}`);
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        /* project dir missing */
      }

      // ── 4. If aiws memory boot produces anything, append it ────────
      // (skipped — avoids shell dependency; use --disclosure boot on
      //  `aiws memory write` and the injected goal/decision blocks
      //  above already provide sufficient context)

      if (blocks.length === 0) {
        processed.add(sid);
        return;
      }

      const context = `<memory-context>\n${blocks.join("\n")}\n</memory-context>`;

      const parts = output?.parts || [];
      const textIdx = parts.findIndex(
        (p) => p.type === "text" && p.text !== undefined,
      );
      if (textIdx !== -1) {
        parts[textIdx].text = `${context}\n\n${parts[textIdx].text}`;
      } else {
        parts.unshift({ type: "text", text: context });
      }

      try {
        await client.app.log({
          body: {
            service: "memory-autoload",
            level: "info",
            message: `Injected ${blocks.length} memory blocks for session ${sid.slice(0, 12)}`,
          },
        });
      } catch {
        /* logging optional */
      }

      processed.add(sid);
    },
  };
};
