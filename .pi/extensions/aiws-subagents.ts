/// <reference types="node" />

/**
 * aiws-subagents.ts — 自研 pi 宿主 subagent 扩展（替代第三方插件 @tintinweb/pi-subagents）
 *
 * 提供三个工具：
 *   1. Agent               — 派发 subagent（AIWS force policy 门禁内嵌；前台阻断直跑 / 后台队列）
 *   2. get_subagent_result — 取回后台 agent 结果 / 状态
 *   3. steer_subagent      — 对运行中 agent 注入消息
 *
 * ⚠️ 默认停用（setup gate，deprecated 兼容层）：三个工具默认不注册，subagent 派发统一走
 * `aiws change tasks execute --strategy tmux`（TmuxSessionSpawner 独立 tmux 会话，tmux 不可用
 * 时自动降级 l1）。显式设置环境变量 AIWS_EXT_AGENT_ENABLED=1 重新启用本扩展工具。
 *
 * 设计约束（.aiws/changes/pi-native-subagent-runtime/design.md 决策 1-8）：
 *   - 单文件扩展；spawn 引擎复用 pi SDK（createAgentSession + DefaultResourceLoader），不自研会话引擎
 *   - force policy 内嵌：spawn 前 decideAgentType() 非白名单 → 工具拒绝（不 fallback）
 *   - 未知 subagent_type 不 fallback（与 pi-subagents 的关键差异，force policy 要求）
 *   - 不注册默认 agent（general-purpose/Explore/Plan）——直接不提供，无需 disableDefaultAgents
 *   - 事件：subagents:created|started|completed|failed|steered
 *   - v1 明确不做：schedule / persistent memory / worktree / RPC / output transcript（UI widget 已实现：右侧 TUI sidebar 显示运行记录，subagents 命令开关）
 *
 * 参考实现：/tmp/pi-subagents-src-143/package/src/{custom-agents,agent-runner,agent-types,index}.ts
 * force policy SSOT：packages/aiws/src/lib/pi-force-policy.ts（加载模式同 .pi/extensions/aiws.ts）
 *
 * @module aiws-subagents
 */

import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join, basename, dirname } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import {
  createAgentSession,
  createCodingTools,
  createReadOnlyTools,
  DefaultResourceLoader,
  defineTool,
  getAgentDir,
  parseFrontmatter,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Editor, isKeyRelease, Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
// ---------------------------------------------------------------------------
// Force policy（加载模式与 .pi/extensions/aiws.ts 一致）
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

export function loadForcePolicy(): ForcePolicyApi {
  const here =
    typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
  // 仅 .js（dist 构建产物）可 require；.ts 源无法在运行时 require，故不列入候选（避免死分支）。
  const candidates = [
    join(here, "../../packages/aiws/dist/lib/pi-force-policy.js"),
    join(process.cwd(), "packages/aiws/dist/lib/pi-force-policy.js"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const req = createRequire(join(here, "aiws-subagents.ts"));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return req(p) as ForcePolicyApi;
    } catch {
      // try next
    }
  }
  // 兜底：cwd dist（装配/嵌入场景）
  try {
    const req = createRequire(join(process.cwd(), "package.json"));
    return req("./packages/aiws/dist/lib/pi-force-policy.js") as ForcePolicyApi;
  } catch (e: unknown) {
    const reason = e instanceof Error ? ((e as NodeJS.ErrnoException).code ?? e.message.split("\n")[0]) : String(e);
    let advice = "请构建 packages/aiws 后重载";
    for (const p of candidates) {
      if (!existsSync(p)) continue;
      try {
        const srcTs = join(here, "../../packages/aiws/src/lib/pi-force-policy.ts");
        if (existsSync(srcTs) && statSync(p).mtimeMs < statSync(srcTs).mtimeMs) {
          advice = "dist 落后于 src，请重新构建 packages/aiws 后重载";
          break;
        }
      } catch { /* ignore */ }
    }
    console.warn(
      `[aiws-force] 加载 dist force policy 失败（${reason || "dist 缺失"}）：${advice}。` +
        "回退内联副本（fallbackForcePolicy），门禁可能与 pi-force-policy.ts 真值漂移。",
    );
    return fallbackForcePolicy();
  }
}

/** Minimal fallback if dist not built — behavior aligned with pi-force-policy.ts. */
export function fallbackForcePolicy(): ForcePolicyApi {
  const HATCH = [
    "直接改",
    "do it inline",
    "你直接改",
    "别派 sub-agent",
    "main session 写就行",
    "不用 sub-agent",
    "no sub-agent",
  ];
  const ALLOWED = ["aiws-worker", "aiws-reviewer"];
  return {
    detectHatch(msg) {
      if (!msg) return false;
      return HATCH.some((p) => msg.includes(p));
    },
    decideMainWrite({ toolName, filePath, hatchActive }) {
      if (!/^(write|edit)$/i.test(toolName)) return { allow: true, reason: "non-write" };
      if (hatchActive) return { allow: true, reason: "hatch" };
      const p = (filePath || "").replace(/\\/g, "/").replace(/^\.\//, "");
      const ok =
        p.includes("/evidence/") ||
        p.includes("/analysis/") ||
        p.includes("/review/") ||
        p.startsWith(".aiws/plan/") ||
        p.startsWith(".aiws/goals/");
      if (ok) return { allow: true, reason: "allowlist" };
      return { allow: false, reason: "MAIN_WRITE_DENIED", code: "MAIN_WRITE_DENIED" };
    },
    decideAgentType(t) {
      const x = (t || "").trim().toLowerCase();
      if (ALLOWED.includes(x)) return { allow: true, reason: x };
      return { allow: false, reason: "AGENT_TYPE_DENIED", code: "AGENT_TYPE_DENIED" };
    },
    buildForcePolicyPromptBlock() {
      return [
        "<aiws-pi-force-policy>",
        "Subagent-first: Agent(subagent_type=aiws-worker|aiws-reviewer). No silent main write.",
        "Hatch: " + HATCH.join(" | "),
        "Spec: packages/spec/docs/pi-subagent-first.md",
        "aiws_subagent is DEPRECATED — use the Agent tool. 默认 tmux 路径不变；视觉任务由独立 tmux Pi worker 读取路径，显式使用 aipper/qwen3 或 aipper/gpt-5.5，并回收 summary/结构化结果/done.signal；explorer/read-only 可并行，代码写入串行或隔离分支。",
        "</aiws-pi-force-policy>",
      ].join("\n");
    },
    aiwsSubagentDeprecationMessage(prompt) {
      return [
        "[aiws] aiws_subagent is DEPRECATED. Use the Agent tool:",
        '  Agent({ subagent_type: "aiws-worker" | "aiws-reviewer", prompt: "..." })',
        prompt ? `Prompt was not executed:\n${prompt.slice(0, 1500)}` : "",
      ].join("\n");
    },
    formatDelegateFailureEvidence({ changeId, error, attemptedType, at }) {
      return [
        "# Delegate failure (no silent main-session fallback)",
        "",
        `- **at**: ${at || new Date().toISOString()}`,
        changeId ? `- **change**: ${changeId}` : null,
        attemptedType ? `- **attempted_type**: ${attemptedType}` : null,
        `- **error**: ${error}`,
        "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}

const policy = loadForcePolicy();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 本扩展注册的工具名（subagent 不可继承，防递归派发）。 */
export const SUBAGENT_TOOL_NAMES = {
  AGENT: "Agent",
  GET_RESULT: "get_subagent_result",
  STEER: "steer_subagent",
} as const;

const EXCLUDED_TOOL_NAMES: string[] = Object.values(SUBAGENT_TOOL_NAMES);

/** max_turns 软收尾（steer）后的额外宽限轮数，超限后 abort 硬停。 */
export const GRACE_TURNS = 5;

/** 后台并发上限。 */
export const MAX_CONCURRENT_BACKGROUND = 4;

/** 结果被 get_subagent_result 取回（resultConsumed）即逐出；未取回则在 TTL 后逐出（内存有界）。 */
export const RECORD_TTL_MS = 15 * 60 * 1000;

/** records Map 上限；超限逐出最旧的已结束记录（LRU）。 */
export const MAX_RECORDS = 50;

/** 后台完成通知的 hold 窗口：给 get_subagent_result 机会取消（结果取回则抑制通知）。 */
export const NUDGE_HOLD_MS = 200;
/**
 * 全部 7 个内置工具名（read/bash/edit/write/grep/find/ls），
 * 从 pi 自身工具工厂派生而非硬编码（createCodingTools + createReadOnlyTools 去重并集）。
 */
export const BUILTIN_TOOL_NAMES: string[] = [
  ...new Set(
    [...createCodingTools("."), ...createReadOnlyTools(".")].map((t) => t.name),
  ),
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemoryScope = "user" | "project" | "local";

/** 解析后的 agent 配置（字段与 pi-subagents custom-agents.ts 兼容）。 */
export interface AgentConfig {
  name: string;
  displayName?: string;
  description: string;
  /** undefined = 全部内置工具；[] = 零内置（tools: none）。 */
  builtinToolNames?: string[];
  /** tools: 字段中的 ext: 选择器（v1 只收集不强制）。 */
  extSelectors?: string[];
  disallowedTools?: string[];
  /** true = 继承全部扩展；false = 不加载扩展；string[] = 按名选择（v1 简化：仅 true/false 生效）。 */
  extensions: true | string[] | false;
  excludeExtensions?: string[];
  /** true = 继承全部 skills；false = 不加载；string[] = v1 简化：加载全部。 */
  skills: true | string[] | false;
  model?: string;
  thinking?: string;
  maxTurns?: number;
  persistSession?: boolean;
  outputTranscript?: boolean;
  sessionDir?: string;
  systemPrompt: string;
  promptMode: "replace" | "append";
  inheritContext?: boolean;
  runInBackground?: boolean;
  isolated?: boolean;
  memory?: MemoryScope;
  isolation?: "worktree";
  enabled?: boolean;
  source: "project" | "global";
}

type AgentStatus = "queued" | "running" | "completed" | "steered" | "aborted" | "error";

export interface AgentRecord {
  id: string;
  type: string;
  description: string;
  status: AgentStatus;
  result?: string;
  error?: string;
  toolUses: number;
  startedAt: number;
  completedAt?: number;
  session?: AgentSession;
  promise?: Promise<string>;
  /** get_subagent_result 已取回 → 抑制重复通知。 */
  resultConsumed?: boolean;
}

interface RunOptions {
  /** Manager 分配的 id；用于 session 命名（type#id）。 */
  agentId?: string;
  model?: unknown;
  maxTurns?: number;
  thinkingLevel?: string;
  isolated?: boolean;
  inheritContext?: boolean;
  signal?: AbortSignal;
  /** session 一旦创建即回调（用于后台 agent 的 steer / verbose 取回）。 */
  onSessionCreated?: (session: AgentSession) => void;
  onToolActivity?: (activity: { type: "start" | "end"; toolName: string }) => void;
  onTextDelta?: (delta: string, fullText: string) => void;
  onTurnEnd?: (turnCount: number) => void;
}

interface RunResult {
  responseText: string;
  session: AgentSession;
  aborted: boolean;
  steered: boolean;
  failure?: string;
}

// ---------------------------------------------------------------------------
// 配置解析层（参考 pi-subagents custom-agents.ts 精简）
// ---------------------------------------------------------------------------

function str(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}

function nonNegativeInt(val: unknown): number | undefined {
  return typeof val === "number" && val >= 0 ? val : undefined;
}

function parseCsvField(val: unknown): string[] | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  if (!s || s === "none") return undefined;
  const items = s.split(",").map((t) => t.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function csvList(val: unknown, defaults: string[]): string[] {
  if (val === undefined || val === null) return defaults;
  return parseCsvField(val) ?? [];
}

function csvListOptional(val: unknown): string[] | undefined {
  return parseCsvField(val);
}

/**
 * 把 `tools:` CSV 划分为内置工具允许列表与原始 ext: 选择器。
 * `*`/`all` 展开为全部内置；`none`/空 = 零内置；`ext:` 条目 = 扩展工具选择器（v1 只收集）。
 * omitted → 全部内置。仅含 ext: 条目 → 零内置（与 pi-subagents 一致）。
 */
export function parseToolsField(val: unknown): {
  builtinToolNames: string[];
  extSelectors: string[] | undefined;
} {
  const entries = csvList(val, BUILTIN_TOOL_NAMES);
  const isWildcard = (e: string) => e === "*" || e.toLowerCase() === "all";
  const hasWildcard = entries.some(isWildcard);
  const plain = entries.filter((e) => !isWildcard(e) && !e.startsWith("ext:"));
  const extEntries = entries.filter((e) => e.startsWith("ext:"));
  return {
    builtinToolNames: hasWildcard ? [...new Set([...BUILTIN_TOOL_NAMES, ...plain])] : plain,
    extSelectors: extEntries.length > 0 ? extEntries : undefined,
  };
}

function parseMemory(val: unknown): MemoryScope | undefined {
  if (val === "user" || val === "project" || val === "local") return val;
  return undefined;
}

function inheritField(val: unknown): true | string[] | false {
  if (val === undefined || val === null || val === true) return true;
  if (val === false || val === "none") return false;
  const items = csvList(val, []);
  return items.length > 0 ? items : false;
}

function loadFromDir(
  dir: string,
  agents: Map<string, AgentConfig>,
  source: "project" | "global",
): void {
  if (!existsSync(dir)) return;
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return;
  }
  for (const file of files) {
    const name = basename(file, ".md");
    let content: string;
    try {
      content = readFileSync(join(dir, file), "utf-8");
    } catch {
      continue;
    }
    const { frontmatter: fm, body } = parseFrontmatter<Record<string, unknown>>(content);
    const { builtinToolNames, extSelectors } = parseToolsField(fm.tools);
    agents.set(name, {
      name,
      displayName: str(fm.display_name),
      description: str(fm.description) ?? name,
      builtinToolNames,
      extSelectors,
      disallowedTools: csvListOptional(fm.disallowed_tools),
      extensions: inheritField(fm.extensions ?? fm.inherit_extensions),
      excludeExtensions: csvListOptional(fm.exclude_extensions),
      skills: inheritField(fm.skills ?? fm.inherit_skills),
      model: str(fm.model),
      thinking: str(fm.thinking),
      maxTurns: nonNegativeInt(fm.max_turns),
      persistSession: fm.persist_session != null ? fm.persist_session === true : undefined,
      outputTranscript: fm.output_transcript != null ? fm.output_transcript !== false : undefined,
      sessionDir: str(fm.session_dir),
      systemPrompt: body.trim(),
      promptMode: fm.prompt_mode === "append" ? "append" : "replace",
      inheritContext: fm.inherit_context != null ? fm.inherit_context === true : undefined,
      runInBackground: fm.run_in_background != null ? fm.run_in_background === true : undefined,
      isolated: fm.isolated != null ? fm.isolated === true : undefined,
      memory: parseMemory(fm.memory),
      isolation: fm.isolation === "worktree" ? "worktree" : undefined,
      enabled: fm.enabled !== false, // 默认 true；显式 false 禁用
      source,
    });
  }
}

/**
 * 扫描自定义 agent .md（优先级从低到高，后者覆盖前者同名）：
 *   1. 全局：$PI_CODING_AGENT_DIR/agents/*.md（getAgentDir()）
 *   2. 工作区：<cwd>/.agents/agents/*.md
 *   3. 项目：<cwd>/.pi/agents/*.md（最高优先级）
 */
export function loadCustomAgents(cwd: string): Map<string, AgentConfig> {
  const globalDir = join(getAgentDir(), "agents");
  const workspaceProjectDir = join(cwd, ".agents", "agents");
  const projectDir = join(cwd, ".pi", "agents");
  const agents = new Map<string, AgentConfig>();
  loadFromDir(globalDir, agents, "global");
  loadFromDir(workspaceProjectDir, agents, "project");
  loadFromDir(projectDir, agents, "project");
  return agents;
}

// ---------------------------------------------------------------------------
// 注册表（无默认 agent；未知 type 不 fallback）
// ---------------------------------------------------------------------------

export class AgentRegistry {
  private agents = new Map<string, AgentConfig>();

  constructor(cwd = process.cwd()) {
    this.reload(cwd);
  }

  reload(cwd: string): void {
    this.agents = loadCustomAgents(cwd);
  }

  /** Case-insensitive key 解析；找不到返回 undefined（不 fallback）。 */
  resolveType(name: string): string | undefined {
    if (!name) return undefined;
    if (this.agents.has(name)) return name;
    const lower = name.toLowerCase();
    for (const key of this.agents.keys()) {
      if (key.toLowerCase() === lower) return key;
    }
    return undefined;
  }

  /** 解析 type 并返回启用中的配置；未注册 / enabled:false → undefined。 */
  getConfig(name: string): AgentConfig | undefined {
    const key = this.resolveType(name);
    if (!key) return undefined;
    const c = this.agents.get(key);
    return c && c.enabled !== false ? c : undefined;
  }

  getAvailableTypes(): string[] {
    return [...this.agents.entries()]
      .filter(([, c]) => c.enabled !== false)
      .map(([name]) => name);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 工具 execute 的 text 返回。 */
export function textResult(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details: details as unknown };
}

/** 从消息 content 块数组提取纯文本。 */
export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => (c as { type?: string })?.type === "text")
      .map((c) => (c as { text?: string }).text ?? "")
      .join("\n");
  }
  return "";
}

/** 统一取 session 消息数组（消除 5+ 处 `as { messages? }` 强转重复）。 */
export function getSessionMessages(session: unknown): unknown[] {
  return ((session as { messages?: unknown[] } | undefined)?.messages ?? []) as unknown[];
}

/** 统一错误文本化（err instanceof Error ? err.message : String(err) 的 5 处重复）。 */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 取本次调用（startIndex 起）最后一段非空 assistant 文本。 */
export function getLastAssistantText(session: AgentSession, startIndex = 0): string {
  const messages = getSessionMessages(session);
  for (let i = messages.length - 1; i >= startIndex; i--) {
    const msg = messages[i] as { role?: string; content?: unknown };
    if (msg.role !== "assistant") continue;
    const text = extractText(msg.content).trim();
    if (text) return text;
  }
  return "";
}

/** 最后一段 assistant 消息的失败原因（provider error / 静默 max-token）。 */
function finalTurnError(session: AgentSession, startIndex = 0): string | undefined {
  const messages = getSessionMessages(session);
  for (let i = messages.length - 1; i >= startIndex; i--) {
    const msg = messages[i] as { role?: string; content?: unknown; stopReason?: string; errorMessage?: string };
    if (msg.role !== "assistant") continue;
    if (msg.stopReason === "error") {
      return msg.errorMessage?.trim() || "provider error with no output";
    }
    if (msg.stopReason === "length" && !extractText(msg.content).trim()) {
      return "run hit the output token limit before producing any text";
    }
    return undefined;
  }
  return undefined;
}

/** 将 agent 会话格式化为可读文本（get_subagent_result verbose）。 */
export function getAgentConversation(session: AgentSession): string {
  const messages = getSessionMessages(session);
  const parts: string[] = [];
  for (const raw of messages) {
    const msg = raw as {
      role?: string;
      content?: unknown;
      toolName?: string;
    };
    if (msg.role === "user") {
      const text = extractText(msg.content).trim();
      if (text) parts.push(`[User]: ${text}`);
    } else if (msg.role === "assistant") {
      const textParts: string[] = [];
      const toolCalls: string[] = [];
      const content = Array.isArray(msg.content) ? msg.content : [];
      for (const c of content as Array<{ type?: string; text?: string; name?: string; toolName?: string }>) {
        if (c.type === "text" && c.text) textParts.push(c.text);
        else if (c.type === "toolCall") toolCalls.push(`  Tool: ${c.name ?? c.toolName ?? "unknown"}`);
      }
      if (textParts.length > 0) parts.push(`[Assistant]: ${textParts.join("\n")}`);
      if (toolCalls.length > 0) parts.push(`[Tool Calls]:\n${toolCalls.join("\n")}`);
    } else if (msg.role === "toolResult") {
      const text = extractText(msg.content);
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      parts.push(`[Tool Result (${msg.toolName ?? "?"})]: ${truncated}`);
    }
  }
  return parts.join("\n\n");
}

/** 父会话上下文（inherit_context: true 时注入子 agent）。 */
export function buildParentContext(ctx: ExtensionContext): string {
  const entries = (ctx.sessionManager as { getBranch?: () => unknown[] }).getBranch?.() ?? [];
  if (entries.length === 0) return "";
  const parts: string[] = [];
  for (const entry of entries as Array<{ type?: string; message?: unknown; summary?: string }>) {
    if (entry.type === "message") {
      const msg = entry.message as { role?: string; content?: unknown };
      if (!msg) continue;
      if (msg.role === "user") {
        const text = extractText(msg.content).trim();
        if (text) parts.push(`[User]: ${text}`);
      } else if (msg.role === "assistant") {
        const text = extractText(msg.content).trim();
        if (text) parts.push(`[Assistant]: ${text}`);
      }
      // 跳过 toolResult（太冗长）
    } else if (entry.type === "compaction" && entry.summary) {
      parts.push(`[Summary]: ${entry.summary}`);
    }
  }
  if (parts.length === 0) return "";
  return `# Parent Conversation Context
The following is the conversation history from the parent session that spawned you.
Use this context to understand what has been discussed and decided so far.

${parts.join("\n\n")}

---
# Your Task (below)
`;
}

/** 解析 "provider/modelId"；解析失败返回 undefined（→ 父模型）。v1 不支持模糊名。 */
export type ModelResolveResult =
  | { ok: true; model: unknown }
  | { ok: false; error: string };
// 判别联合取代 `unknown | string` 弱联合：成功携带 model，失败携带错误文案，调用方类型可辨（消除 Primitive Obsession）。
/**
 * 解析 "provider/modelId"。成功返回 { ok:true, model }；失败返回 { ok:false, error }。
 * v1 不支持模糊名；params.model（调用方显式指定）解析失败应显式报错，
 * 不静默回退父模型（与 pi-subagents invocation-config.ts 行为对齐）。
 */
export function resolveModel(modelInput: string, registry: unknown): ModelResolveResult {
  const slashIdx = modelInput.indexOf("/");
  if (slashIdx === -1) {
    return { ok: false, error: `未能解析 model: "${modelInput}"（v1 仅支持 "provider/modelId" 精确格式，如 "anthropic/claude-sonnet-4"）` };
  }
  const provider = modelInput.slice(0, slashIdx);
  const modelId = modelInput.slice(slashIdx + 1);
  const found = (registry as { find?: (p: string, id: string) => unknown }).find?.(provider, modelId);
  if (found) {
    return { ok: true, model: found };
  }
  return { ok: false, error: `未能解析 model: "${modelInput}"（model registry 中无 provider="${provider}" / modelId="${modelId}"）` };
}

export function randomAgentId(): string {
  return randomBytes(4).toString("hex");
}

/** undefined 或 0 = 无限；否则最小 1。 */
export function normalizeMaxTurns(n: number | undefined): number | undefined {
  if (n == null || n === 0) return undefined;
  return Math.max(1, n);
}

/**
 * invocation-config 语义（对齐 pi-subagents invocation-config.ts）：
 * config（.md frontmatter）优先于工具调用参数，最后才是默认值。
 * 选择优先级：maxTurns = config.maxTurns ?? params.max_turns；
 * runInBackground / inheritContext / isolated = config.xxx ?? params.xxx ?? false；
 * thinking = config.thinking ?? params.thinking；model 输入 = config.model ?? params.model。
 */
export interface InvocationParams {
  max_turns?: number;
  run_in_background?: boolean;
  inherit_context?: boolean;
  isolated?: boolean;
  thinking?: string;
  model?: string;
}

export interface ResolvedInvocation {
  maxTurns: number | undefined;
  runInBackground: boolean;
  inheritContext: boolean;
  isolated: boolean;
  thinkingLevel: string | undefined;
  /** config.model 或 params.model；父模型回退在调用方 resolveModel 处理。 */
  modelInput: string | undefined;
}

export function resolveInvocationConfig(
  config: Pick<
    AgentConfig,
    'maxTurns' | 'runInBackground' | 'inheritContext' | 'isolated' | 'thinking' | 'model'
  >,
  params: InvocationParams,
): ResolvedInvocation {
  return {
    maxTurns: normalizeMaxTurns(config.maxTurns ?? params.max_turns),
    runInBackground: config.runInBackground ?? params.run_in_background ?? false,
    inheritContext: config.inheritContext ?? params.inherit_context ?? false,
    isolated: config.isolated ?? params.isolated ?? false,
    thinkingLevel: config.thinking ?? params.thinking,
    modelInput: config.model ?? params.model,
  };
}

function forwardAbortSignal(session: AgentSession, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  const onAbort = () => {
    void session.abort().catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

/**
 * 从当前会话推导活动 change id（确定性优先，避免 delegate-failure 证据写到别的 change）：
 *   1. git 分支 `change/<id>`（.git/HEAD → refs/heads/change/<id>；支持 worktree gitdir 文件）；
 *   2. `.aiws/config.json` 的 active_change / activeChange / change 字段；
 *   3. `.aiws/changes/*.ws-change.json` 的 change_id（仅当恰好一个，避免歧义猜测）。
 * 无法确定返回 null（调用方回退临时目录，不污染其他 change 的 evidence）。
 */
export function resolveActiveChangeId(projectRoot: string): string | null {
  // 1) git 分支名
  try {
    let headPath = join(projectRoot, ".git", "HEAD");
    const gitPath = join(projectRoot, ".git");
    if (!existsSync(headPath) && existsSync(gitPath)) {
      // worktree / submodule：.git 是 "gitdir: <path>" 文件
      const link = readFileSync(gitPath, "utf-8").trim();
      const m = link.match(/^gitdir:\s*(.+)$/);
      if (m) headPath = join(m[1].trim(), "HEAD");
    }
    if (existsSync(headPath)) {
      const head = readFileSync(headPath, "utf-8").trim();
      const m = head.match(/^ref:\s*refs\/heads\/change\/(.+)$/);
      if (m && m[1].trim()) return m[1].trim();
    }
  } catch {
    // fallthrough
  }
  // 2) .aiws/config.json
  try {
    const cfgPath = join(projectRoot, ".aiws", "config.json");
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as Record<string, unknown>;
      const id = cfg?.active_change ?? cfg?.activeChange ?? cfg?.change;
      if (typeof id === "string" && id.trim()) return id.trim();
    }
  } catch {
    // fallthrough
  }
  // 3) .aiws/changes/*.ws-change.json（唯一才采用）
  try {
    const changeDir = join(projectRoot, ".aiws", "changes");
    if (existsSync(changeDir)) {
      const files = readdirSync(changeDir).filter((f) => f.endsWith(".ws-change.json"));
      if (files.length === 1) {
        const data = JSON.parse(readFileSync(join(changeDir, files[0]), "utf-8")) as Record<string, unknown>;
        const id = data?.change_id ?? data?.changeId ?? data?.id;
        if (typeof id === "string" && id.trim()) return id.trim();
      }
    }
  } catch {
    // fallthrough
  }
  return null;
}

/**
 * 委托失败 → 写 evidence/delegate-failure.md（禁止静默主写）。
 * change id 优先从当前分支/配置解析；无法解析时回退 `.aiws/tmp/delegate-failure/`
 * 并在证据中注明（绝不污染其他 change 的 evidence）。
 */
export function writeDelegateFailure(
  projectRoot: string,
  error: string,
  attemptedType?: string,
): string | null {
  const changeId = resolveActiveChangeId(projectRoot);
  const evidenceDir = changeId
    ? join(projectRoot, ".aiws", "changes", changeId, "evidence")
    : join(projectRoot, ".aiws", "tmp", "delegate-failure");
  try {
    mkdirSync(evidenceDir, { recursive: true });
    const body =
      policy.formatDelegateFailureEvidence({ changeId: changeId ?? undefined, error, attemptedType }) +
      (changeId
        ? ""
        : "\n> **注意**: 无法解析活动 change（分支不在 change/<id>，.aiws/config.json 也无 active change），证据写入临时目录，未污染任何 change 的 evidence。\n");
    const path = join(evidenceDir, "delegate-failure.md");
    writeFileSync(path, body, "utf-8");
    return path;
  } catch {
    return null;
  }
}
// ---------------------------------------------------------------------------
// spawn 核心（参考 pi-subagents agent-runner.ts runAgent 精简）
// ---------------------------------------------------------------------------

async function runAgent(
  ctx: ExtensionContext,
  type: string,
  prompt: string,
  options: RunOptions,
): Promise<RunResult> {
  const config = registry.getConfig(type);
  const cwd = ctx.cwd;
  const agentDir = getAgentDir();

  // 参数优先级：frontmatter 配置 > 工具调用参数（invocation-config.ts）
  const isolated = options.isolated === true || config?.isolated === true;
  const noExtensions = isolated || config?.extensions === false;
  const noSkills = isolated || config?.skills === false;

  // systemPrompt：prompt_mode replace → 仅 body；append → parentSystemPrompt + body
  const parentSystemPrompt = ctx.getSystemPrompt();
  const body = config?.systemPrompt ?? "";
  const systemPrompt =
    config?.promptMode === "append"
      ? [parentSystemPrompt?.trim(), body].filter(Boolean).join("\n\n")
      : body;

  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    noExtensions,
    noSkills,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => systemPrompt,
    appendSystemPromptOverride: () => [],
  });
  await loader.reload();

  // 工具范围：
  // - noExtensions（含 isolated / extensions: false）→ 静态 allowlist
  // - 否则用 excludeTools deny 列表（放行扩展工具，v1 不做 ext: 收窄）
  const toolNames = config?.builtinToolNames ?? BUILTIN_TOOL_NAMES;
  const disallowedSet = config?.disallowedTools
    ? new Set(config.disallowedTools)
    : undefined;
  const builtinToolNameSet = new Set(toolNames);

  let sessionTools: string[] | undefined;
  let sessionExcludeTools: string[] | undefined;
  if (noExtensions) {
    sessionTools = toolNames.filter(
      (t) => !EXCLUDED_TOOL_NAMES.includes(t) && !disallowedSet?.has(t),
    );
  } else {
    const denyTools = new Set<string>(EXCLUDED_TOOL_NAMES);
    for (const name of BUILTIN_TOOL_NAMES) {
      if (!builtinToolNameSet.has(name)) denyTools.add(name);
    }
    if (disallowedSet) {
      for (const name of disallowedSet) denyTools.add(name);
    }
    sessionExcludeTools = [...denyTools];
  }

  // 模型：options.model（已按 config.model > params.model 解析）> ctx.model
  type CreateSessionOptions = NonNullable<Parameters<typeof createAgentSession>[0]>;
  const model = (options.model ?? ctx.model) as CreateSessionOptions["model"];

  // 后台并发上限时经 SessionManager.inMemory（v1 不做 persistSession / session_dir）
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const sessionManager = SessionManager.inMemory(cwd);

  // 携带父 session 的 model runtime（0.83.0 用 modelRuntime；ModelRegistry 内部持有 runtime）
  const parentModelRuntime = (
    ctx.modelRegistry as unknown as { runtime?: unknown }
  ).runtime;
  const sessionOpts: CreateSessionOptions = {
    cwd,
    agentDir,
    sessionManager,
    settingsManager,
    ...(parentModelRuntime !== undefined
      ? { modelRuntime: parentModelRuntime as CreateSessionOptions["modelRuntime"] }
      : {}),
    model,
    resourceLoader: loader,
  };
  if (sessionTools) sessionOpts.tools = sessionTools;
  if (sessionExcludeTools) sessionOpts.excludeTools = sessionExcludeTools;
  if (options.thinkingLevel ?? config?.thinking) {
    sessionOpts.thinkingLevel = (options.thinkingLevel ?? config?.thinking) as CreateSessionOptions["thinkingLevel"];
  }

  const { session } = await createAgentSession(sessionOpts);
  session.setSessionName(
    options.agentId ? `${type}#${options.agentId.slice(0, 8)}` : type,
  );

  // 绑定扩展：让子 agent 会话触发 session_start（extension 初始化）。失败不致命。
  try {
    await session.bindExtensions({
      onError: (err: unknown) => {
        options.onToolActivity?.({
          type: "end",
          toolName: `extension-error:${(err as { extensionPath?: string }).extensionPath ?? "unknown"}`,
        });
      },
    });
  } catch {
    // 子 agent 仍可带内置工具运行
  }

  options.onSessionCreated?.(session);

  // 事件订阅：turn_end 计轮 + 超限软收尾/硬停；message_update 累积结果文本
  let turnCount = 0;
  const maxTurns = normalizeMaxTurns(options.maxTurns ?? config?.maxTurns);
  let softLimitReached = false;
  let aborted = false;
  let currentMessageText = "";
  let lastAssistantText = "";

  const unsubTurns = session.subscribe((event: AgentSessionEvent) => {
    if (event.type === "turn_end") {
      turnCount++;
      options.onTurnEnd?.(turnCount);
      if (maxTurns != null) {
        if (!softLimitReached && turnCount >= maxTurns) {
          softLimitReached = true;
          void session.steer(
            "You have reached your turn limit. Wrap up immediately — provide your final answer now.",
          ).catch(() => {});
        } else if (softLimitReached && turnCount >= maxTurns + GRACE_TURNS) {
          aborted = true;
          void session.abort().catch(() => {});
        }
      }
    }
    if (event.type === "message_start") {
      currentMessageText = "";
      if (event.message.role === "assistant") lastAssistantText = "";
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      currentMessageText += event.assistantMessageEvent.delta;
      lastAssistantText += event.assistantMessageEvent.delta;
      options.onTextDelta?.(event.assistantMessageEvent.delta, currentMessageText);
    }
    if (event.type === "tool_execution_start") {
      options.onToolActivity?.({ type: "start", toolName: event.toolName });
    }
    if (event.type === "tool_execution_end") {
      options.onToolActivity?.({ type: "end", toolName: event.toolName });
    }
  });

  const cleanupAbort = forwardAbortSignal(session, options.signal);

  // inherit_context → 前缀父会话上下文
  let effectivePrompt = prompt;
  if (options.inheritContext === true) {
    const parentContext = buildParentContext(ctx);
    if (parentContext) effectivePrompt = parentContext + prompt;
  }

  // 本次调用边界（仅本次产生的 assistant 文本算作输出）
  const startLen = getSessionMessages(session).length;
  try {
    await session.prompt(effectivePrompt);
  } finally {
    unsubTurns();
    cleanupAbort();
  }

  const responseText =
    lastAssistantText.trim() || getLastAssistantText(session, startLen);
  return {
    responseText,
    session,
    aborted,
    steered: softLimitReached,
    failure: finalTurnError(session, startLen),
  };
}

/** resume：向既有 session 继续发 prompt（取本次产生的结果文本）。 */
async function resumeAgent(
  session: AgentSession,
  prompt: string,
): Promise<{ text: string; failure?: string }> {
  const startLen = getSessionMessages(session).length;
  let text = "";
  let lastAssistantText = "";
  const unsub = session.subscribe((event: AgentSessionEvent) => {
    if (event.type === "message_start" && event.message.role === "assistant") {
      lastAssistantText = "";
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      text += event.assistantMessageEvent.delta;
      lastAssistantText += event.assistantMessageEvent.delta;
    }
  });
  try {
    await session.prompt(prompt);
  } finally {
    unsub();
  }
  const resultText = lastAssistantText.trim() || getLastAssistantText(session, startLen);
  return { text: resultText, failure: finalTurnError(session, startLen) };
}

// ---------------------------------------------------------------------------
// AgentManager（后台队列 + 前台阻断式）
// ---------------------------------------------------------------------------

export class AgentManager {
  private records = new Map<string, AgentRecord>();
  private queue: Array<{
    id: string;
    type: string;
    prompt: string;
    opts: SpawnOptions;
  }> = [];
  private runningBackground = 0;
  private readonly maxConcurrent: number;
  /** 后台完成通知的 pending 计时器（id → timer）。 */
  private pendingNotifications = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(maxConcurrent: number = MAX_CONCURRENT_BACKGROUND) {
    this.maxConcurrent = maxConcurrent;
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  getRecord(id: string): AgentRecord | undefined {
    return this.records.get(id);
  }

  listAgents(): AgentRecord[] {
    return [...this.records.values()];
  }

  /**
   * 结果被 get_subagent_result 取回 → 逐出记录（session 同步 dispose），
   * 并取消可能 pending 的完成通知（resultConsumed 抑制通知的落点）。
   */
  markConsumed(id: string): void {
    const r = this.records.get(id);
    if (!r) return;
    r.resultConsumed = true;
    this.cancelNotification(id);
    this.disposeRecord(id);
  }

  /**
   * 后台完成通知：短暂 hold 后经 sendUserMessage（主 session 消息渠道）送达，
   * 使 "You will be notified when this agent completes." 成立；
   * 结果已被 get_subagent_result 取回（resultConsumed）→ 抑制。
   */
  private maybeNotify(pi: ExtensionAPI, record: AgentRecord): void {
    if (record.resultConsumed) return;
    this.cancelNotification(record.id);
    const timer = setTimeout(() => {
      this.pendingNotifications.delete(record.id);
      try {
        if (record.resultConsumed) return;
        const statusLabel =
          record.status === "error" || record.status === "aborted" ? "failed" : "completed";
        const preview = (record.result ?? "").slice(0, 200);
        const body =
          `[aiws-subagents] 后台 agent "${record.description}" (${record.type}, id: ${record.id}) ${statusLabel}。\n` +
          (record.error ? `错误: ${record.error}\n` : "") +
          `结果预览: ${preview || "(无输出)"}\n` +
          `用 get_subagent_result 取回完整结果。`;
        const api = pi as ExtensionAPI & { sendUserMessage?: (c: string, o?: unknown) => void };
        if (typeof api.sendUserMessage === "function") {
          api.sendUserMessage(body, { deliverAs: "followUp" });
        } else {
          // 老版本 SDK 兜底：custom message（无自定义 renderer 时仅作 UI 展示）
          (pi as unknown as { sendMessage?: (m: Record<string, unknown>, o?: unknown) => void }).sendMessage?.(
            { customType: "subagent-notification", content: body, display: true },
            { deliverAs: "followUp", triggerTurn: true },
          );
        }
      } catch {
        // 通知失败不致命
      }
    }, NUDGE_HOLD_MS);
    this.pendingNotifications.set(record.id, timer);
  }

  private cancelNotification(id: string): void {
    const timer = this.pendingNotifications.get(id);
    if (timer != null) {
      clearTimeout(timer);
      this.pendingNotifications.delete(id);
    }
  }

  /** 逐出记录：删除 + dispose session（try/catch 包裹，释放失败不致命）。 */
  private disposeRecord(id: string): void {
    const r = this.records.get(id);
    if (!r) return;
    this.records.delete(id);
    this.cancelNotification(id);
    try {
      r.session?.dispose();
    } catch {
      // ignore
    }
  }

  /**
   * 内存有界：TTL 超时的已结束记录逐出 + LRU 上限（保留最近 MAX_RECORDS 条）。
   * 在 createRecord（新 agent 创建）与 markConsumed 时惰性执行。
   */
  private sweepExpired(): void {
    const now = Date.now();
    for (const [id, r] of [...this.records]) {
      if (r.completedAt != null && now - r.completedAt > RECORD_TTL_MS) {
        this.disposeRecord(id);
      }
    }
    if (this.records.size > MAX_RECORDS) {
      const finished = [...this.records.values()]
        .filter((r) => r.status !== "running" && r.status !== "queued")
        .sort((a, b) => (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt));
      let excess = this.records.size - MAX_RECORDS;
      for (const r of finished) {
        if (excess <= 0) break;
        this.disposeRecord(r.id);
        excess--;
      }
    }
  }

  /** 中止运行中的 agent（fleet viewer 的 x 停止用）；返回是否成功发起。 */
  abort(id: string): boolean {
    const record = this.records.get(id);
    if (!record?.session || (record.status !== "running" && record.status !== "queued")) return false;
    void record.session.abort().catch(() => {});
    return true;
  }

  /** 会话关闭：dispose 全部 session + 清空 pending 通知计时器。 */
  dispose(): void {
    for (const id of [...this.records.keys()]) this.disposeRecord(id);
    for (const t of this.pendingNotifications.values()) clearTimeout(t);
    this.pendingNotifications.clear();
  }

  /** 前台阻断式：spawn + 等待完成；不抛异常，失败以 status=error 返回。 */
  async spawnForeground(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    type: string,
    prompt: string,
    opts: SpawnOptions,
  ): Promise<AgentRecord> {
    const id = randomAgentId();
    const record = this.createRecord(id, type, opts.description ?? type);
    record.status = "running";
    emit(pi, "subagents:created", { id, type, description: record.description, isBackground: false });
    emit(pi, "subagents:started", { id, type, description: record.description });
    try {
      const result = await runAgent(ctx, type, prompt, {
        agentId: id,
        model: opts.model,
        maxTurns: opts.maxTurns,
        thinkingLevel: opts.thinkingLevel,
        isolated: opts.isolated,
        inheritContext: opts.inheritContext,
        signal: opts.signal,
        onSessionCreated: (session) => {
          record.session = session;
        },
        onToolActivity: (activity) => {
          record.toolUses++;
          trackToolActivity(record.id, activity);
        },
        onTextDelta: (_delta, fullText) => {
          record.result = fullText.trim();
        },
      });
      record.session = result.session;
      // 前台：结果内联返回，不发后台完成通知
      this.finalize(pi, ctx, record, result, false);
    } catch (err) {
      this.markFailed(pi, ctx, record, type, errMessage(err));
    }
    return record;
  }

  /** 后台：返回 agent id 立即返回；超并发上限进 FIFO 队列。 */
  spawnBackground(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    type: string,
    prompt: string,
    opts: SpawnOptions,
  ): string {
    const id = randomAgentId();
    const record = this.createRecord(id, type, opts.description ?? type);
    record.status = "queued";
    emit(pi, "subagents:created", { id, type, description: record.description, isBackground: true });
    if (this.runningBackground < this.maxConcurrent) {
      this.startBackground(pi, ctx, id, type, prompt, opts);
    } else {
      this.queue.push({ id, type, prompt, opts });
    }
    return id;
  }

  /** resume：向既有记录续跑；返回更新后的记录或 undefined。 */
  async resume(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    id: string,
    prompt: string,
  ): Promise<AgentRecord | undefined> {
    const record = this.records.get(id);
    if (!record || !record.session) return undefined;
    if (record.status === "running") return undefined;
    record.status = "running";
    record.error = undefined;
    record.completedAt = undefined;
    emit(pi, "subagents:started", { id, type: record.type, description: record.description });
    try {
      const { text, failure } = await resumeAgent(record.session, prompt);
      record.result = text.trim() || "(no output)";
      if (failure) {
        this.markFailed(pi, ctx, record, record.type, failure);
      } else {
        record.status = "completed";
        record.completedAt = Date.now();
        emit(pi, "subagents:completed", {
          id,
          type: record.type,
          result: (record.result ?? "").slice(0, 500),
          toolUses: record.toolUses,
          durationMs: record.completedAt - record.startedAt,
        });
      }
    } catch (err) {
      this.markFailed(pi, ctx, record, record.type, errMessage(err));
    }
    return record;
  }

  private createRecord(id: string, type: string, description: string): AgentRecord {
    this.sweepExpired();
    const record: AgentRecord = {
      id,
      type,
      description,
      status: "queued",
      toolUses: 0,
      startedAt: Date.now(),
    };
    this.records.set(id, record);
    return record;
  }

  private startBackground(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    id: string,
    type: string,
    prompt: string,
    opts: SpawnOptions,
  ): void {
    const record = this.records.get(id);
    if (!record) return;
    this.runningBackground++;
    record.status = "running";
    record.startedAt = Date.now();
    emit(pi, "subagents:started", { id, type, description: record.description });
    const promise = this.executeBackground(pi, ctx, id, type, prompt, opts);
    record.promise = promise;
  }

  private async executeBackground(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    id: string,
    type: string,
    prompt: string,
    opts: SpawnOptions,
  ): Promise<string> {
    const record = this.records.get(id);
    try {
      const result = await runAgent(ctx, type, prompt, {
        agentId: id,
        model: opts.model,
        maxTurns: opts.maxTurns,
        thinkingLevel: opts.thinkingLevel,
        isolated: opts.isolated,
        inheritContext: opts.inheritContext,
        onSessionCreated: (session) => {
          if (record) record.session = session;
        },
        onToolActivity: (activity) => {
          if (record) {
            record.toolUses++;
            trackToolActivity(record.id, activity);
          }
        },
        onTextDelta: (_delta, fullText) => {
          if (record) record.result = fullText.trim();
        },
      });
      if (record) {
        record.session = result.session;
        // 后台：完成通知（resultConsumed 时 maybeNotify 内部抑制）
        this.finalize(pi, ctx, record, result, true);
      }
      return record?.result ?? "";
    } catch (err) {
      const error = errMessage(err);
      if (record) {
        this.markFailed(pi, ctx, record, type, error);
      }
      return error;
    } finally {
      this.runningBackground--;
      this.drainQueue(pi, ctx);
    }
  }

  /** 失败收尾：置 error 态 + 写 delegate-failure 证据 + 发 failed 事件（消除 5 处重复模式）。 */
  private markFailed(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    record: AgentRecord,
    type: string,
    error: string,
  ): void {
    agentActivity.delete(record.id);
    record.status = "error";
    record.error = error;
    record.completedAt = Date.now();
    const evidencePath = writeDelegateFailure(ctx.cwd, error, type);
    emit(pi, "subagents:failed", { id: record.id, type, error, evidencePath });
  }

  /**
   * 收尾：写终态 + 按 status 发正确事件 + 后台完成通知。
   * - aborted / error → subagents:failed
   * - completed → subagents:completed
   * - notify=true（后台）且结果未被取回 → maybeNotify（hold 后送达主 session）
   */
  private finalize(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    record: AgentRecord,
    result: RunResult,
    notify: boolean,
  ): void {
    agentActivity.delete(record.id);
    record.completedAt = Date.now();
    // 本次运行失败且无输出 → error（避免把上一次的文本当结果）
    if (result.failure && !result.responseText) {
      this.markFailed(pi, ctx, record, record.type, result.failure);
      if (notify) this.maybeNotify(pi, record);
      return;
    }
    record.status = result.aborted
      ? "aborted"
      : result.steered
        ? "steered"
        : "completed";
    record.result = result.responseText.trim() || "(no output)";
    const base = {
      id: record.id,
      type: record.type,
      result: record.result.slice(0, 500),
      toolUses: record.toolUses,
      durationMs: record.completedAt - record.startedAt,
      status: record.status,
    };
    if (record.status === "aborted") {
      emit(pi, "subagents:failed", { ...base, error: "aborted (turn limit exceeded)" });
    } else if (record.status === "steered") {
      emit(pi, "subagents:steered", base);
    } else {
      emit(pi, "subagents:completed", base);
    }
    if (notify) this.maybeNotify(pi, record);
  }

  private drainQueue(pi: ExtensionAPI, ctx: ExtensionContext): void {
    while (this.runningBackground < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      this.startBackground(pi, ctx, next.id, next.type, next.prompt, next.opts);
    }
  }
}

interface SpawnOptions {
  description?: string;
  model?: unknown;
  maxTurns?: number;
  thinkingLevel?: string;
  isolated?: boolean;
  inheritContext?: boolean;
  signal?: AbortSignal;
}

function emit(
  pi: ExtensionAPI,
  event: string,
  data: Record<string, unknown>,
): void {
  try {
    pi.events.emit(event, data);
  } catch {
    // 事件总线失败不影响主流程
  }
  if (event.startsWith("subagents:")) {
    refreshSubagentUI();
    ensureFooterTimer(); // 有 queued/running 时启动 80ms 持续更新（queued 无 session 也需显示）
  }
}

const registry = new AgentRegistry();
const manager = new AgentManager();

// ---------------------------------------------------------------------------
// Subagent sidebar（TUI overlay：右侧运行记录面板，/subagents 命令开关）
// ---------------------------------------------------------------------------
// 设计语言（Stitch 转译至终端）：单 accent、muted 元数据、mono 数字、
// 高密度单列列表（无卡片）、仅 running 行 spinner 微动、克制色彩、无 emoji。
const SIDEBAR_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** pi TUI theme 最小面（fg/bold；颜色名为 pi 语义色）。 */
interface SidebarTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

interface SidebarUI {
  custom<T>(
    factory: (
      tui: { requestRender(): void },
      theme: SidebarTheme,
      keybindings: unknown,
      done: (r: T | undefined) => void,
    ) => unknown,
    options?: Record<string, unknown>,
  ): Promise<T | undefined>;
  notify?(text: string, level?: "error" | "info" | "warning"): void;
  setStatus(key: string, text: string | undefined): void;
}

interface SidebarHandle {
  setHidden(hidden: boolean): void;
  hide(): void;
  isHidden(): boolean;
}

let sidebarOpen = false;
let sidebarTui: { requestRender(): void } | undefined;
let sidebarInval: (() => void) | undefined;
let sidebarHandle: SidebarHandle | undefined;
let savedUI: SidebarUI | undefined;
let spinnerFrame = 0;

/** subagent 活动变化 → fleet 列表 + 侧边栏重绘；footerTimer 驱动 spinner 帧。 */
function refreshSubagentUI(): void {
  fleetList.update();
  if (sidebarOpen) {
    sidebarInval?.();
    sidebarTui?.requestRender();
  }
}

// agentId → toolName → 正在执行的并发数（widget 活动行数据源；tool_execution_start/end 驱动）
const agentActivity = new Map<string, Map<string, number>>();

/** 记录 agent 的活跃工具（start +1 / end -1，0 移除）。 */
function trackToolActivity(
  recordId: string,
  activity: { type: "start" | "end"; toolName: string },
): void {
  let tools = agentActivity.get(recordId);
  if (!tools) {
    tools = new Map();
    agentActivity.set(recordId, tools);
  }
  const cur = tools.get(activity.toolName) ?? 0;
  if (activity.type === "start") {
    tools.set(activity.toolName, cur + 1);
  } else if (cur <= 1) {
    tools.delete(activity.toolName);
    if (tools.size === 0) agentActivity.delete(recordId);
  } else {
    tools.set(activity.toolName, cur - 1);
  }
}

const FOOTER_TICK_MS = 80;
let footerTimer: ReturnType<typeof setInterval> | undefined;
/** 有 active agent 时驱动 footer/sidebar spinner 动画（80ms = pi-subagents 同帧率 12.5fps）。 */
function ensureFooterTimer(): void {
  const active = manager
    .listAgents()
    .some((r) => r.status === "queued" || r.status === "running");
  if (active && !footerTimer) {
    footerTimer = setInterval(refreshSubagentUI, FOOTER_TICK_MS);
  } else if (!active && footerTimer) {
    clearInterval(footerTimer);
    footerTimer = undefined;
  }
}

/** 状态 glyph（无 emoji；ascii/braille）。 */
function statusGlyph(status: AgentStatus): { glyph: string; color: string } {
  switch (status) {
    case "queued":
      return { glyph: "○", color: "muted" };
    case "running":
      return { glyph: "⠋", color: "accent" };
    case "completed":
      return { glyph: "✓", color: "success" };
    case "steered":
      return { glyph: "↳", color: "muted" };
    case "aborted":
    case "error":
      return { glyph: "✗", color: "error" };
    default:
      return { glyph: "·", color: "muted" };
  }
}

function fmtDuration(ms: number | undefined): string {
  if (ms == null) return "…";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** 单行渲染（纯函数，可单测）：status | type — description | mono stats。 */
export function renderSidebarLine(record: AgentRecord, frame: number, width: number): string {
  const { glyph } = statusGlyph(record.status);
  const g = record.status === "running" ? SIDEBAR_SPINNER[frame % SIDEBAR_SPINNER.length] : glyph;
  const stats =
    record.status === "running"
      ? `${record.toolUses}t · ${fmtDuration(Date.now() - record.startedAt)}`
      : record.completedAt != null
        ? `${record.toolUses}t · ${fmtDuration(record.completedAt - record.startedAt)}`
        : "";
  const body = `${record.type} — ${record.description}`;
  return `${g} ${body} ${stats}`.trimEnd().slice(0, width);
}

/** 面板渲染：header（运行计数）+ 单列列表 + footer hint。 */
export function renderSidebar(
  records: AgentRecord[],
  frame: number,
  width: number,
  theme: SidebarTheme,
): string[] {
  const running = records.filter((r) => r.status === "running");
  const done = records
    .filter((r) => r.status !== "running" && r.status !== "queued")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 5);
  const lines: string[] = [];
  lines.push(theme.bold(`SUBAGENTS  ${running.length} running · ${records.length} total`));
  lines.push(theme.fg("dim", "─".repeat(Math.max(1, width))));
  if (records.length === 0) {
    lines.push(theme.fg("dim", "no active agents — spawn via Agent tool"));
  } else {
    for (const r of [...running, ...done]) {
      const row = renderSidebarLine(r, frame, width);
      lines.push(r.status === "running" ? theme.bold(row) : theme.fg("muted", row));
    }
  }
  lines.push(theme.fg("dim", "esc to close · /subagents to reopen"));
  return lines;
}

/** 工具名 → 人类可读动作（activity 行）。 */
const TOOL_DISPLAY: Record<string, string> = {
  read: "reading",
  bash: "running command",
  edit: "editing",
  write: "writing",
  grep: "searching",
  find: "finding files",
  ls: "listing",
};


/** 活跃工具 → 活动描述："reading, running command…"；无则回退响应文本/"thinking…"。 */

export function describeActivity(
  tools: ReadonlyMap<string, number> | undefined,
  responseText: string | undefined,
  toolDisplay: Record<string, string> = TOOL_DISPLAY,
): string {
  if (tools && tools.size > 0) {
    const groups = new Map<string, number>();
    for (const [toolName, count] of tools) {
      const action = toolDisplay[toolName] ?? toolName;
      groups.set(action, (groups.get(action) ?? 0) + count);
    }
    const parts: string[] = [];
    for (const [action, count] of groups) {
      parts.push(count > 1 ? `${action} ×${count}` : action);
    }
    return parts.join(", ") + "…";
  }
  if (responseText && responseText.trim().length > 0) {
    const line = responseText.split("\n").find((l) => l.trim())?.trim() ?? "";
    return line.length > 50 ? line.slice(0, 50) + "…" : line;
  }
  return "thinking…";
}

// ---------------------------------------------------------------------------
// FleetList + ConversationViewer（移植 pi-subagents src/ui/fleet-list.ts +
// conversation-viewer.ts：belowEditor 可导航列表，空输入框 ↓ 激活 / ↑↓ 选中 /
// Enter 打开实时对话浮层 / Esc 返回 / x 两按停止）
// ---------------------------------------------------------------------------
const FLEET_KEY = "fleet";
const MAX_AGENT_ROWS = 5;
const FLEET_TICK_MS = 200;
const FLEET_FINISHED_LINGER_MS = 4000;
const VIEWPORT_HEIGHT_PCT = 70;
const CHROME_LINES_BASE = 6;
const MIN_VIEWPORT = 3;

/** `11s` — 整数秒（Claude Code FleetView 风格）。 */
export function formatFleetElapsed(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}

/** `↓ 13.1k tokens`（保留 pi-subagents 语义；无 usage 时返回 0）。 */
export function formatFleetTokens(count: number): string {
  let compact: string;
  if (count >= 1_000_000) compact = `${(count / 1_000_000).toFixed(1)}M`;
  else if (count >= 1_000) compact = `${(count / 1_000).toFixed(1)}k`;
  else compact = `${count}`;
  return `↓ ${compact} tokens`;
}

/** 右对齐：left 截断优先保 right，最后 clamp 到 width 防换行闪烁。 */
export function rightAlign(left: string, right: string, width: number): string {
  const rightW = visibleWidth(right);
  const maxLeft = Math.max(0, width - rightW - 1);
  const leftClamped = truncateToWidth(left, maxLeft);
  const gap = Math.max(1, width - visibleWidth(leftClamped) - rightW);
  return truncateToWidth(leftClamped + " ".repeat(gap) + right, width);
}

type FleetUICtx = {
  setWidget(
    key: string,
    content:
      | undefined
      | ((
          tui: { requestRender(): void; terminal?: { rows?: number; columns?: number } },
          theme: SidebarTheme,
        ) => { render(width: number): string[]; invalidate(): void }),
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ): void;
  onTerminalInput(handler: (data: string) => { consume?: boolean; data?: string } | undefined): () => void;
  getEditorText(): string;
  notify(message: string, type?: "info" | "warning" | "error"): void;
  custom<T>(
    factory: (
      tui: { requestRender(): void; terminal?: { rows?: number; columns?: number } },
      theme: SidebarTheme,
      keybindings: unknown,
      done: (result: T | undefined) => void,
    ) => { render(width: number): string[]; invalidate(): void },
    options?: { overlay?: boolean; overlayOptions?: unknown; onHandle?: (handle: unknown) => void },
  ): Promise<T>;
};

type FleetEntry = { kind: "main" } | { kind: "agent"; record: AgentRecord };

/** 对话消息内容行渲染（纯函数，可单测）：User/Assistant/toolResult/bashExecution 分类 + 流式指示。 */
export function renderConversationLines(
  messages: ReadonlyArray<{ role?: string; content?: unknown; [k: string]: unknown }>,
  width: number,
  color: (c: string, s: string) => string,
  bold: (s: string) => string,
  extra?: { status?: string; activityText?: string },
): string[] {
  const th = { fg: color, bold };
  const lines: string[] = [];
  if (messages.length === 0) {
    lines.push(th.fg("dim", "(waiting for first message...)"));
    return lines;
  }
  let needsSeparator = false;
  for (const msg of messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
      if (!text.trim()) continue;
      if (needsSeparator) lines.push(th.fg("dim", "───"));
      lines.push(th.fg("accent", "[User]"));
      for (const line of wrapTextWithAnsi(text.trim(), width)) lines.push(line);
    } else if (msg.role === "assistant") {
      const content = Array.isArray(msg.content) ? (msg.content as Array<Record<string, unknown>>) : [];
      const textParts: string[] = [];
      const toolCalls: string[] = [];
      for (const c of content) {
        if (c.type === "text" && c.text) textParts.push(String(c.text));
        else if (c.type === "toolCall") {
          toolCalls.push(String((c as { name?: unknown }).name ?? (c as { toolName?: unknown }).toolName ?? "unknown"));
        }
      }
      if (needsSeparator) lines.push(th.fg("dim", "───"));
      lines.push(th.bold("[Assistant]"));
      if (textParts.length > 0) {
        for (const line of wrapTextWithAnsi(textParts.join("\n").trim(), width)) lines.push(line);
      }
      for (const name of toolCalls) {
        lines.push(truncateToWidth(th.fg("muted", `  [Tool: ${name}]`), width));
      }
    } else if (msg.role === "toolResult") {
      const text = extractText(msg.content);
      const truncated = text.length > 500 ? text.slice(0, 500) + "... (truncated)" : text;
      if (!truncated.trim()) continue;
      if (needsSeparator) lines.push(th.fg("dim", "───"));
      lines.push(th.fg("dim", "[Result]"));
      for (const line of wrapTextWithAnsi(truncated.trim(), width)) lines.push(th.fg("dim", line));
    } else if (msg.role === "bashExecution") {
      const bash = msg as { command?: unknown; output?: unknown };
      if (needsSeparator) lines.push(th.fg("dim", "───"));
      lines.push(truncateToWidth(th.fg("muted", `  $ ${String(bash.command ?? "")}`), width));
      const out = String(bash.output ?? "").trim();
      if (out) {
        const clipped = out.length > 500 ? out.slice(0, 500) + "... (truncated)" : out;
        for (const line of wrapTextWithAnsi(clipped, width)) lines.push(th.fg("dim", line));
      }
    } else {
      continue;
    }
    needsSeparator = true;
  }
  if (extra?.status === "running" && extra.activityText) {
    lines.push("");
    lines.push(truncateToWidth(th.fg("accent", "▍ ") + th.fg("dim", extra.activityText), width));
  }
  return lines.map((l) => truncateToWidth(l, width));
}

/** 实时对话浮层：滚动查看 agent 会话，Esc/q 关闭，x 两按停止。 */
class ConversationViewer {
  private scrollOffset = 0;
  private autoScroll = true;
  private unsubscribe: (() => void) | undefined;
  private lastInnerW = 0;
  private closed = false;
  private stopArmed = false;

  constructor(
    private tui: { requestRender(): void; terminal?: { rows?: number } },
    private session: { subscribe?(listener: () => void): () => void; messages?: unknown[] },
    private record: AgentRecord,
    private activityText: string | undefined,
    private theme: SidebarTheme,
    private done: (result: undefined) => void,
    private onStop?: () => void,
  ) {
    this.unsubscribe = session.subscribe?.(() => {
      if (this.closed) return;
      this.tui.requestRender();
    });
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
      this.closed = true;
      this.done(undefined);
      return;
    }
    if (matchesKey(data, "x")) {
      if (this.record.status === "running" || this.record.status === "queued") {
        if (this.stopArmed) {
          this.stopArmed = false;
          this.onStop?.();
        } else {
          this.stopArmed = true;
        }
        this.tui.requestRender();
      }
      return;
    }
    if (this.stopArmed) this.stopArmed = false;

    const totalLines = this.buildContentLines(this.lastInnerW).length;
    const viewportHeight = this.viewportHeight();
    const maxScroll = Math.max(0, totalLines - viewportHeight);
    const scrollUp = (d: string) => matchesKey(d, "up") || matchesKey(d, "k");
    const scrollDown = (d: string) => matchesKey(d, "down") || matchesKey(d, "j");
    if (scrollUp(data)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (scrollDown(data)) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "pageUp") || matchesKey(data, "shift+up")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - viewportHeight);
      this.autoScroll = false;
    } else if (matchesKey(data, "pageDown") || matchesKey(data, "shift+down")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + viewportHeight);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "home")) {
      this.scrollOffset = 0;
      this.autoScroll = false;
    } else if (matchesKey(data, "end")) {
      this.scrollOffset = maxScroll;
      this.autoScroll = true;
    }
  }

  render(width: number): string[] {
    if (width < 6) return [];
    const th = this.theme;
    const innerW = width - 4;
    this.lastInnerW = innerW;
    const lines: string[] = [];
    const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - visibleWidth(s)));
    const row = (content: string) =>
      th.fg("border", "│") + " " + truncateToWidth(pad(content, innerW), innerW, "...", true) + " " + th.fg("border", "│");
    const hrTop = th.fg("border", `╭${"─".repeat(width - 2)}╮`);
    const hrBot = th.fg("border", `╰${"─".repeat(width - 2)}╯`);
    const hrMid = row(th.fg("dim", "─".repeat(innerW)));

    lines.push(hrTop);
    const name = this.record.type.replace("aiws-", "");
    const statusIcon =
      this.record.status === "running"
        ? th.fg("accent", "●")
        : this.record.status === "completed"
          ? th.fg("success", "✓")
          : this.record.status === "error"
            ? th.fg("error", "✗")
            : th.fg("dim", "○");
    const duration = fmtDuration(
      this.record.completedAt != null ? this.record.completedAt - this.record.startedAt : Date.now() - this.record.startedAt,
    );
    const headerParts: string[] = [duration];
    if (this.record.toolUses > 0) headerParts.unshift(`${this.record.toolUses} tool${this.record.toolUses === 1 ? "" : "s"}`);
    lines.push(
      row(
        `${statusIcon} ${th.bold(name)}  ${th.fg("muted", this.record.description)} ${th.fg("dim", "·")} ${th.fg("dim", headerParts.join(" · "))}`,
      ),
    );
    lines.push(hrMid);

    const contentLines = this.buildContentLines(innerW);
    const viewportHeight = this.viewportHeight();
    const maxScroll = Math.max(0, contentLines.length - viewportHeight);
    if (this.autoScroll) this.scrollOffset = maxScroll;
    const visibleStart = Math.min(this.scrollOffset, maxScroll);
    const visible = contentLines.slice(visibleStart, visibleStart + viewportHeight);
    for (let i = 0; i < viewportHeight; i++) lines.push(row(visible[i] ?? ""));

    lines.push(hrMid);
    const sep = th.fg("dim", " · ");
    const actions: string[] = [];
    if (this.record.status === "running" || this.record.status === "queued") {
      actions.push(this.stopArmed ? th.fg("error", "x again to STOP") : th.fg("dim", "x stop"));
    }
    const footerRight = th.fg("dim", "↑↓ scroll · PgUp/PgDn · Esc close");
    const scrollPct =
      contentLines.length <= viewportHeight
        ? "100%"
        : `${Math.round(((visibleStart + viewportHeight) / contentLines.length) * 100)}%`;
    const count = th.fg("dim", `${contentLines.length} lines · ${scrollPct}`);
    const footerLeft = [count, ...actions].join(sep);
    const footerGap = Math.max(1, innerW - visibleWidth(footerLeft) - visibleWidth(footerRight));
    lines.push(row(footerLeft + " ".repeat(footerGap) + footerRight));
    lines.push(hrBot);
    return lines;
  }

  invalidate(): void {}

  dispose(): void {
    this.closed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  private viewportHeight(): number {
    const maxRows = Math.floor(((this.tui.terminal?.rows ?? 40) * VIEWPORT_HEIGHT_PCT) / 100);
    return Math.max(MIN_VIEWPORT, maxRows - CHROME_LINES_BASE);
  }

  private buildContentLines(width: number): string[] {
    const messages = (this.session.messages ?? []) as ReadonlyArray<{ role?: string; content?: unknown }>;
    return renderConversationLines(messages, width, (c, s) => this.theme.fg(c, s), (s) => this.theme.bold(s), {
      status: this.record.status,
      activityText: this.activityText,
    });
  }
}

/** belowEditor 可导航 agent 列表（pi-subagents FleetList 精简移植）。 */
export class FleetList {
  private ui: FleetUICtx | undefined;
  private tui: { requestRender(): void; terminal?: { rows?: number; columns?: number } } | undefined;
  private inputUnsub: (() => void) | undefined;
  private widgetRegistered = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private active = false;
  private selectedIndex = 0;
  private viewerClose: (() => void) | undefined;
  private viewingAgentId: string | undefined;

  constructor(private managerRef: AgentManager) {}

  setUICtx(ui: FleetUICtx): void {
    if (ui === this.ui) return;
    this.inputUnsub?.();
    this.ui = ui;
    this.widgetRegistered = false;
    this.tui = undefined;
    this.inputUnsub = ui.onTerminalInput((data) => this.handleKey(data));
    // 自驱动：ui 就绪即开始轮询，有记录自动注册/刷新，不依赖外部 update 触发
    this.ensureTimer();
  }

  ensureTimer(): void {
    if (!this.timer) this.timer = setInterval(() => this.update(), FLEET_TICK_MS);
  }

  update(): void {
    if (!this.ui) return;
    const records = this.agentRecords();
    if (records.length === 0) {
      if (this.widgetRegistered) {
        this.ui.setWidget(FLEET_KEY, undefined);
        this.widgetRegistered = false;
        this.tui = undefined;
      }
      this.active = false;
      this.selectedIndex = 0;
      return; // 不停 timer：自驱动轮询等待新记录
    }
    this.clampSelection();
    this.ensureTimer();
    // 每次重建 widget：setWidget 内部 renderWidgets() 自带 requestRender → 实时刷新
    // （setWidget factory 的 tui 实参是 ui（无 requestRender），不能依赖 this.tui?.requestRender）
    this.ui.setWidget(
      FLEET_KEY,
      (tui, theme) => {
        this.tui = tui;
        return {
          render: (w: number) => this.renderBar(w, theme),
          invalidate: () => {
            this.widgetRegistered = false;
            this.tui = undefined;
          },
        };
      },
      { placement: "belowEditor" },
    );
    this.widgetRegistered = true;
  }

  private agentRecords(): AgentRecord[] {
    const now = Date.now();
    return this.managerRef
      .listAgents()
      .filter(
        (a) =>
          a.status === "queued" ||
          (a.status === "running" && a.session) ||
          a.id === this.viewingAgentId ||
          (a.completedAt != null && now - a.completedAt < FLEET_FINISHED_LINGER_MS),
      )
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  private roster(): FleetEntry[] {
    return [{ kind: "main" }, ...this.agentRecords().map((record) => ({ kind: "agent" as const, record }))];
  }

  private clampSelection(): void {
    const max = this.roster().length - 1;
    if (this.selectedIndex > max) this.selectedIndex = Math.max(0, max);
    if (this.selectedIndex < 0) this.selectedIndex = 0;
  }

  /** 返回 {consume:true} 吞掉按键；undefined 放行到编辑器。 */
  handleKey(data: string): { consume?: boolean; data?: string } | undefined {
    if (!this.ui) return undefined;
    if (isKeyRelease(data)) return undefined;
    if (this.viewerClose) return undefined;
    if (!this.editorHasFocus()) {
      if (this.active) this.deactivate();
      return undefined;
    }
    if (!this.active) {
      const isActivator = matchesKey(data, "down") || matchesKey(data, "left");
      if (isActivator && this.agentRecords().length > 0 && this.ui.getEditorText() === "") {
        this.active = true;
        this.selectedIndex = 0;
        this.update();
        return { consume: true };
      }
      return undefined;
    }
    if (matchesKey(data, "down")) {
      const max = this.roster().length - 1;
      this.selectedIndex = Math.min(max, this.selectedIndex + 1);
      this.update();
      return { consume: true };
    }
    if (matchesKey(data, "up")) {
      if (this.selectedIndex === 0) {
        this.deactivate();
        return { consume: true };
      }
      this.selectedIndex -= 1;
      this.update();
      return { consume: true };
    }
    if (matchesKey(data, "escape")) {
      this.deactivate();
      return { consume: true };
    }
    if (matchesKey(data, Key.enter)) {
      this.openSelected();
      return { consume: true };
    }
    this.deactivate();
    return undefined;
  }

  private editorHasFocus(): boolean {
    const focused = (this.tui as { focusedComponent?: unknown } | undefined)?.focusedComponent;
    return focused == null || focused instanceof Editor;
  }

  private deactivate(): void {
    this.active = false;
    this.selectedIndex = 0;
    this.update();
  }

  private openSelected(): void {
    const entry = this.roster()[this.selectedIndex];
    if (!entry || entry.kind === "main") {
      this.deactivate();
      return;
    }
    const record = entry.record;
    if (!this.ui) return;
    if (!record.session) {
      this.ui.notify(`Agent is ${record.status} — no session available.`, "info");
      return;
    }
    this.viewingAgentId = record.id;
    const activityText = describeActivity(agentActivity.get(record.id), record.result);
    void this.ui
      .custom<undefined>(
        (tui, theme, _keybindings, done) => {
          this.viewerClose = () => done(undefined);
          return new ConversationViewer(
            tui,
            record.session as { subscribe?(l: () => void): () => void; messages?: unknown[] },
            record,
            activityText,
            theme,
            done,
            () => {
              if (this.managerRef.abort(record.id)) this.ui?.notify(`Stopped "${record.description}".`, "info");
            },
          );
        },
        { overlay: true, overlayOptions: { anchor: "center", width: "90%", maxHeight: `${VIEWPORT_HEIGHT_PCT}%` } },
      )
      .then(() => this.clearViewer(), () => this.clearViewer());
  }

  private clearViewer(): void {
    if (this.viewingAgentId) {
      const idx = this.roster().findIndex((e) => e.kind === "agent" && e.record.id === this.viewingAgentId);
      if (idx >= 0) this.selectedIndex = idx;
    }
    this.viewerClose = undefined;
    this.viewingAgentId = undefined;
    this.update();
  }

  private renderBar(width: number, theme: SidebarTheme): string[] {
    const agents = this.roster().slice(1) as { kind: "agent"; record: AgentRecord }[];
    if (agents.length === 0) return [];
    const sel = Math.min(this.selectedIndex, agents.length);
    const hint = this.active ? "↑↓ select · enter view · esc back" : "esc to interrupt · ← for agents · ↓ to manage";
    const lines: string[] = [];
    lines.push(truncateToWidth("  " + theme.fg("dim", hint), width));
    lines.push("");
    lines.push(truncateToWidth(`  ${this.bullet(0, sel, theme)} main`, width));
    const visible = Math.min(MAX_AGENT_ROWS, agents.length);
    const selAgent = Math.max(0, sel - 1);
    const start = selAgent < visible ? 0 : selAgent - visible + 1;
    const hiddenBelow = agents.length - (start + visible);
    if (start > 0) lines.push(rightAlign("", theme.fg("dim", `↑ ${start} more`), width));
    for (let a = start; a < start + visible; a++) {
      lines.push(this.renderAgentRow(a + 1, sel, agents[a].record, width, theme));
    }
    if (hiddenBelow > 0) lines.push(rightAlign("", theme.fg("dim", `↓ ${hiddenBelow} more`), width));
    return lines;
  }

  private bullet(rosterIndex: number, sel: number, theme: SidebarTheme): string {
    return rosterIndex === sel ? theme.fg("accent", "●") : theme.fg("dim", "○");
  }

  private renderAgentRow(rosterIndex: number, sel: number, record: AgentRecord, width: number, theme: SidebarTheme): string {
    let left = `  ${this.bullet(rosterIndex, sel, theme)} ${theme.fg("muted", record.type.replace("aiws-", ""))}  ${record.description}`;
    if (record.status === "running") {
      const act = describeActivity(agentActivity.get(record.id), record.result);
      left += "  " + theme.fg("syntaxType", act);
    }
    const elapsedMs = (record.completedAt ?? Date.now()) - record.startedAt;
    const right = theme.fg("dim", `${formatFleetElapsed(elapsedMs)} · ↓ ${record.toolUses}t`);
    return rightAlign(left, right, width);
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.inputUnsub?.();
    this.inputUnsub = undefined;
    if (this.viewerClose) {
      this.viewerClose();
      this.viewerClose = undefined;
    }
    this.viewingAgentId = undefined;
    if (this.ui && this.widgetRegistered) this.ui.setWidget(FLEET_KEY, undefined);
    this.widgetRegistered = false;
    this.tui = undefined;
    this.active = false;
    this.ui = undefined;
  }
}

const fleetList = new FleetList(manager);

// ---------------------------------------------------------------------------
// 自定义 footer（显眼版）：去掉 pwd（tmux 状态栏已显示 pwd），
// agent 状态 accent + spinner、模型 accent bold、上下文三态。
// 数据源：ctx.model / ctx.getContextUsage() / ctx.sessionManager.getEntries()。
// ---------------------------------------------------------------------------
/** 与 pi 内置 footer 一致的 token 格式化（保留语义）。 */
export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

type PhaseUsage = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: number | { total?: number };
};
export type UsageTotals = Required<Omit<PhaseUsage, "cost">> & { cost: number };

/** 遍历 session entries 汇总 token/成本（与内置 footer 同源：message.usage / entry.usage）。 */
export function collectUsageTotals(
  entries: ReadonlyArray<{ message?: { role?: string; usage?: PhaseUsage }; usage?: PhaseUsage }>,
): { totals: UsageTotals; latestCacheHitRate?: number } {
  const totals: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  let latestCacheHitRate: number | undefined;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  for (const entry of entries) {
    const u0 = entry.message?.usage ?? entry.usage;
    if (!u0) continue;
    totals.input += num(u0.input);
    totals.output += num(u0.output);
    totals.cacheRead += num(u0.cacheRead);
    totals.cacheWrite += num(u0.cacheWrite);
    // pi usage.cost 是 { total: number } 对象（usage-totals.js: totals.cost += usage.cost.total）；
    // 也兼容 number 直传。
    const rawCost = u0.cost;
    const costNum = typeof rawCost === "number" ? rawCost : (rawCost as { total?: unknown } | undefined)?.total;
    totals.cost += num(costNum);
    if (entry.message?.role === "assistant") {
      const prompt = num(u0.input) + num(u0.cacheRead) + num(u0.cacheWrite);
      const rate = prompt > 0 ? (num(u0.cacheRead) / prompt) * 100 : undefined;
      if (rate !== undefined) latestCacheHitRate = rate;
    }
  }
  return { totals, latestCacheHitRate };
}

/** 组装统计段 `↑x ↓y Rz Ww $0.012`。 */
export function formatUsageStats(
  totals: UsageTotals,
  latestCacheHitRate: number | undefined,
  includeCost: boolean,
): string {
  const parts: string[] = [];
  if (totals.input) parts.push(`↑${formatTokens(totals.input)}`);
  if (totals.output) parts.push(`↓${formatTokens(totals.output)}`);
  if (totals.cacheRead) parts.push(`R${formatTokens(totals.cacheRead)}`);
  if (totals.cacheWrite) parts.push(`W${formatTokens(totals.cacheWrite)}`);
  if ((totals.cacheRead > 0 || totals.cacheWrite > 0) && latestCacheHitRate !== undefined) {
    parts.push(`CH${latestCacheHitRate.toFixed(1)}%`);
  }
  if (totals.cost || includeCost) {
    parts.push(`$${totals.cost.toFixed(3)}${includeCost ? " (sub)" : ""}`);
  }
  return parts.join(" ");
}

type AiusFooterCtx = {
  model?: { id?: string; provider?: string } | undefined;
  getContextUsage?(): { percent?: number | null; contextWindow?: number } | undefined;
  thinkingLevel?: string | undefined;
  isIdle?(): boolean;
  sessionManager?: { getEntries?(): ReadonlyArray<unknown> };
  ui?: { setStatus?(key: string, text: string | undefined): void; setFooter?(factory: unknown): void };
};

/** setFooter 工厂第三个参数（ReadonlyFooterDataProvider 最小面）。 */
type AiusFooterData = {
  getAvailableProviderCount(): number;
  getExtensionStatuses(): ReadonlyMap<string, string>;
};

let footerCtx: AiusFooterCtx | undefined;
let footerInstalled = false;

/** 记录 ExtensionContext（供 footer 渲染实时读数据）；首次捕获时安装自定义 footer。 */
function captureCtx(ctx: AiusFooterCtx): void {
  footerCtx = ctx;
  if (!footerInstalled && ctx.ui?.setFooter) {
    footerInstalled = true;
    try {
      installAiusFooter((factory) => (ctx.ui as { setFooter(f: unknown): void }).setFooter(factory));
    } catch (err) {
      footerInstalled = false;
      console.warn("[aiws-subagents] footer install failed:", errMessage(err));
    }
  }
}

/**
 * 注册显眼版 footer（TUI 模式）：去掉 pwd，accent agent 状态 + accent bold 模型 +
 * 上下文三态 + token 统计 + 其它扩展状态。闭包实时读 footerCtx。
 */
function installAiusFooter(
  setFooter: (
    factory:
      | ((ui: unknown, theme: SidebarTheme, footerData: AiusFooterData) => {
          render(width: number): string[];
          dispose?(): void;
        })
      | undefined,
  ) => void,
): void {
  setFooter((ui, theme, footerData) => ({
    render(width: number) {
      try {
        return renderFooterOnce(theme, footerData, width);
      } catch (err) {
        // footer 渲染异常不得杀死 pi：warn + 返回空行（不再 setFooter(undefined) ——
        // 那会触发 pi 的 dispose → 递归卸载死循环）
        console.warn("[aiws-subagents] footer render failed, showing blank footer:", errMessage(err));
        return [];
      }
    },
    // 不定义 dispose：pi setExtensionFooter 卸载时会先调 customFooter.dispose()，
    // 若此处再 setFooter(undefined) 会无限递归（此前 reload 崩溃根因）。
  }));
}

/** 单次 footer 渲染（被 render 的 try/catch 包裹，可独立单测思路）。 */
function renderFooterOnce(theme: SidebarTheme, footerData: AiusFooterData, width: number): string[] {
  const ctx = footerCtx;
  if (!ctx) return [];
      if (!ctx) return [];
      const model = ctx.model;
      const usage = ctx.getContextUsage?.();
      const entries = ctx.sessionManager?.getEntries?.() ?? [];
      const { totals, latestCacheHitRate } = collectUsageTotals(
        entries as ReadonlyArray<
          { message?: { role?: string; usage?: PhaseUsage }; usage?: PhaseUsage }
        >,
      );
      const usingSubscription = model?.provider === "kimi-coding";
      const statsStr = formatUsageStats(totals, latestCacheHitRate, usingSubscription);
      const contextPercent = usage?.percent ?? null;
      const contextWindow = usage?.contextWindow ?? 0;
      const contextDisplay =
        usage?.percent != null
          ? `${usage.percent.toFixed(1)}%/${formatTokens(contextWindow)}`
          : contextWindow > 0
            ? `?/${formatTokens(contextWindow)}`
            : "";
      const providerCount = footerData.getAvailableProviderCount();
      const providerPrefix =
        providerCount > 1 && model?.provider ? `(${model.provider}) ` : undefined;
      const extStatuses = Array.from(footerData.getExtensionStatuses().entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .filter(([key]) => key !== "aiws")
        .map(([, text]) => text)
        .filter((s) => s.length > 0);
      const color = (c: string, s: string) => theme.fg(c, s);
  return renderAiusFooter(
    {
      records: manager.listAgents(),
      frame: spinnerFrame,
      modelName: model?.id,
      providerPrefix,
      thinking: ctx.thinkingLevel,
      statsStr,
      contextDisplay,
      contextPercent,
      extStatuses,
      idle: ctx.isIdle?.() ?? true,
    },
    color,
    width,
  );
}

/**
 * 显眼版 footer 渲染（纯函数，可单测）：
 *   ⠋ 2 running · anthropic/claude-sonnet-4 • thinking high   ↑12.3k ↓45k $0.012 42%/200k
 * 第 2 行为其它扩展状态（有才显示）。无 agent 且无会话数据时不显示第 1 行。
 */
export function renderAiusFooter(
  data: {
    records: AgentRecord[];
    frame: number;
    modelName: string | undefined;
    providerPrefix: string | undefined;
    thinking: string | undefined;
    statsStr: string;
    contextDisplay: string;
    contextPercent: number | null;
    extStatuses: string[];
    idle: boolean;
  },
  color: (c: string, s: string) => string = (_, s) => s,
  width = 120,
): string[] {
  const active = data.records.filter(
    (r) => r.status === "queued" || r.status === "running",
  );
  const spinner = SIDEBAR_SPINNER[data.frame % SIDEBAR_SPINNER.length];
  const sep = color("borderMuted", "·");
  const parts: string[] = [];
  // Stitch 转译配色（Obsidian Control 理念：低饱和克制、三类信息三色区分）
  //  身份（模型名）→ 蓝 syntaxKeyword · 活动（agent 运行）→ 青绿 syntaxType
  //  警示（working/上下文超限）→ warning/error · 次要 → 灰阶 dim/muted
  if (active.length > 0) {
    const runningCount = active.filter((r) => r.status === "running").length;
    const queuedCount = active.length - runningCount;
    const label =
      queuedCount > 0
        ? `${spinner} ${runningCount} running, ${queuedCount} queued`
        : `${spinner} ${active.length} running`;
    parts.push(color("syntaxType", label));
  }
  if (!data.idle) parts.push(color("warning", "● working"));
  if (data.modelName) {
    const thinking = data.thinking && data.thinking !== "off" ? ` • ${data.thinking}` : "";
    const modelLine = `${data.providerPrefix ?? ""}${data.modelName}${thinking}`;
    parts.push(color("syntaxKeyword", modelLine));
  }
  if (data.statsStr) parts.push(color("dim", data.statsStr));
  if (data.contextDisplay) {
    const ctxColor =
      data.contextPercent !== null && data.contextPercent > 90
        ? "error"
        : data.contextPercent !== null && data.contextPercent > 70
          ? "warning"
          : "muted";
    parts.push(color(ctxColor, data.contextDisplay));
  }
  const lines: string[] = [];
  if (parts.length > 0) lines.push(truncateToWidth(parts.join(`  ${sep}  `), width));
  if (data.extStatuses.length > 0) {
    lines.push(truncateToWidth(data.extStatuses.join("  "), width, "…"));
  }
  return lines;
}

/** 打开（或重新显示）右侧 sidebar overlay；nonCapturing 不抢键盘。 */
async function openSubagentSidebar(ui: SidebarUI): Promise<void> {
  if (sidebarHandle) {
    sidebarHandle.setHidden(false);
    sidebarOpen = true;
    refreshSubagentUI();
    return;
  }
  sidebarOpen = true;
  try {
    await ui.custom<undefined>(
      (tui, theme, _keybindings, done) => {
        sidebarTui = tui;
        const component = {
          render: (width: number) => renderSidebar(manager.listAgents(), spinnerFrame, width, theme),
          handleInput: (data: string) => {
            if (matchesKey(data, Key.escape)) {
              sidebarHandle?.hide();
              done(undefined);
            }
          },
          invalidate: () => {},
        };
        sidebarInval = () => component.invalidate();
        return component;
      },
      {
        overlay: true,
        overlayOptions: () => ({
          anchor: "right-center",
          width: "40%",
          minWidth: 40,
          maxHeight: "80%",
          margin: { top: 1, right: 1 },
          nonCapturing: true,
          visible: (w: number) => w >= 60,
        }),
        onHandle: (h: SidebarHandle) => {
          sidebarHandle = h;
        },
      },
    );
  } catch (err) {
    console.error("[aiws-subagents] sidebar open failed:", err);
    ui.notify?.(`subagent sidebar failed: ${errMessage(err)}`, "error");
  } finally {
    // 无论正常关闭（done）还是失败，都清理状态，保证下次 toggle 可用
    sidebarOpen = false;
    sidebarTui = undefined;
    sidebarInval = undefined;
    sidebarHandle = undefined;
  }
}

// ---------------------------------------------------------------------------
// Tools（扩展入口）
// ---------------------------------------------------------------------------

export default function setup(pi: ExtensionAPI): void {
  // ---- setup gate：扩展 Agent 工具默认停用（deprecated 兼容层）----
  // 统一派发路径 = `aiws change tasks execute`（默认 strategy=tmux，TmuxSessionSpawner 独立
  // tmux 会话；tmux 不可用时自动降级 l1）。扩展 Agent 工具
  // （Agent / get_subagent_result / steer_subagent）保留代码但默认不注册；
  // 显式设置环境变量 AIWS_EXT_AGENT_ENABLED=1 才注册（兼容层）。
  if (process.env.AIWS_EXT_AGENT_ENABLED !== "1") {
    // 默认停用（静默，避免每次启动打横幅）：扩展 Agent 工具不注册。
    // 派发策略见 subagent.prompt.md / <aiws-pi-force-policy> prompt block：
    //   aiws change tasks execute --strategy tmux（默认；tmux 不可用自动降级 l1）。
    return;
  }
  console.warn(
    "[aiws-subagents] deprecated 兼容层已启用（AIWS_EXT_AGENT_ENABLED=1）：Agent / get_subagent_result / steer_subagent 仍注册，但将被移除；请改用 `aiws change tasks execute --strategy tmux`。",
  );

  const typeList = registry.getAvailableTypes();
  const availableTypes =
    typeList.length > 0
      ? typeList.join(", ")
      : "(none — add .md under .pi/agents/ or .agents/agents/)";

  // footer/widget 启动即装：session_start（reason=startup）在会话启动时触发，
  // handler 带 ExtensionContext（runner.js emit → createContext）→ 立即捕获 ctx 安装
  // 自定义 footer，无需等用户发第一条消息（turn_start）。turn_start 保留兜底。
  pi.on("session_start", (_event, ctx) => {
    captureCtx(ctx as unknown as AiusFooterCtx);
    fleetList.setUICtx(ctx.ui as FleetUICtx);
  });
  pi.on("turn_start", (_event, ctx) => {
    captureCtx(ctx as unknown as AiusFooterCtx);
    fleetList.setUICtx(ctx.ui as FleetUICtx);
  });
  // pi-subagents 同款驱动：每次主会话工具执行都刷新 UI ctx + 运行记录
  // （派发 agent 后立即更新，不依赖消息/事件时序；setUICtx 同引用时幂等）
  pi.on("tool_execution_start", (_event, ctx) => {
    fleetList.setUICtx(ctx.ui as FleetUICtx);
    fleetList.update();
  });

  // ---- Agent tool ----
  pi.registerTool(
    defineTool({
      name: SUBAGENT_TOOL_NAMES.AGENT,
      label: "Agent",
      description:
        "Launch an autonomous sub-agent for complex multi-step tasks. AIWS force policy: only aiws-worker / aiws-reviewer types are allowed; unknown types are rejected (no fallback).\n\n" +
        `Available types: ${availableTypes}\n` +
        "Custom agents are loaded from .pi/agents/*.md (project), .agents/agents/*.md (workspace), and the global agents directory.",
      promptSnippet: "Launch autonomous sub-agents for complex multi-step tasks",
      promptGuidelines: [
        "Use Agent with an AIWS type (aiws-worker for implementation, aiws-reviewer for review); this extension remains a deprecated compatibility layer and default dispatch stays on tmux.",
         "For visual work, use an independent tmux Pi worker with an explicit aipper/qwen3 or aipper/gpt-5.5 model, pass paths only, and require summary/structured result/done.signal; failures are BLOCKED.",
         "explorer/read-only may run in parallel; code, test, or shared-file writes must be serial or isolated by branch/write set.",
        "Always include a short (3-5 word) description summarizing the task.",
        "Foreground (default) blocks until done; use run_in_background: true for parallel work and retrieve via get_subagent_result.",
        "Trust but verify: check actual changes before reporting delegated work as done.",
      ],
      parameters: Type.Object({
        prompt: Type.String({
          description: "The task for the agent to perform.",
        }),
        description: Type.String({
          description: "A short (3-5 word) description of the task (shown in UI/records).",
        }),
        subagent_type: Type.String({
          description: `The agent type to use. Available: ${availableTypes}.`,
        }),
        model: Type.Optional(
          Type.String({
            description:
              'Optional model override as "provider/modelId" (e.g. "anthropic/claude-sonnet-4"). Omit to use the agent type\'s default.',
          }),
        ),
        thinking: Type.Optional(
          Type.String({
            description: "Thinking level override (e.g. low/medium/high). Overrides agent default.",
          }),
        ),
        max_turns: Type.Optional(
          Type.Number({
            description: "Maximum number of agentic turns before stopping. Omit for unlimited (default).",
            minimum: 1,
          }),
        ),
        run_in_background: Type.Optional(
          Type.Boolean({
            description:
              "Set to true to run in background. Returns an agent ID immediately; retrieve via get_subagent_result.",
          }),
        ),
        resume: Type.Optional(
          Type.String({
            description: "Optional agent ID to resume from. Continues from previous context.",
          }),
        ),
        isolated: Type.Optional(
          Type.Boolean({
            description: "If true, the agent gets no extension/MCP tools — only built-in tools.",
          }),
        ),
        inherit_context: Type.Optional(
          Type.Boolean({
            description: "If true, fork the parent conversation into the agent. Default: false.",
          }),
        ),
        isolation: Type.Optional(
          Type.Literal("worktree", {
            description: "Worktree isolation is NOT implemented in v1; passing this returns an error.",
          }),
        ),
      }),
      execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
        // 保存 UI 上下文（供 sidebar 后续打开；TUI 会话才有真实 overlay）
        savedUI = ctx.ui as SidebarUI;
        captureCtx(ctx as unknown as AiusFooterCtx);
        fleetList.setUICtx(ctx.ui as FleetUICtx);
        try {
          // 每次调用重载配置，新 .md 无需重启
          registry.reload(ctx.cwd);

          // ── 1. 未知 type → 拒绝（不 fallback）──
          const resolvedType = registry.resolveType(params.subagent_type);
          if (!resolvedType) {
            return textResult(
              `拒绝派发 subagent_type="${params.subagent_type}"：未知 agent type（不在 .pi/agents/、.agents/agents/ 或全局 agents 目录）。` +
                "不 fallback 到默认 agent。可用 type: aiws-worker, aiws-reviewer。",
            );
          }
          const config = registry.getConfig(resolvedType);
          if (!config) {
            return textResult(
              `拒绝派发 subagent_type="${resolvedType}"：agent 已禁用（enabled: false）或不可用。`,
            );
          }

          // ── 2. force policy 门禁（spawn 前，最优先）──
          const decision = policy.decideAgentType(resolvedType);
          if (!decision.allow) {
            return textResult(
              `拒绝派发 subagent_type="${resolvedType}"（force policy）：${decision.reason} (${decision.code})。\n` +
                "AIWS type 白名单：aiws-worker | aiws-reviewer。",
            );
          }

          // ── 3. 调用配置：frontmatter > 工具参数（invocation-config.ts）──
          if (params.isolation === "worktree" || config.isolation === "worktree") {
            return textResult(
              'isolation: "worktree" 未在 v1 实现。请去掉 isolation 参数后重试。',
            );
          }
          const { maxTurns, runInBackground, inheritContext, isolated, thinkingLevel, modelInput } =
            resolveInvocationConfig(config, params);
          // 模型：config.model > params.model > 父模型；显式 model 解析失败 → 硬拒绝（不静默回退，不把错误文案当 model 传入）
          let model: unknown = ctx.model;
          if (modelInput) {
            const resolved = resolveModel(modelInput, ctx.modelRegistry);
            if (!resolved.ok) {
              return textResult(`拒绝派发 subagent_type="${resolvedType}"：${resolved.error}`);
            }
            model = resolved.model;
          }

          const opts: SpawnOptions = {
            description: params.description,
            model,
            maxTurns,
            thinkingLevel,
            isolated,
            inheritContext,
            signal,
          };

          // ── 4. resume 路径 ──
          if (params.resume) {
            const existing = manager.getRecord(params.resume);
            if (!existing) {
              return textResult(`Agent not found: "${params.resume}".`);
            }
            if (!existing.session) {
              return textResult(`Agent "${params.resume}" has no active session to resume.`);
            }
            if (existing.status === "running") {
              return textResult(`Agent "${params.resume}" is currently running; cannot resume until it settles.`);
            }
            const record = await manager.resume(pi, ctx, params.resume, params.prompt);
            if (!record) return textResult(`Failed to resume agent "${params.resume}".`);
            if (record.status === "error") {
              return textResult(
                `Agent failed: ${record.error}${record.result ? `\n\nPartial output:\n${record.result}` : ""}`,
                { status: "error", agentId: record.id, error: record.error },
              );
            }
            return textResult(record.result?.trim() || "No output.", {
              status: "completed",
              agentId: record.id,
              type: record.type,
              description: record.description,
            });
          }

          // ── 5. 后台派发 ──
          if (runInBackground) {
            const id = manager.spawnBackground(pi, ctx, resolvedType, params.prompt, opts);
            // 后台派发 → footer 状态行实时显示（不自动弹浮层，避免遮挡输出；
            // 需要完整记录时用 /subagents 手动打开右侧详情）
            refreshSubagentUI();
            const record = manager.getRecord(id);
            const isQueued = record?.status === "queued";
            return textResult(
              `Agent ${isQueued ? "queued" : "started"} in background.\n` +
                `Agent ID: ${id}\n` +
                `Type: ${resolvedType}\n` +
                `Description: ${params.description}\n` +
                (isQueued ? `Position: queued (max ${manager.getMaxConcurrent()} concurrent)\n` : "") +
                `\nYou will be notified when this agent completes.\n` +
                `Use get_subagent_result to retrieve results, or steer_subagent to send it messages.`,
              { status: "background", agentId: id, type: resolvedType, description: params.description },
            );
          }

          // ── 6. 前台阻断式 ──
          const record = await manager.spawnForeground(pi, ctx, resolvedType, params.prompt, opts);
          if (record.status === "error") {
            return textResult(
              `Agent failed: ${record.error}${record.result ? `\n\nPartial output:\n${record.result}` : ""}`,
              { status: "error", agentId: record.id, error: record.error },
            );
          }
          const durationMs = (record.completedAt ?? Date.now()) - record.startedAt;
          const statusNote =
            record.status === "steered"
              ? " (wrapped up at turn limit)"
              : record.status === "aborted"
                ? " (aborted — turn limit exceeded)"
                : "";
          return textResult(
            `Agent completed in ${Math.round(durationMs / 1000)}s (${record.toolUses} tool uses)${statusNote}.\n\n` +
              (record.result?.trim() || "No output."),
            {
              status: record.status,
              agentId: record.id,
              type: resolvedType,
              description: params.description,
              toolUses: record.toolUses,
              durationMs,
            },
          );
        } catch (err) {
          const error = errMessage(err);
          const evidencePath = writeDelegateFailure(ctx.cwd, error, params.subagent_type);
          return textResult(
            `Agent error: ${error}${evidencePath ? `\nDelegate failure evidence written to ${evidencePath}. STOP: do not silently implement business code in main session.` : ""}`,
          );
        }
      },
    }),
  );

  // ---- get_subagent_result tool ----
  pi.registerTool(
    defineTool({
      name: SUBAGENT_TOOL_NAMES.GET_RESULT,
      label: "Get Agent Result",
      description:
        "Check status and retrieve results from a background agent. Use the agent ID returned by Agent with run_in_background.",
      promptSnippet: "Check status and retrieve results from a background agent",
      parameters: Type.Object({
        agent_id: Type.String({
          description: "The agent ID to check.",
        }),
        verbose: Type.Optional(
          Type.Boolean({
            description: "If true, include the agent's full conversation (messages + tool calls). Default: false.",
          }),
        ),
      }),
      execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
        const record = manager.getRecord(params.agent_id);
        if (!record) {
          return textResult(`Agent not found: "${params.agent_id}". 结果已被取走（get_subagent_result 已消费并逐出）或记录已超时清理。`);
        }
        const duration = record.completedAt
          ? `${Math.round((record.completedAt - record.startedAt) / 1000)}s`
          : "—";
        let output =
          `Agent: ${record.id}\n` +
          `Type: ${record.type} | Status: ${record.status} | Tool uses: ${record.toolUses} | Duration: ${duration}\n` +
          `Description: ${record.description}\n\n`;

        if (record.status === "queued") {
          output += "Agent is queued and waiting for a background slot.";
        } else if (record.status === "running") {
          output += "Agent is still running. Check back later.";
        } else if (record.status === "error") {
          output += `Error: ${record.error}`;
        } else {
          output += record.result?.trim() || "No output.";
        }

        if (params.verbose && record.session) {
          const conversation = getAgentConversation(record.session);
          if (conversation) {
            output += `\n\n--- Agent Conversation ---\n${conversation}`;
          }
        }

        // 取回即标记（在 verbose 读取会话之后调用，避免消费时 dispose 后才读）
        if (record.status !== "running" && record.status !== "queued") {
          manager.markConsumed(params.agent_id);
        }
        return textResult(output);
      },
    }),
  );

  // ---- steer_subagent tool ----
  pi.registerTool(
    defineTool({
      name: SUBAGENT_TOOL_NAMES.STEER,
      label: "Steer Agent",
      description:
        "Send a steering message to a running agent. The message interrupts the agent after its current tool execution and is injected into its conversation. Only works on running agents.",
      promptSnippet: "Send a steering message to redirect a running background agent",
      parameters: Type.Object({
        agent_id: Type.String({
          description: "The agent ID to steer (must be currently running).",
        }),
        message: Type.String({
          description: "The steering message to send. Appears as a user message in the agent's conversation.",
        }),
      }),
      execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
        const record = manager.getRecord(params.agent_id);
        if (!record) {
          return textResult(`Agent not found: "${params.agent_id}". 结果已被取走（get_subagent_result 已消费并逐出）或记录已超时清理。`);
        }
        if (record.status !== "running") {
          return textResult(
            `Agent "${params.agent_id}" is not running (status: ${record.status}). Cannot steer a non-running agent.`,
          );
        }
        if (!record.session) {
          return textResult(`Agent "${params.agent_id}" has no active session yet.`);
        }
        try {
          await record.session.steer(params.message);
          emit(pi, "subagents:steered", { id: record.id, type: record.type, message: params.message });
          return textResult(
            `Steering message sent to agent ${record.id}. The agent will process it after its current tool execution.`,
          );
        } catch (err) {
          return textResult(
            `Failed to steer agent: ${errMessage(err)}`,
          );
        }
      },
    }),
  );

  // ---- /subagents 命令：切换右侧运行记录 sidebar ----
  pi.registerCommand("subagents", {
    description: "Toggle the subagent run-record sidebar (TUI overlay)",
    handler: async (_args, ctx) => {
      if (ctx.mode === "print" || !ctx.hasUI) {
        ctx.ui.notify?.("sidebar requires an interactive TUI session", "info");
        return;
      }
      if (sidebarOpen || sidebarHandle) {
        sidebarHandle?.hide();
        ctx.ui.notify?.("subagent sidebar: off", "info");
      } else {
        savedUI = ctx.ui as SidebarUI;
        captureCtx(ctx as unknown as AiusFooterCtx);
        fleetList.setUICtx(ctx.ui as FleetUICtx);
        // fire-and-forget：ui.custom 的 promise 在关闭(done)时才 resolve，不能 await（会挂起命令）
        void openSubagentSidebar(savedUI);
        ctx.ui.notify?.("subagent sidebar: on", "info");
      }
    },
  });
}
