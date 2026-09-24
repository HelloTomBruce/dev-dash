import { detectors } from "./detectors/registry";
import { resetLoginPath } from "./detectors/utils/shell";
import type { ScanResult, ToolResult } from "./detectors/types";
import { outdatedChecks } from "./detectors/outdated";

const CACHE_TTL_MS = 60_000;

let cache: { result: ScanResult; at: number } | null = null;

async function withTimeout<T>(
  p: Promise<T>,
  ms: number
): Promise<T | { __timeout: true }> {
  return Promise.race([
    p,
    new Promise<{ __timeout: true }>((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), ms)
    ),
  ]);
}

/**
 * 全量扫描：所有检测器并行执行，单个 10s 超时，结果缓存 60s。
 * 扫描完成后对支持的额外工具并行执行过期检查。
 */
export async function runScan(force = false): Promise<ScanResult> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.result;
  }

  // 强制刷新时重新预取登录 shell PATH（用户可能刚改了 shell 配置）
  if (force) resetLoginPath();

  const start = Date.now();

  const settled = await Promise.allSettled(
    detectors.map(async (d) => {
      const t0 = Date.now();
      const out = await withTimeout(d.detect(), 10_000);
      if (out && typeof out === "object" && "__timeout" in out) {
        return {
          ...emptyResult(d),
          status: "error" as const,
          error: "探测超时",
          durationMs: Date.now() - t0,
          outdated: null,
        };
      }
      return { ...out, durationMs: Date.now() - t0, outdated: null };
    })
  );

  const tools: ToolResult[] = settled.map((s, i) => {
    const d = detectors[i];
    if (s.status === "fulfilled") return s.value as ToolResult;
    return {
      ...emptyResult(d),
      status: "error",
      error: String(s.reason).slice(0, 200),
      durationMs: 0,
      outdated: null,
    };
  });

  // 并行执行过期检查（仅对已安装且支持的工具）
  const outdatedPromises = tools
    .filter((t) => t.status === "ok" && t.path && outdatedChecks[t.id])
    .map(async (t) => {
      try {
        const info = await outdatedChecks[t.id]!();
        return {
        id: t.id,
        outdated: info,
      } as { id: string; outdated: ToolResult["outdated"] };
      } catch {
        return {
        id: t.id,
        outdated: null,
      };
      }
    });
  const outdatedResults = await Promise.allSettled(outdatedPromises);
  const outdatedMap = new Map<string, ToolResult["outdated"]>();
  for (const r of outdatedResults) {
    if (r.status === "fulfilled") {
      outdatedMap.set(r.value.id, r.value.outdated);
    }
  }
  for (const t of tools) {
    t.outdated = outdatedMap.get(t.id) ?? null;
  }

  const installed = tools.filter((t) => t.status === "ok").length;
  const errors = tools.filter((t) => t.status === "error").length;

  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    summary: {
      installed,
      errors,
      notFound: tools.length - installed - errors,
      total: tools.length,
    },
    tools,
  };

  cache = { result, at: Date.now() };
  return result;
}

function emptyResult(d: (typeof detectors)[number]): Omit<ToolResult, "durationMs"> {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    status: "error",
    version: null,
    path: null,
    source: null,
    raw: null,
    error: null,
    outdated: null,
  };
}
