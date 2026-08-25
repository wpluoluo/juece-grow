/// <reference types="node" />

/**
 * Pi 扩展：越界/不可逆命令拦截（guardrails-destructive）
 *
 * 权限模型（v2：仓库内白名单默认，只拦越界）
 * ----------------------------------------------
 * 用户决策（change fix-permission-model §B）：把「黑名单 + 弹窗确认」模型重构为
 * 「仓库内默认白名单，只拦越界操作」。仓库内常规操作（文件修改/新增/删除、
 * git add/commit/push/merge/checkout、npm test/vitest/node 等）直接放行；
 * 越界/不可逆操作（仓库外删除与写入、删远程分支、git rm、kill、sudo、
 * 磁盘操作、关机、fork bomb、直写裸设备）直接拦截——有 UI 也不再弹确认。
 *
 * 拦截流程（B1）
 * -------------
 * tool_call(bash)
 *  ├─ WS_GUARDRAILS_BYPASS=1 → 放行（一次性绕过，与仓库既有 WS_CHANGE_HOOK_BYPASS 一致）
 *  ├─ .pi/guardrails.json allowlist 命中 → 放行（补充白名单；相对 process.cwd()，
 *  │    每次 tool_call 重新读取，即改即生效；best-effort 绝不抛错）
 *  ├─ 仓库根判定：git rev-parse --show-toplevel（cwd 起，按 cwd 缓存，每次 tool_call 重查）
 *  │    ├─ 失败（非 git 目录）→ 越界类命令（rm -r/-rf、重定向写）保守拦截（fail-safe）
 *  │    └─ 成功 → gitRoot 已知
 *  ├─ 黑名单（直接 block，不弹窗）：
 *  │    ├─ git rm（零容忍）/ 删除远程分支（push origin :branch / --delete / -d、branch -D）
 *  │    ├─ kill -9 / pkill / killall / sudo
 *  │    ├─ chmod -R / 777、chown -R / 777
 *  │    ├─ dd 写盘 / mkfs / mkfs.* / mke2fs / fdisk
 *  │    ├─ shutdown / reboot / halt / poweroff / fork bomb / 直写裸设备（> /dev/sdX）
 *  │    ├─ 仓库外删除：rm -r/-rf 目标解析路径不在 gitRoot 内（rm -rf ~ / /etc / 绝对路径等）
 *  │    └─ 写仓库外路径：> / >> 重定向目标在 gitRoot 外（如 > ~/xxx、> /etc/xxx）
 *  ├─ 前置条件门禁（纯自动判定，不弹窗）：
 *  │    ├─ git reset --hard：git status --porcelain 空（无已跟踪改动+未跟踪文件）
 *  │    │    AND HEAD ahead=0（已 push）→ 放行；否则 block + "仓库未干净或未 push，拒绝执行"
 *  │    └─ git clean -fdx（含 -fd/-fx 等强制清理）：同上门禁（仓库干净才允许清理）
 *  └─ 其余（仓库内修改/新增/删除、git push/commit/merge/checkout、
 *       npm test/vitest/node/python、cat >>/echo > 写仓库内）→ 放行（白名单默认）
 *
 * 配置示例（.pi/guardrails.json）
 * -------------------------------
 * {
 *   "allow": [
 *     "^rm\\s+-rf\\s+/tmp/"
 *   ]
 * }
 *
 * 说明
 * ----
 * - `import type { ExtensionAPI }` 仅在编译期引用类型，运行时被剥离，
 *   不引入对 `@earendil-works/pi-coding-agent` 的运行时依赖。
 * - 整个 handler 由 try/catch 包裹：任何内部异常都 console.error 后放行，
 *   绝不让本扩展的故障阻塞正常工具调用。
 * - 拦截提示（B3）：reason 含统一文案 + 命中原因 + 命令本身（不含密码/env 值等敏感信息）。
 */

import { execSync } from "child_process";
import { readFileSync, realpathSync } from "fs";
import { homedir } from "os";
import { join, resolve, sep } from "path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 拦截统一提示（B3 规格） */
export const BLOCK_MESSAGE =
  "该操作已被 aiws 安全护栏拦截（越界/不可逆）。如确需执行请人工操作，或调整 .pi/guardrails.json allowlist。";

/**
 * 黑名单（直接拦截，不弹窗）。
 * 每项：pattern 命中即拦截；hint 为该行中文说明（命中原因）。
 * 同时导出供单测直接引用真实清单。
 */
export const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  // git rm：不可逆删除，零容忍
  {
    pattern: /(?:^|[;&|]\s*)git\s+rm\b/,
    hint: "git rm（不可逆删除，零容忍）",
  },
  // 删除远程分支：git push origin :branch / --delete / -d（保留 `git push` 正常推送放行）
  {
    pattern: /\bgit\s+push\b[^\n]*(?:--delete\b|\s-d\b|\s+:[^\s]+)/,
    hint: "删除远程分支（git push origin :branch / --delete / -d）",
  },
  // 本地分支删除（git branch -D <-d 常规）已放行：本地分支可 reflog 恢复，风险低；远程删除仍由上方规则拦截。2026-08-15 用户决策（此前 -D 曾入黑名单）
  // 杀进程
  {
    pattern: /\bkill\s+-9\b|\bpkill\b|\bkillall\b/,
    hint: "杀进程（kill -9 / pkill / killall）",
  },
  // sudo（需 sudo 的操作由人工执行；锚定命令位置，避免误伤提交信息等字符串里的单词）
  {
    pattern: /(?:^|[;&|(\n]\s*)sudo\b/,
    hint: "sudo（需 sudo 的操作由人工执行）",
  },
  // 磁盘/分区操作：mkfs、mkfs.*、mke2fs、fdisk、dd（dd 需 if= 或 of=/dev/ 才命中，避免误伤）
  {
    pattern: /\bmkfs\b|\bmke2fs\b|\bfdisk\b|\bdd\s+(?:if=|\s*of=\/dev\/)/,
    hint: "磁盘/分区操作（mkfs / mkfs.* / mke2fs / fdisk / dd 写盘）",
  },
  // 权限批量变更：chmod -R / 777，chown -R / 777；chmod +x、chmod 755 不命中
  {
    pattern: /\bchmod\b[^\n]*\s-(?:[a-zA-Z]*R[a-zA-Z]*)|\bchmod\b[^\n]*\s777\b|\bchown\b[^\n]*(?:\s-[a-zA-Z]*R[a-zA-Z]*|\s777\b)/,
    hint: "权限批量变更（chmod -R / 777、chown -R / 777）",
  },
  // 系统级操作
  {
    pattern: /\b(?:shutdown|reboot|halt|poweroff)\b/,
    hint: "系统操作（shutdown / reboot / halt / poweroff）",
  },
  // fork bomb
  {
    pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    hint: "fork bomb 递归炸弹",
  },
  // 直写裸设备（重定向 > 前可带空格或 fd 数字如 "2>"；of= 如 dd 写盘）
  // 覆盖 sd/nvme/vd/hd/disk/dm 盘符族与 >> 追加；/dev/null、/dev/zero、/dev/tty 等不在族内不误伤
  {
    pattern: /\bof=\/dev\/(?:sd[a-z]+\d*|nvme\d+n\d+(?:p\d+)?|vd[a-z]+|hd[a-z]+|disk\d+|dm-\d+(?:p\d+)?)|(?:^|\s|[0-9])>{1,2}[ \t]*\/dev\/(?:sd[a-z]+\d*|nvme\d+n\d+(?:p\d+)?|vd[a-z]+|hd[a-z]+|disk\d+|dm-\d+(?:p\d+)?)/,
    hint: "直接写入裸设备（> /dev/sdX / >> 追加 / of=/dev/sdX）",
  },
];

/** 前置条件门禁命令（自动判定，不弹窗） */
const GATED_COMMANDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bgit\s+reset\b[^\n]*--hard\b/, label: "git reset --hard" },
  // git clean 强制清理：-f/-fd/-fx/-fdx 等含 f 且不含 n（-n 干跑不拦）
  {
    pattern: /\bgit\s+clean\b[^\n]*\s-(?![a-z]*n[a-z]*\b)[a-z]*f[a-z]*\b/,
    label: "git clean -f*（强制清理）",
  },
];

/** 重定向到这些 /dev 特殊文件不算「写仓库外路径」 */
const SAFE_DEV_TARGETS = new Set([
  "/dev/null",
  "/dev/zero",
  "/dev/tty",
  "/dev/stdin",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/random",
  "/dev/urandom",
]);

/** 递归删除形态（rm -r / -rf / -fr / -r -f / -R / --recursive） */
const RM_RECURSIVE_RE = /\brm\b[^;&|>]*?(?:--recursive\b|-[a-zA-Z]*[rR][a-zA-Z]*)/;

/**
 * 读取项目级 allowlist（.pi/guardrails.json，格式 { "allow": ["正则", ...] }）。
 * best-effort：文件缺失 / JSON 非法 / 正则非法一律视为「无 allowlist」，
 * 任何异常都吞掉并返回空数组，绝不抛错。
 */
function loadAllowlist(cwd: string): RegExp[] {
  try {
    const raw = readFileSync(join(cwd, ".pi", "guardrails.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const allow = (parsed as { allow?: unknown }).allow;
    if (!Array.isArray(allow)) return [];
    const result: RegExp[] = [];
    for (const entry of allow) {
      if (typeof entry !== "string") continue;
      try {
        result.push(new RegExp(entry));
      } catch {
        // 单条非法正则跳过，不影响其他条目
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** 命令命中任一 allow 正则即放行 */
function isAllowed(command: string, cwd: string): boolean {
  for (const re of loadAllowlist(cwd)) {
    if (re.test(command)) return true;
  }
  return false;
}

/** realpath 归一化（目标可能不存在时回退到原路径） */
function realpathSafe(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** gitRoot 缓存（按 cwd；成功才缓存，失败每次重查——注意目录变化） */
let cachedCwd: string | undefined;
let cachedGitRoot: string | null | undefined;

/** git rev-parse --show-toplevel（cwd 起）→ gitRoot 绝对路径；非 git 目录返回 null */
export function resolveGitRoot(cwd: string): string | null {
  const realCwd = realpathSafe(cwd);
  if (cachedCwd === realCwd && cachedGitRoot !== undefined && cachedGitRoot !== null) {
    return cachedGitRoot;
  }
  try {
    const out = execSync("git rev-parse --show-toplevel", {
      cwd: realCwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    if (out) {
      cachedCwd = realCwd;
      cachedGitRoot = realpathSafe(resolve(out));
      return cachedGitRoot;
    }
  } catch {
    // 非 git 目录 / git 不可用 → null（不缓存失败，下次重查）
  }
  return null;
}

/** 跑一条只读 git 命令，返回 stdout trim 后的字符串；失败返回 null */
function runGit(cwd: string, args: string[]): string | null {
  try {
    return execSync(`git ${args.join(" ")}`, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

/** 前置条件门禁：git status --porcelain 空 且 HEAD ahead=0（已 push） */
function checkGate(cwd: string, label: string): { ok: boolean; reason?: string } {
  const porcelain = runGit(cwd, ["status", "--porcelain"]);
  if (porcelain === null) {
    return { ok: false, reason: `无法确认 git 仓库状态（git status 失败，可能非 git 目录），拒绝执行 ${label}` };
  }
  if (porcelain !== "") {
    return { ok: false, reason: `仓库未干净或未 push，拒绝执行 ${label}（存在未提交改动或未跟踪文件）` };
  }
  const sb = runGit(cwd, ["status", "-sb"]);
  if (sb === null) {
    return { ok: false, reason: `无法确认分支推送状态（git status -sb 失败），拒绝执行 ${label}` };
  }
  const ahead = sb.match(/\[ahead\s+(\d+)\]/);
  if (ahead && Number(ahead[1]) > 0) {
    return { ok: false, reason: `仓库未干净或未 push，拒绝执行 ${label}（HEAD 尚未 push，ahead ${ahead[1]}）` };
  }
  return { ok: true };
}

/**
 * 展开路径 token：去除成对引号、展开 ~，$VAR 在 env 可解析时展开、
 * 否则按字面保守匹配（R2：误拦截由 allowlist 补充）。
 */
function expandTarget(token: string): string {
  let t = token.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  if (t === "~") return homedir();
  if (t.startsWith("~/")) return join(homedir(), t.slice(2));
  t = t.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (full, braced, plain) => {
    const name = braced ?? plain;
    return process.env[name] ?? full;
  });
  return t;
}

/** 目标路径是否在 gitRoot 内（含 gitRoot 本身） */
function isInsideRepo(gitRoot: string, cwd: string, target: string): boolean {
  const abs = realpathSafe(resolve(realpathSafe(cwd), target));
  return abs === gitRoot || abs.startsWith(gitRoot + sep);
}

/** 提取 rm 的目标参数（跳过选项），用于 rm -r/-rf 仓库外判定 */
function extractRmTargets(command: string): string[] {
  const targets: string[] = [];
  for (const m of command.matchAll(/\brm\b/g)) {
    const rest = command.slice((m.index ?? 0) + m[0].length).split(/[;&|>]/)[0];
    for (const tok of rest.split(/\s+/).filter(Boolean)) {
      if (tok.startsWith("-")) continue;
      targets.push(tok);
    }
  }
  return targets;
}

/** 提取重定向目标（> / >> / 2> 等；跳过 >& 与 << 输入重定向） */
function extractRedirectTargets(command: string): string[] {
  const targets: string[] = [];
  const re = /(?:^|[^0-9A-Za-z_])[0-9]?>{1,2}[ \t]*(?!&)([^\s;&|<]+)/g;
  for (const m of command.matchAll(re)) targets.push(m[1]);
  return targets;
}

export interface DecideResult {
  action: "allow" | "block";
  reason?: string;
}

/** 组装 B3 拦截提示：统一文案 + 命中原因 + 命令本身（不含敏感信息） */
export function buildBlockReason(hint: string, command: string): string {
  return `${BLOCK_MESSAGE}\n命中原因：${hint}\n命令：${command}`;
}

/**
 * 单条 bash 命令的裁决（供 handler 与单测共用）。
 * opts.cwd 缺省用 process.cwd()。
 */
export function decide(command: string, opts: { cwd?: string } = {}): DecideResult {
  const cwd = opts.cwd ?? process.cwd();

  // 1) 一次性绕过开关
  if (process.env.WS_GUARDRAILS_BYPASS === "1") return { action: "allow" };

  // 2) 项目级 allowlist（补充白名单）
  if (isAllowed(command, cwd)) return { action: "allow" };

  // 3) 仓库根判定（每次 tool_call 重查，按 cwd 缓存）
  const gitRoot = resolveGitRoot(cwd);

  // 4) 静态黑名单：直接拦截，不弹窗
  const hit = DANGEROUS_PATTERNS.find(({ pattern }) => pattern.test(command));
  if (hit) return { action: "block", reason: buildBlockReason(hit.hint, command) };

  // 5) 前置条件门禁：git reset --hard / git clean -f*（仓库干净 + 已 push 才放行）
  const gated = GATED_COMMANDS.find(({ pattern }) => pattern.test(command));
  if (gated) {
    const gate = checkGate(cwd, gated.label);
    if (!gate.ok) return { action: "block", reason: buildBlockReason(gate.reason ?? "前置条件不满足", command) };
    return { action: "allow" };
  }

  // 6) 路径类越界（依赖 gitRoot）：
  //    rm -r/-rf 目标在仓库外；> / >> 重定向目标在仓库外
  const rmRecursive = RM_RECURSIVE_RE.test(command);
  const redirects = extractRedirectTargets(command);
  if (rmRecursive || redirects.length > 0) {
    if (!gitRoot) {
      // fail-safe（D4）：无法判定仓库根（非 git 目录）→ 越界类命令保守拦截
      return {
        action: "block",
        reason: buildBlockReason("无法确认 git 仓库根（当前目录非 git 仓库），越界类命令保守拦截", command),
      };
    }
    if (rmRecursive) {
      const outside = extractRmTargets(command)
        .map((t) => expandTarget(t))
        .filter((t) => !isInsideRepo(gitRoot, cwd, t));
      if (outside.length > 0) {
        return {
          action: "block",
          reason: buildBlockReason(`仓库外文件删除：${outside.join("、")}（不在 git 仓库 ${gitRoot} 内）`, command),
        };
      }
    }
    if (redirects.length > 0) {
      const outside = redirects
        .map((t) => expandTarget(t))
        .filter((t) => !SAFE_DEV_TARGETS.has(t) && !isInsideRepo(gitRoot, cwd, t));
      if (outside.length > 0) {
        return {
          action: "block",
          reason: buildBlockReason(`写仓库外路径：${outside.join("、")}（不在 git 仓库 ${gitRoot} 内）`, command),
        };
      }
    }
  }

  // 7) 其余：仓库内白名单默认放行
  return { action: "allow" };
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, _ctx) => {
    try {
      if (event.toolName !== "bash") return undefined;

      const input = event.input as { command?: unknown };
      const command = typeof input?.command === "string" ? input.command : "";
      if (!command.trim()) return undefined;

      const result = decide(command, { cwd: process.cwd() });
      if (result.action === "block") {
        return { block: true, reason: result.reason ?? BLOCK_MESSAGE };
      }
      return undefined;
    } catch (err) {
      // 扩展自身故障绝不阻塞工具调用：记录后放行
      console.error("[guardrails-destructive] 扩展内部错误，已放行该命令:", err);
      return undefined;
    }
  });
}
