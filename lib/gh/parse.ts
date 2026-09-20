import type {
  GhAuthInfo,
  GhConfigEntry,
  GhExtension,
  GhRateLimit,
} from "./types";

/** 解析 `gh auth status` 文本输出（stdout + stderr 都传入） */
export function parseAuthStatus(out: string): GhAuthInfo {
  const host = out.match(/^(\S+)[^\n]*$/m)?.[1] ?? "github.com";
  const loggedIn = /✓ Logged in to/.test(out) && !/Failed to log in/.test(out);
  const account = out.match(/account (\S+) \(/)?.[1] ?? null;
  const protocol = out.match(/Git operations protocol: (\S+)/)?.[1] ?? null;
  const scopesLine = out.match(/Token scopes: (.+)/)?.[1] ?? "";
  const scopes = scopesLine
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
  return {
    loggedIn,
    account,
    host,
    protocol,
    scopes,
    tokenExpired: /expired/i.test(out),
  };
}

/** 解析 `gh extension list`：每行 "name<空白>version"；无扩展时输出为空 */
export function parseExtensions(out: string): GhExtension[] {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\S+)\s+(\S+)$/);
      return m ? { name: m[1], version: m[2] } : { name: l, version: "?" };
    });
}

/** 解析 `gh config list`：每行 key=value */
export function parseConfig(out: string): GhConfigEntry[] {
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return i > 0
        ? { key: l.slice(0, i), value: l.slice(i + 1) }
        : { key: l, value: "" };
    });
}

/** 解析 `gh api rate_limit` 的 resources.core */
export function parseRateLimit(out: string): GhRateLimit | null {
  try {
    const j = JSON.parse(out) as {
      resources?: { core?: { limit?: number; remaining?: number; reset?: number } };
    };
    const core = j.resources?.core;
    if (!core) return null;
    return {
      remaining: core.remaining ?? 0,
      limit: core.limit ?? 0,
      resetAt: core.reset ?? 0,
    };
  } catch {
    return null;
  }
}

interface RollupItem {
  __typename?: string;
  status?: string;
  conclusion?: string | null;
  state?: string;
}

/** 把 pr list 的 statusCheckRollup 数组归约为一个状态灯 */
export function rollupState(rollup: unknown): "success" | "failure" | "pending" | null {
  if (!Array.isArray(rollup) || rollup.length === 0) return null;
  const items = rollup as RollupItem[];
  const stateOf = (it: RollupItem): "success" | "failure" | "pending" => {
    if (it.__typename === "CheckRun") {
      if (it.status !== "COMPLETED") return "pending";
      return it.conclusion === "SUCCESS" ? "success" : "failure";
    }
    // StatusContext：state = SUCCESS / FAILURE / PENDING / EXPECTED
    if (it.state === "SUCCESS" || it.state === "EXPECTED") return "success";
    if (it.state === "PENDING") return "pending";
    return "failure";
  };
  const states = items.map(stateOf);
  if (states.includes("failure")) return "failure";
  if (states.includes("pending")) return "pending";
  return "success";
}
