/// <reference types="node" />

/**
 * aiws-retry-observer.ts — pi 侧状态上报扩展（G-025 group-1，TOOLING-002Q）
 *
 * 职责：监听 pi 事件，把会话状态原子写入 `.aiws/tmp/pi-session-state.json`，
 * 供 aiws watchdog（`aiws pi watch`，见 packages/aiws/src/commands/pi-recover.ts）
 * 轮询判定"上游失败停止（failed_upstream）"并自动发"继续"续跑。
 *
 * 状态文件 schema：
 *   { "state": "running"|"failed_upstream"|"completed"|"idle",
 *     "retryCount": number, "failureReason"?: string,
 *     "ts": string (ISO), "pid"?: number }
 *
 * 事件映射（冻结方案 .aiws/plan/2026-08-12-pi-upstream-retry.intake.md 设计点 ②）：
 *   - auto_retry_start                  → state=running, retryCount++
 *   - auto_retry_end (final failure)    → state=failed_upstream + failureReason
 *   - agent_settled                     → state=completed
 *   - 扩展加载时                        → state=idle
 *
 * ── 事件名与载荷依据（pi 0.84.1，@earendil-works/pi-coding-agent）──
 *   - `agent_start` / `agent_end` / `agent_settled` 在扩展事件白名单内
 *     （docs/extensions.md §Event List；dist/core/extensions/types.d.ts L882-885），
 *     由 agent-session.js `_extensionRunner.emit(...)` 透传（L330/L443/L446），
 *     扩展可订阅；`agent_end` 载荷为 `{ type, messages }`，失败契约见
 *     @earendil-works/pi-agent-core dist/types.d.ts：最终 assistant message
 *     带 `stopReason: "error"` 与 `errorMessage`。
 *   - `auto_retry_start` / `auto_retry_end` 载荷（dist/core/agent-session.d.ts
 *     L72-98；docs/rpc.md §auto_retry_start/end）：
 *       auto_retry_start { attempt, maxAttempts, delayMs, errorMessage }
 *       auto_retry_end   { success, attempt, finalError? }
 *     但这两个事件在 0.84.1 只发 session 内部总线（agent-session.js `_emit`，
 *     L392/L769/L2134/L2155）与 RPC 事件流，**不**经 `_extensionRunner.emit`
 *     转发给扩展。扩展 `api.on()` 接受任意字符串（loader.js L211-213），
 *     注册不会抛错，只是 0.84.1 不会派发——因此：
 *       1) 仍按冻结方案注册（后续 pi 透传后自动生效，注册本身无副作用）；
 *       2) 追加 agent_start/agent_end 兜底分类（见 handleAgentEnd），使
 *          failed_upstream 分类在 0.84.1 真实可用。
 *   - 兜底语义：agent_start 重置"本运行是否失败"标记；agent_end 若最终消息
 *     stopReason==="error" 记录失败（不立即写 failed_upstream，因为其后可能
 *     还有 auto-retry/compaction/queued continuation）；agent_settled 才定稿：
 *     本运行失败 → failed_upstream（保留失败原因），否则 → completed。
 *     `stopReason==="aborted"`（用户中断）不视为上游失败，避免 watchdog 误恢复。
 *
 * 安全约束：全程 try/catch，任何异常只 console.error，绝不抛出/阻塞 pi；
 * 原子写：先写 `pi-session-state.json.tmp` 再 renameSync（避免半截 JSON）。
 *
 * @module aiws-retry-observer
 */

import { mkdirSync, renameSync, writeFileSync, existsSync, readFileSync, openSync } from "fs";
import { join } from "path";
import { spawn, execSync } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionStateValue = "running" | "failed_upstream" | "completed" | "idle";

export interface SessionState {
  state: SessionStateValue;
  retryCount: number;
  failureReason?: string;
  /** ISO 时间戳。 */
  ts: string;
  pid?: number;
}

/** 与 .pi/extensions/aiws.ts 一致的 pi 扩展上下文最小面。 */
interface PiContext {
  on(event: string, callback: (...args: unknown[]) => void | Promise<void>): void;
  projectRoot?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STATE_FILE = "pi-session-state.json";
export const STATE_FILE_TMP = "pi-session-state.json.tmp";
const STATE_DIR_REL = join(".aiws", "tmp");

// ---------------------------------------------------------------------------
// 会话级跟踪（0.84.1 兜底分类状态；模块加载即重置）
// ---------------------------------------------------------------------------

let retryCount = 0;
/** 最近一次 agent 运行是否以错误（stopReason==="error"）结束。 */
let lastRunHadError = false;
/** 最近一次失败的失败原因（auto_retry_end finalError 或 agent_end errorMessage）。 */
let lastFailureReason: string | undefined;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveProjectRoot(ctx: PiContext): string {
  return ctx.projectRoot || process.cwd();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * 从错误文本提取 HTTP status（如 rpc.md 示例 `529 {"type":"error",...}` 中的
 * 529；429/5xx 同理）。取不到返回 null。
 */
export function extractHttpStatus(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = text.match(/\b([45]\d\d)\b/);
  return m ? m[1] : null;
}

/**
 * 从事件载荷尽量提取失败原因：优先 finalError / errorMessage / error 字段，
 * 前缀 HTTP status（4xx/5xx）便于诊断；全缺则回退 JSON 序列化。
 */
export function extractFailureReason(event: unknown): string {
  const payload = asRecord(event);
  const raw =
    (typeof payload.finalError === "string" && payload.finalError.trim()) ||
    (typeof payload.errorMessage === "string" && payload.errorMessage.trim()) ||
    (typeof payload.error === "string" && payload.error.trim()) ||
    "";
  let text = raw;
  if (!text) {
    try {
      text = JSON.stringify(payload);
    } catch {
      text = String(event ?? "unknown");
    }
  }
  const status = extractHttpStatus(raw) || extractHttpStatus(text);
  return status ? `HTTP ${status}: ${text}` : text;
}

/**
 * 判断 agent_end 载荷中的最终 assistant 消息是否以错误结束（上游失败）。
 * 仅 stopReason==="error" 判定失败；"aborted"（用户中断）不算。
 */
export function agentEndHasFinalError(event: unknown): { failed: boolean; reason?: string } {
  const payload = asRecord(event);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = asRecord(messages[i]);
    if (msg.role !== "assistant") continue;
    if (msg.stopReason === "error") {
      const reason = extractFailureReason(msg);
      return { failed: true, reason };
    }
    // 最后一条 assistant 消息非 error → 本运行正常结束
    return { failed: false };
  }
  return { failed: false };
}

/** 组装状态对象（带 pid / 当前 retryCount / 时间戳）。 */
function buildState(state: SessionStateValue, failureReason?: string): SessionState {
  return {
    state,
    retryCount,
    ...(failureReason ? { failureReason } : {}),
    ts: isoNow(),
    pid: typeof process !== "undefined" ? process.pid : undefined,
  };
}

/** 原子写：确保目录存在 → 写 .tmp → rename。任何异常由调用方兜底。 */
export function atomicWriteState(projectRoot: string, state: SessionState): void {
  const tmpDir = join(projectRoot, STATE_DIR_REL);
  mkdirSync(tmpDir, { recursive: true });
  const finalPath = join(tmpDir, STATE_FILE);
  const tmpPath = join(tmpDir, STATE_FILE_TMP);
  writeFileSync(tmpPath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  renameSync(tmpPath, finalPath);
}

function safeWrite(projectRoot: string, state: SessionState): void {
  try {
    atomicWriteState(projectRoot, state);
  } catch (err) {
    // 状态上报失败绝不影响 pi 运行
    console.error("[aiws-retry-observer] 写状态文件失败:", err);
  }
}

// ---------------------------------------------------------------------------
// 内部 handler（命名导出，供单测 / mock 直接调用）
// ---------------------------------------------------------------------------

/** 扩展加载 / 空闲：state=idle，retryCount 归零。 */
export function handleExtensionLoad(projectRoot: string): void {
  retryCount = 0;
  lastRunHadError = false;
  lastFailureReason = undefined;
  safeWrite(projectRoot, buildState("idle"));
}

/** auto_retry_start：state=running, retryCount++。 */
export function handleAutoRetryStart(projectRoot: string, _event: unknown): void {
  retryCount++;
  lastRunHadError = false;
  safeWrite(projectRoot, buildState("running"));
}

/** auto_retry_end：final failure（success=false）→ failed_upstream；成功 → running。 */
export function handleAutoRetryEnd(projectRoot: string, event: unknown): void {
  const payload = asRecord(event);
  if (payload.success === false) {
    lastRunHadError = true;
    lastFailureReason = extractFailureReason(event);
    safeWrite(projectRoot, buildState("failed_upstream", lastFailureReason));
  } else {
    // success=true：重试成功，运行仍在进行
    safeWrite(projectRoot, buildState("running"));
  }
}

/** agent_start（0.84.1 兜底）：运行开始 → running，重置本运行失败标记。 */
export function handleAgentStart(projectRoot: string, _event: unknown): void {
  lastRunHadError = false;
  safeWrite(projectRoot, buildState("running"));
}

/**
 * agent_end（0.84.1 兜底）：本运行以最终错误结束 → 记录失败标记与原因。
 * 不立即写 failed_upstream：agent_end 后仍可能有 auto-retry / compaction /
 * queued continuation；最终定稿交给 agent_settled。
 */
export function handleAgentEnd(projectRoot: string, event: unknown): void {
  const { failed, reason } = agentEndHasFinalError(event);
  if (failed) {
    lastRunHadError = true;
    lastFailureReason = reason;
  }
  // 运行结束但会话未定稿：维持 running，等待 agent_settled 定稿
  safeWrite(projectRoot, buildState("running"));
}

/**
 * agent_settled：会话完全定稿（无 retry/compaction/follow-up 剩余）。
 * 本运行曾失败 → failed_upstream（保留失败原因）；否则 → completed。
 * 注：冻结方案"agent_settled → completed"依赖 auto_retry_end(final failure)
 * 先行置 failed_upstream；0.84.1 不透传 auto_retry_*，故用 lastRunHadError
 * 兜底保证分类一致，且避免 failed_upstream 被 completed 覆盖。
 */
export function handleAgentSettled(projectRoot: string, _event: unknown): void {
  if (lastRunHadError) {
    safeWrite(projectRoot, buildState("failed_upstream", lastFailureReason));
  } else {
    safeWrite(projectRoot, buildState("completed"));
  }
}

// ---------------------------------------------------------------------------
// Guardian Watchdog（PROB-PI-WATCH-GUARDIAN）：pi 启动即自动带上 watchdog
// ---------------------------------------------------------------------------
//
// 扩展加载时若检测到 tmux 环境，自动 spawn `aiws pi watch --detect-stall
// --stall-session <当前会话>` 守护当前 pi 会话：上游错误/护栏拦截时自动恢复，
// 无需手动启动。目标会话关闭后 watchdog 自行退出（--max-idle-rounds），
// 防僵尸；pid 文件防重复 spawn。全程 try/catch，失败只 console.warn，绝不影响 pi。

/** guardian watchdog pid 文件（防重复 spawn）。 */
export const GUARDIAN_PID_FILE = "pi-watch-guardian.pid";
/** guardian watchdog 日志文件。 */
export const GUARDIAN_LOG_FILE = "pi-watch-guardian.log";
/** 目标会话消失轮数上限（默认 12 ≈ 60s @5s），达到后 watchdog 自杀退出。 */
export const GUARDIAN_MAX_IDLE_ROUNDS = 12;

/** pid 是否存活（process.kill(pid, 0) 探测）。 */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 当前 tmux 守护目标：优先 TMUX_PANE（%N，split 分屏 pane 内运行时精准守护自己的 pane）；
 * 回退当前会话名（display-message '#S'）。不在 tmux 或取不到返回 undefined。
 */
export function currentTmuxTarget(): string | undefined {
  if (!process.env.TMUX) return undefined;
  const pane = process.env.TMUX_PANE;
  if (pane && /^%\d+$/.test(pane)) return pane;
  try {
    const name = execSync("tmux display-message -p '#S'", { encoding: "utf-8" }).trim();
    return /^[A-Za-z0-9._-]+$/.test(name) ? name : undefined;
  } catch {
    return undefined;
  }
}

/** 兼容旧名（无 pane 语义时等同 currentTmuxTarget）。 */
export function currentTmuxSessionName(): string | undefined {
  return currentTmuxTarget();
}

/**
 * 启动 guardian watchdog 守护当前 tmux 目标（pane 或会话；幂等：已有存活 watchdog 则跳过）。
 * 导出供单测直接调用（不依赖 pi 上下文）。
 */
export function spawnGuardianWatchdog(projectRoot: string, bin = "aiws"): boolean {
  try {
    const target = currentTmuxTarget();
    if (!target) {
      console.warn("[aiws-retry-observer] 不在 tmux 环境或取不到守护目标，跳过 guardian watchdog 启动");
      return false;
    }
    const tmpDir = join(projectRoot, ".aiws", "tmp");
    mkdirSync(tmpDir, { recursive: true });
    const pidFile = join(tmpDir, GUARDIAN_PID_FILE);
    // 防重复：已有存活 watchdog（pid 文件 + kill 探测）→ 跳过
    if (existsSync(pidFile)) {
      const old = Number(readFileSync(pidFile, "utf-8").trim());
      if (Number.isInteger(old) && old > 0 && pidAlive(old)) {
        return false;
      }
    }
    const logFd = openSync(join(tmpDir, GUARDIAN_LOG_FILE), "a");
    const child = spawn(
      bin,
      [
        "pi", "watch", "--detect-stall",
        "--stall-session", target,
        "--tmux-session", target,
        "--cooldown-secs", "60",
        "--max-recoveries", "5",
        "--max-idle-rounds", String(GUARDIAN_MAX_IDLE_ROUNDS),
        projectRoot,
      ],
      { cwd: projectRoot, detached: true, stdio: ["ignore", logFd, logFd] },
    );
    writeFileSync(pidFile, String(child.pid ?? ""));
    child.on("error", (err: Error) => {
      // MEDIUM-1 (quality review): aiws 不在 PATH 时 spawn 异步 error 事件，
      // 无监听会 uncaughtException 崩掉 pi——必须消费 error 事件
      console.warn("[aiws-retry-observer] guardian watchdog spawn error:", err.message);
    });
    child.unref();
    console.log(`[aiws-retry-observer] guardian watchdog 已启动 pid=${child.pid} target=${target}`);
    return true;
  } catch (err) {
    console.warn("[aiws-retry-observer] guardian watchdog 启动失败:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Extension Setup
// ---------------------------------------------------------------------------

export default function setup(ctx: PiContext): void {
  const projectRoot = resolveProjectRoot(ctx);

  // 扩展加载：初始 idle
  handleExtensionLoad(projectRoot);

  // Guardian：pi 启动即自动带上 watchdog（守护当前会话；tmux 外/失败静默跳过）
  try {
    spawnGuardianWatchdog(projectRoot);
  } catch (err) {
    console.warn("[aiws-retry-observer] guardian watchdog 启动失败:", err);
  }
  // ── 冻结方案事件（auto_retry_start/end 在 0.84.1 不透传扩展；注册无害，
  //    pi 后续版本透传后自动生效。全部 try/catch：监听失败不报错）──
  try {
    ctx.on("auto_retry_start", (event: unknown) => {
      try {
        handleAutoRetryStart(projectRoot, event);
      } catch (err) {
        console.error("[aiws-retry-observer] auto_retry_start 处理失败:", err);
      }
    });
  } catch {
    // 事件不支持：忽略（依据见文件头注释）
  }
  try {
    ctx.on("auto_retry_end", (event: unknown) => {
      try {
        handleAutoRetryEnd(projectRoot, event);
      } catch (err) {
        console.error("[aiws-retry-observer] auto_retry_end 处理失败:", err);
      }
    });
  } catch {
    // 事件不支持：忽略（依据见文件头注释）
  }

  // ── 0.84.1 兜底事件（确认透传扩展，见文件头注释）──
  try {
    ctx.on("agent_start", (event: unknown) => {
      try {
        handleAgentStart(projectRoot, event);
      } catch (err) {
        console.error("[aiws-retry-observer] agent_start 处理失败:", err);
      }
    });
  } catch {
    // 事件不支持：忽略
  }
  try {
    ctx.on("agent_end", (event: unknown) => {
      try {
        handleAgentEnd(projectRoot, event);
      } catch (err) {
        console.error("[aiws-retry-observer] agent_end 处理失败:", err);
      }
    });
  } catch {
    // 事件不支持：忽略
  }

  // ── 冻结方案事件（agent_settled 确认透传扩展）──
  try {
    ctx.on("agent_settled", (event: unknown) => {
      try {
        handleAgentSettled(projectRoot, event);
      } catch (err) {
        console.error("[aiws-retry-observer] agent_settled 处理失败:", err);
      }
    });
  } catch {
    // 事件不支持：忽略
  }
}

// ---------------------------------------------------------------------------
// Named exports for unit testing
// ---------------------------------------------------------------------------

export { resolveProjectRoot };
