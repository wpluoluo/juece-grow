/// <reference types="node" />

/**
 * Pi agent extension for aiws workflow integration.
 *
 * Capabilities:
 * 1. **session_start** — goal-context + **pi force policy** system prompt block
 * 2. **`aiws` tool** — CLI subprocess
 * 3. **`aiws_subagent` (DEPRECATED)** — returns deprecation guidance; prefer the `Agent` tool (pi-subagents extension, npm:@tintinweb/pi-subagents)
 * 4. **Best-effort hooks** — if host emits tool/agent events, apply hatch/deny/whitelist
 *
 * Force policy SSOT: `packages/aiws/src/lib/pi-force-policy.ts`
 * Spec: `packages/spec/docs/pi-subagent-first.md`
 *
 * @module aiws-extension
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Force policy (load from packages/aiws; fallback inlined minimal)
// ---------------------------------------------------------------------------

type PolicyDecision =
  | { allow: true; reason: string }
  | { allow: false; reason: string; code: string };

interface ForcePolicyApi {
  detectHatch(msg: string | null | undefined): boolean;
  decideMainWrite(opts: {
    toolName: string;
    filePath?: string | null;
    hatchActive: boolean;
  }): PolicyDecision;
  decideAgentType(subagentType: string | null | undefined): PolicyDecision;
  buildForcePolicyPromptBlock(): string;
  aiwsSubagentDeprecationMessage(prompt: string): string;
  formatDelegateFailureEvidence(opts: {
    changeId?: string;
    error: string;
    attemptedType?: string;
    at?: string;
  }): string;
}

function loadForcePolicy(): ForcePolicyApi {
  const here =
    typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../packages/aiws/dist/lib/pi-force-policy.js'),
    join(process.cwd(), 'packages/aiws/dist/lib/pi-force-policy.js'),
    join(here, '../../packages/aiws/src/lib/pi-force-policy.ts'),
  ];
  for (const p of candidates) {
    if (!existsSync(p) && !p.endsWith('.ts')) continue;
    try {
      const req = createRequire(join(here, 'aiws.ts'));
      if (p.endsWith('.js')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return req(p) as ForcePolicyApi;
      }
    } catch {
      // try next
    }
  }
  // Fallback: dynamic import path via require from cwd dist only
  try {
    const req = createRequire(join(process.cwd(), 'package.json'));
    return req('./packages/aiws/dist/lib/pi-force-policy.js') as ForcePolicyApi;
  } catch {
    return fallbackForcePolicy();
  }
}

/** Minimal fallback if dist not built — keep behavior aligned with pi-force-policy.ts */
function fallbackForcePolicy(): ForcePolicyApi {
  const HATCH = [
    '直接改',
    'do it inline',
    '你直接改',
    '别派 sub-agent',
    'main session 写就行',
    '不用 sub-agent',
    'no sub-agent',
  ];
  const ALLOWED = ['aiws-worker', 'aiws-reviewer'];
  return {
    detectHatch(msg) {
      if (!msg) return false;
      return HATCH.some((p) => msg.includes(p));
    },
    decideMainWrite({ toolName, filePath, hatchActive }) {
      if (!/^(write|edit)$/i.test(toolName)) return { allow: true, reason: 'non-write' };
      if (hatchActive) return { allow: true, reason: 'hatch' };
      const p = (filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
      const ok =
        p.includes('/evidence/') ||
        p.includes('/analysis/') ||
        p.includes('/review/') ||
        p.startsWith('.aiws/plan/') ||
        p.startsWith('.aiws/goals/');
      if (ok) return { allow: true, reason: 'allowlist' };
      return {
        allow: false,
        reason: 'MAIN_WRITE_DENIED',
        code: 'MAIN_WRITE_DENIED',
      };
    },
    decideAgentType(t) {
      const x = (t || '').trim().toLowerCase();
      if (ALLOWED.includes(x)) return { allow: true, reason: x };
      return {
        allow: false,
        reason: 'AGENT_TYPE_DENIED',
        code: 'AGENT_TYPE_DENIED',
      };
    },
    buildForcePolicyPromptBlock() {
      return [
        '<aiws-pi-force-policy>',
        'Subagent-first: 默认派发 = `aiws change tasks execute --strategy tmux`（TmuxSessionSpawner 独立会话）。扩展 Agent 工具（aiws-subagents.ts）为 deprecated 兼容层（默认停用，AIWS_EXT_AGENT_ENABLED=1 临时启用）。No silent main write.',
        'Hatch: ' + HATCH.join(' | '),
        'Spec: packages/spec/docs/pi-subagent-first.md',
        'aiws_subagent is DEPRECATED — use tmux dispatch (`aiws change tasks execute --strategy tmux`).',
        '</aiws-pi-force-policy>',
      ].join('\n');
    },
    aiwsSubagentDeprecationMessage(prompt) {
      return [
        '[aiws] aiws_subagent is DEPRECATED. Use Agent tool (pi-subagents):',
        '  Agent({ subagent_type: "aiws-worker" | "aiws-reviewer", prompt: "..." })',
        prompt ? `Prompt was not executed:\n${prompt.slice(0, 1500)}` : '',
      ].join('\n');
    },
    formatDelegateFailureEvidence({ changeId, error, attemptedType, at }) {
      return [
        '# Delegate failure (no silent main-session fallback)',
        '',
        `- **at**: ${at || new Date().toISOString()}`,
        changeId ? `- **change**: ${changeId}` : null,
        attemptedType ? `- **attempted_type**: ${attemptedType}` : null,
        `- **error**: ${error}`,
        '',
      ]
        .filter(Boolean)
        .join('\n');
    },
  };
}

const policy = loadForcePolicy();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PiContext {
  on(event: string, callback: (...args: unknown[]) => void | Promise<void>): void;
  registerTool(
    name: string,
    handler: (args: string[], context?: Record<string, unknown>) => string | Promise<string>,
  ): void;
  /**
   * Local declaration (no pi kernel import): aligns with pi docs/extensions.md
   * §registerCommand / RegisteredCommand. Registers a real TUI slash command.
   */
  registerCommand(
    name: string,
    options: {
      description: string;
      getArgumentCompletions?: (prefix: string) => Array<{ value: string; label: string }> | null;
      handler: (args: string, ctx: unknown) => Promise<void> | void;
    },
  ): void;
  newSession?(config: {
    prompt: string;
    model?: string;
    skills?: string[];
  }): Promise<{ output: string; sessionId?: string }>;
  projectRoot?: string;
  addSystemPrompt?(text: string): void;
  addContext?(text: string): void;
  /**
   * pi ExtensionAPI.sendUserMessage — sends a real user message that always
   * triggers an LLM turn. This is the correct way to inject skill content
   * from a slash-command handler (the handler's own ExtensionCommandContext
   * does NOT expose sendUserMessage in pi 0.84.1).
   */
  sendUserMessage?: (
    content: string | Array<{ type: string; text?: string; [k: string]: unknown }>,
    options?: { deliverAs?: "steer" | "followUp" },
  ) => Promise<void>;
}

interface GoalState {
  goal_id?: string;
  status?: string;
  current_phase?: string;
  current_group?: string | null;
  checkpoints?: Record<string, CheckpointState>;
  groups?: Record<string, GroupState>;
  created_at?: string;
  updated_at?: string;
}

interface CheckpointState {
  status: string;
  completed_at: string | null;
  error?: string | null;
}

interface GroupState {
  id?: string;
  title?: string;
  scope?: string;
  status: string;
  phase?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOALS_DIR_REL = join('.aiws', 'goals');

/** Slash command → skill prompt file mapping */
const CMD_SKILL_MAP: Record<string, { file: string; desc: string }> = {
  "ws-plan":     { file: "ws-plan.prompt.md",     desc: "创建 change 和执行计划" },
  "ws-dev":      { file: "ws-dev.prompt.md",      desc: "按计划实现代码" },
  "ws-review":   { file: "ws-review.prompt.md",   desc: "审查变更" },
  "ws-finish":   { file: "ws-finish.prompt.md",   desc: "合并交付 change" },
  "ws-goal":     { file: "ws-goal.prompt.md",     desc: "目标管理工作流" },
  "grill-me":    { file: "grill-me.prompt.md",    desc: "思路推敲" },
  "subagent":    { file: "subagent.prompt.md",    desc: "子代理派发规则" },
};

/** 真斜杠指令条目（经 ctx.registerCommand 注册，TUI 可直接输入 /<name> 触发） */
interface WSCommandMeta {
  name: string;
  desc: string;
}

/**
 * 真 pi 斜杠指令表 — desc 复用 CMD_SKILL_MAP 同名项（ws-plan/ws-dev/ws-review/
 * ws-finish/ws-goal），其余用简短中文说明。
 */
const WS_COMMAND_MAP: WSCommandMeta[] = [
  { name: 'ws-intake', desc: '需求澄清与问题冻结' },
  { name: 'ws-plan', desc: '创建 change 和执行计划' },
  { name: 'ws-dev', desc: '按计划实现代码' },
  { name: 'ws-review', desc: '审查变更' },
  { name: 'ws-finish', desc: '合并交付 change' },
  { name: 'ws-goal', desc: '目标管理工作流' },
  { name: 'ws-bugfix', desc: '修复禅道 bug' },
  { name: 'ws-bugfix-batch', desc: '批量修复禅道激活 bug' },
  { name: 'ws-handoff', desc: '交接工作给后续 session' },
  { name: 'ws-preflight', desc: '新会话预检与环境检查' },
  { name: 'ws-delegate', desc: '委派任务给 subagent' },
  { name: 'ws-analyze', desc: '需求/变更分析' },
  { name: 'ws-spec-review', desc: '规格评审' },
  { name: 'ws-quality-review', desc: '质量评审' },
  { name: 'ws-rule', desc: '查询项目规则与边界' },
  { name: 'using-aiws', desc: 'aiws 工作流使用指南' },
];

const SKILLS_DIR = join('.pi', 'skills');

const PHASE_ORDER = [
  'intake',
  'goal_def',
  'dep_check',
  'ws_analysis',
  'plan',
  'dev',
  'review',
  'finish',
] as const;

/** Session-local hatch flag (set on session_start / user message events when available). */
let sessionHatchActive = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveProjectRoot(ctx: PiContext): string {
  return ctx.projectRoot || process.cwd();
}

function resolveAiwsCli(projectRoot: string): string {
  const localCli = join(projectRoot, 'packages', 'aiws', 'bin', 'aiws.js');
  if (existsSync(localCli)) {
    return `node ${localCli}`;
  }
  return 'npx -y @aipper/aiws';
}

/**
 * Resolve skill prompt content for a command name.
 * Prefers flat `.pi/skills/<name>.prompt.md`, falls back to `.pi/skills/<name>/SKILL.md`,
 * then `.agents/skills/<name>/SKILL.md` (Pi >=0.84 auto-discovers the canonical
 * `.agents/skills/` home). Returns null when the skill file is missing.
 */
function resolveSkillContent(projectRoot: string, name: string): string | null {
  const flat = join(projectRoot, SKILLS_DIR, `${name}.prompt.md`);
  if (existsSync(flat)) return readFileSync(flat, 'utf-8');
  const dir = join(projectRoot, SKILLS_DIR, name, 'SKILL.md');
  if (existsSync(dir)) return readFileSync(dir, 'utf-8');
  const agentsDir = join(projectRoot, '.agents', 'skills', name, 'SKILL.md');
  if (existsSync(agentsDir)) return readFileSync(agentsDir, 'utf-8');
  return null;
}

function scanActiveGoals(
  projectRoot: string,
): Array<{ state: GoalState; statePath: string; mdPath: string }> {
  const goalsDir = join(projectRoot, GOALS_DIR_REL);
  if (!existsSync(goalsDir)) return [];

  const entries = readdirSync(goalsDir);
  const results: Array<{ state: GoalState; statePath: string; mdPath: string }> = [];

  for (const entry of entries) {
    if (extname(entry) !== '.json' || !entry.endsWith('.state.json')) continue;

    const statePath = join(goalsDir, entry);
    let state: GoalState;

    try {
      const raw = readFileSync(statePath, 'utf-8');
      state = JSON.parse(raw) as GoalState;
    } catch {
      continue;
    }

    const status = state.status ?? '';
    if (status !== 'active' && status !== 'paused') continue;

    const goalId = state.goal_id || basename(entry, '.state.json');
    const mdPath = join(goalsDir, `${goalId}.md`);
    results.push({ state, statePath, mdPath });
  }

  return results;
}

function readGoalTitle(mdPath: string): string {
  try {
    const content = readFileSync(mdPath, 'utf-8');
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : basename(mdPath, '.md');
  } catch {
    return basename(mdPath, '.md');
  }
}

function formatCheckpoints(checkpoints: Record<string, CheckpointState> | undefined): string {
  if (!checkpoints) return '';

  return PHASE_ORDER.filter((p) => checkpoints[p] !== undefined)
    .map((p) => `${p}=${checkpoints[p].status}`)
    .join(', ');
}

function buildGoalContext(
  activeGoals: Array<{ state: GoalState; mdPath: string }>,
  aiwsCliCmd: string,
): string {
  if (activeGoals.length === 0) return '';

  const lines: string[] = [
    '<goal-context>',
    'Active aiws goals detected in this workspace:',
    '',
  ];

  for (const goal of activeGoals) {
    const title = readGoalTitle(goal.mdPath);
    const goalId = goal.state.goal_id || 'unknown';
    const phase = goal.state.current_phase || 'unknown';
    const status = goal.state.status || 'unknown';
    const checkpoints = formatCheckpoints(goal.state.checkpoints);
    const groups = goal.state.groups ? Object.values(goal.state.groups) : [];

    lines.push(`  【${goalId}】${title}`);
    lines.push(`    Status: ${status} | Current Phase: ${phase}`);
    if (checkpoints) {
      lines.push(`    Checkpoints: ${checkpoints}`);
    }

    const pendingGroups = groups.filter((g) => g.status === 'pending');
    for (const g of pendingGroups) {
      const scope = g.scope ? ` (${g.scope})` : '';
      lines.push(`    · Pending group: ${g.title || g.id}${scope}`);
    }

    lines.push(
      `    → Run \`${aiwsCliCmd} goal advance ${goalId} --json --dry-run\` to see recommended next step`,
    );
    lines.push('');
  }

  lines.push('Tips:');
  lines.push('  · Use the `aiws` tool to run any aiws CLI command.');
  lines.push(
    '  · Prefer `Agent({ subagent_type: "aiws-worker"|"aiws-reviewer", ... })` (pi-subagents) for work.',
  );
  lines.push('  · `aiws_subagent` is DEPRECATED — do not use as primary.');
  lines.push('</goal-context>');

  return lines.join('\n');
}

function injectPrompt(ctx: PiContext, text: string): void {
  if (!text) return;
  if (typeof ctx.addSystemPrompt === 'function') {
    ctx.addSystemPrompt(text);
  } else if (typeof ctx.addContext === 'function') {
    ctx.addContext(text);
  }
}

/**
 * Shared handler for the real pi slash commands (`/ws-*`).
 *
 * pi 0.84.1's `registerCommand` is a handler-callback model: the handler
 * returns when it finishes and does NOT automatically start an LLM turn
 * (unlike opencode's template-expansion model). The handler's second arg is
 * an `ExtensionCommandContext` which does NOT expose `sendUserMessage` in pi
 * 0.84.1 — that lives on the `ExtensionAPI` (the `ctx` passed to setup). We
 * therefore capture `ctx.sendUserMessage` at setup time and call it here to
 * push the resolved skill body as a real user message that always triggers a
 * turn.
 */
async function handleWsSlashCommand(
  ctx: PiContext,
  cmd: WSCommandMeta,
  args: string,
): Promise<void> {
  const content = resolveSkillContent(resolveProjectRoot(ctx), cmd.name);
  if (!content) {
    // No skill found: nothing to send; surface to console (a UI client may not
    // exist in print/headless mode) so it is not silent.
    console.warn(`[aiws] Skill file not found for /${cmd.name}；请先运行 \`aiws init\` 或检查 .agents/skills/${cmd.name}`);
    return;
  }
  const header = `# Executing /${cmd.name}: ${cmd.desc}` + (args ? `\nUser context: ${args}` : '');
  const body = `${header}\n${content}`;
  if (ctx && typeof ctx.sendUserMessage === 'function') {
    try {
      await ctx.sendUserMessage(body, { deliverAs: 'steer' });
    } catch (e) {
      console.warn(`[aiws] sendUserMessage failed for /${cmd.name}:`, e);
    }
  } else {
    // No ExtensionAPI.sendUserMessage available (e.g. very old pi / unit tests):
    // the skill body cannot be delivered to the model from a command handler.
    console.warn(`[aiws] sendUserMessage unavailable; /${cmd.name} cannot trigger an LLM turn`);
  }
}

function extractPathFromToolArgs(args: unknown): string | null {
  if (!args) return null;
  if (typeof args === 'string') {
    // "write path content" or JSON
    try {
      const j = JSON.parse(args) as Record<string, unknown>;
      const p = j.path || j.filePath || j.file || j.filepath;
      if (typeof p === 'string') return p;
    } catch {
      const parts = args.trim().split(/\s+/);
      if (parts.length >= 2 && /write|edit/i.test(parts[0])) return parts[1];
      if (parts[0]?.includes('/') || parts[0]?.includes('.')) return parts[0];
    }
    return null;
  }
  if (typeof args === 'object') {
    const o = args as Record<string, unknown>;
    const p = o.path || o.filePath || o.file || o.filepath;
    if (typeof p === 'string') return p;
  }
  return null;
}

function extractSubagentType(args: unknown): string | null {
  if (!args) return null;
  if (typeof args === 'string') {
    try {
      const j = JSON.parse(args) as Record<string, unknown>;
      const t = j.subagent_type || j.subagentType || j.type;
      if (typeof t === 'string') return t;
    } catch {
      const m = args.match(/subagent_type["\s:=]+([a-zA-Z0-9_-]+)/i);
      if (m) return m[1];
    }
    return null;
  }
  if (typeof args === 'object') {
    const o = args as Record<string, unknown>;
    const t = o.subagent_type || o.subagentType || o.type;
    if (typeof t === 'string') return t;
  }
  return null;
}

function writeDelegateFailure(
  projectRoot: string,
  error: string,
  attemptedType?: string,
): string | null {
  const changeDir = join(projectRoot, '.aiws', 'changes');
  if (!existsSync(changeDir)) return null;
  // Prefer active change dirs; fallback first child
  let targetChange: string | null = null;
  try {
    const entries = readdirSync(changeDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name === 'pi-force-subagent') {
        targetChange = e.name;
        break;
      }
    }
    if (!targetChange) {
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      targetChange = dirs[0] || null;
    }
  } catch {
    return null;
  }
  if (!targetChange) return null;
  const evidenceDir = join(changeDir, targetChange, 'evidence');
  try {
    mkdirSync(evidenceDir, { recursive: true });
    const body = policy.formatDelegateFailureEvidence({
      changeId: targetChange,
      error,
      attemptedType,
    });
    const path = join(evidenceDir, 'delegate-failure.md');
    writeFileSync(path, body, 'utf-8');
    return path;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Extension Setup
// ---------------------------------------------------------------------------

export default function setup(ctx: PiContext): void {
  const projectRoot = resolveProjectRoot(ctx);

  // ── 1. Session Start ──────────────────────────────────────────────────
  ctx.on('session_start', () => {
    try {
      sessionHatchActive = false;

      injectPrompt(ctx, policy.buildForcePolicyPromptBlock());

      // Inject available workflow commands (说明文字；触发本体走 registerCommand，cmd 工具兜底)
      const cmdHelp = [
        ...WS_COMMAND_MAP.map((c) => `  /${c.name} — ${c.desc}`),
        ...Object.entries(CMD_SKILL_MAP)
          .filter(([name]) => !WS_COMMAND_MAP.some((c) => c.name === name))
          .map(([name, meta]) => `  /${name} — ${meta.desc}`),
      ].join('\n');
      injectPrompt(ctx, [
        '<aiws-commands>',
        '可用命令（在消息中说 /cmd-name 即可触发；TUI 内直接输入 /cmd-name 为真斜杠指令）：',
        cmdHelp,
        '例如："/ws-plan 加一个登录功能" 或 "帮我执行 ws-review"。',
        '</aiws-commands>',
      ].join('\n'));

      const activeGoals = scanActiveGoals(projectRoot);
      if (activeGoals.length > 0) {
        const aiwsCliCmd = resolveAiwsCli(projectRoot);
        injectPrompt(ctx, buildGoalContext(activeGoals, aiwsCliCmd));

        // Auto-advance through phases that don't need user input
        const autoPhases = new Set(['dep_check', 'ws_analysis', 'plan', 'finish']);
        for (const goal of activeGoals) {
          const phase = (goal.state.current_phase || '').trim().toLowerCase();
          if (autoPhases.has(phase)) {
            try {
              const result = execSync(`${aiwsCliCmd} goal advance --json`, {
                cwd: projectRoot, encoding: 'utf-8', timeout: 30_000,
              });
              const parsed = JSON.parse(result);
              const nextPhase = parsed.current_phase || 'unknown';
              injectPrompt(ctx, [
                `<aiws-auto-advance goal="${goal.state.goal_id || ''}">`,
                `Auto-advanced from ${phase} to ${nextPhase}.`,
                parsed.message ? `Message: ${parsed.message}` : '',
                '</aiws-auto-advance>',
              ].join('\n'));
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              injectPrompt(ctx, `<aiws-auto-advance goal="${goal.state.goal_id || ''}">Auto-advance blocked: ${errMsg}</aiws-auto-advance>`);
            }
          }
        }
      }

      try {
        const aiwsCliCmd = resolveAiwsCli(projectRoot);
        const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectRoot, encoding: 'utf-8', timeout: 10_000,
        }).trim();
        const gitDirty = execSync('git status --porcelain', {
          cwd: projectRoot, encoding: 'utf-8', timeout: 10_000,
        }).trim();
        const hasUncommitted = gitDirty.length > 0;

        injectPrompt(ctx, [
          '<aiws-session-state>',
          `branch: ${gitBranch}`,
          hasUncommitted ? `uncommitted_changes: ${gitDirty.split('\n').length} file(s)` : 'uncommitted_changes: none',
          '</aiws-session-state>',
        ].join('\n'));

        const changesDir = join(projectRoot, '.aiws', 'changes');
        const changeIds: string[] = [];
        if (existsSync(changesDir)) {
          const entries = readdirSync(changesDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory() && !e.name.startsWith('archive')) {
              const proposalPath = join(changesDir, e.name, 'proposal.md');
              if (existsSync(proposalPath)) changeIds.push(e.name);
            }
          }
        }
        if (changeIds.length > 0) {
          injectPrompt(ctx, [
            '<aiws-active-changes>',
            ...changeIds.map((id) => `  change: ${id}`),
            '→ run `aiws change status <id>` for details',
            '</aiws-active-changes>',
          ].join('\n'));
        }

        try {
          const validateOut = execSync(`${aiwsCliCmd} validate .`, {
            cwd: projectRoot, encoding: 'utf-8', timeout: 30_000,
          });
          injectPrompt(ctx, `<aiws-validate>${validateOut}</aiws-validate>`);
        } catch (validateErr) {
          const errMsg = validateErr instanceof Error ? validateErr.message : String(validateErr);
          injectPrompt(ctx, `<aiws-validate warn="true">validate failed: ${errMsg}</aiws-validate>`);
        }
      } catch (stateErr) {
        console.error('[aiws-ext] session_start state injection error:', stateErr);
      }
    } catch (err) {
      console.error('[aiws-ext] session_start hook error:', err);
    }
  });

  // ── 1a. Session Shutdown ─────────────────────────────────────────────
  ctx.on('session_shutdown', () => {
    try {
      const aiwsCliCmd = resolveAiwsCli(projectRoot);
      try {
        execSync(`${aiwsCliCmd} validate .`, {
          cwd: projectRoot, encoding: 'utf-8', timeout: 15_000,
        });
      } catch {
        // Validate failure on shutdown is informational; don't throw.
      }

      
      const gitDirty = execSync('git status --porcelain', {
        cwd: projectRoot, encoding: 'utf-8', timeout: 10_000,
      }).trim();
      if (gitDirty.length > 0) {
        console.warn(`[aiws-ext] Session ended with ${gitDirty.split('\n').length} uncommitted file(s).`);
      }
    } catch {
      // Best-effort; ignore errors during shutdown.
    }
  });

  // Best-effort: track current user message for hatch (event names vary by host)
  for (const ev of [
    'user_message',
    'message',
    'input',
    'before_agent_start',
    'session_prompt',
  ]) {
    try {
      ctx.on(ev, (...args: unknown[]) => {
        try {
          const raw = args[0];
          let text = '';
          if (typeof raw === 'string') text = raw;
          else if (raw && typeof raw === 'object') {
            const o = raw as Record<string, unknown>;
            text = String(o.text || o.content || o.message || o.prompt || '');
          }
          if (text) {
            sessionHatchActive = policy.detectHatch(text);
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* event not supported */
    }
  }

  // Best-effort tool intercept (host may ignore cancel flags)
  for (const ev of ['tool_call', 'before_tool', 'tool', 'agent_tool_call']) {
    try {
      ctx.on(ev, (...args: unknown[]): void => {
        try {
          const payload = (args[0] || {}) as Record<string, unknown>;
          const toolName = String(payload.name || payload.tool || payload.toolName || '');
          const toolArgs = payload.args || payload.arguments || payload.input;

          if (/^agent$/i.test(toolName)) {
            const t = extractSubagentType(toolArgs);
            const d = policy.decideAgentType(t);
            if (!d.allow) {
              const msg = `[aiws-force] ${d.reason}`;
              console.error(msg);
              if (payload && typeof payload === 'object') {
                (payload as { cancel?: boolean; error?: string }).cancel = true;
                (payload as { error?: string }).error = msg;
              }
            }
            return;
          }

          if (/^(write|edit)$/i.test(toolName)) {
            const path = extractPathFromToolArgs(toolArgs);
            const d = policy.decideMainWrite({
              toolName,
              filePath: path,
              hatchActive: sessionHatchActive,
            });
            if (!d.allow) {
              const msg = `[aiws-force] ${d.reason}`;
              console.error(msg);
              if (payload && typeof payload === 'object') {
                (payload as { cancel?: boolean; error?: string }).cancel = true;
                (payload as { error?: string }).error = msg;
              }
            }
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* not supported */
    }
  }

  // ── 2. aiws CLI Tool ──────────────────────────────────────────────────
  ctx.registerTool('aiws', async (args: string[]) => {
    const cli = resolveAiwsCli(projectRoot);
    const command = `${cli} ${args.join(' ')}`;

    try {
      const output = execSync(command, {
        cwd: projectRoot,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60_000,
      });
      return output.trim();
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      if (error.stdout && typeof error.stdout === 'string') {
        return error.stdout.trim();
      }
      if (error.stderr && typeof error.stderr === 'string') {
        return error.stderr.trim();
      }
      return `[aiws] Error: ${error.message || 'Unknown error'}`;
    }
  });

  // ── 3. aiws_subagent — DEPRECATED (do not execute newSession as primary) ─
  // Always register so the model sees a hard deprecation instead of silent legacy spawn.
  ctx.registerTool('aiws_subagent', async (args: string[]) => {
    const prompt = args.join(' ');
    return policy.aiwsSubagentDeprecationMessage(prompt);
  });

  // ── 4. cmd — dispatch workflow commands ──────────────────────────────
  ctx.registerTool('cmd', async (args: string[]) => {
    const input = args.join(' ').trim().replace(/^\//, '');
    const parts = input.split(/\s+/);
    const cmdName = parts[0] || '';
    const cmdArgs = parts.slice(1).join(' ');

    const skill = CMD_SKILL_MAP[cmdName];
    const wsCmd = skill ? undefined : WS_COMMAND_MAP.find((c) => c.name === cmdName);
    if (cmdName === 'help' || (!skill && !wsCmd)) {
      const list = [
        ...Object.entries(CMD_SKILL_MAP).map(([n, m]) => `  /${n} — ${m.desc}`),
        ...WS_COMMAND_MAP.map((c) => `  /${c.name} — ${c.desc}`),
      ].join('\n');
      return `可用命令：\n${list}\n\n用法：cmd("ws-plan") 或 cmd("ws-plan 写一个登录功能的plan")`;
    }

    const desc = skill ? skill.desc : (wsCmd as { desc: string }).desc;
    const content = resolveSkillContent(projectRoot, cmdName);
    if (!content) {
      return `[aiws] Skill file not found: ${cmdName}\n请先运行 \`aiws init\` 或检查 .agents/skills/${cmdName}`;
    }
    const header = `# Executing /${cmdName}: ${desc}\n` + (cmdArgs ? `\nUser context: ${cmdArgs}\n` : '');
    return `${header}\n${content}`;
  });

  // ── 4a. ws slash commands — real pi commands (TUI 直接输入 /<name>) ──
  for (const cmd of WS_COMMAND_MAP) {
    ctx.registerCommand(cmd.name, {
      description: cmd.desc,
      getArgumentCompletions:
        cmd.name === 'ws-bugfix'
          ? () => [{ value: '<bug-id>', label: '禅道 bug id' }]
          : undefined,
      handler: async (
        args: string,
      ) => {
        await handleWsSlashCommand(ctx, cmd, args);
      },
    });
  }

  // ── 5. Helper tool: record delegate failure evidence ───────────────────
  ctx.registerTool('aiws_record_delegate_failure', async (args: string[]) => {
    const error = args.join(' ') || 'unknown delegate failure';
    const path = writeDelegateFailure(projectRoot, error);
    if (path) {
      return `Wrote ${path}. STOP: do not silently implement business code in main session.`;
    }
    return (
      policy.formatDelegateFailureEvidence({ error }) +
      '\n\n(Could not write file; paste into .aiws/changes/<id>/evidence/delegate-failure.md)'
    );
  });
}

// ---------------------------------------------------------------------------
// Named exports for unit testing
// ---------------------------------------------------------------------------

export {
  resolveProjectRoot,
  resolveAiwsCli,
  scanActiveGoals,
  readGoalTitle,
  buildGoalContext,
  policy,
  extractPathFromToolArgs,
  extractSubagentType,
  handleWsSlashCommand,
};
