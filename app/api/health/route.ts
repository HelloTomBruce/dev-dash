import { NextResponse } from "next/server";
import { runScan } from "@/lib/scan";
import { healthProviders, type HealthCheckResult } from "@/lib/health/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30_000;
let cache: { at: number; payload: unknown } | null = null;

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

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  const start = Date.now();
  try {
    // 复用扫描缓存：只对已安装的工具做健康检查
    const scan = await runScan(false);
    const installed = new Set(
      scan.tools.filter((t) => t.status === "ok").map((t) => t.id)
    );
    const entries = Object.entries(healthProviders).filter(([id]) =>
      installed.has(id)
    );

    const settled = await Promise.allSettled(
      entries.map(async ([toolId, fn]) => {
        const t0 = Date.now();
        const out = await withTimeout(fn(), 9000);
        if (out && typeof out === "object" && "__timeout" in out) {
          return {
            toolId,
            status: "stopped",
            detail: "健康检查超时",
            durationMs: Date.now() - t0,
          } satisfies HealthCheckResult;
        }
        return {
          toolId,
          status: out.status,
          detail: out.detail,
          durationMs: Date.now() - t0,
        } satisfies HealthCheckResult;
      })
    );

    const results: HealthCheckResult[] = settled.map((s, i) => {
      if (s.status === "fulfilled") return s.value;
      return {
        toolId: entries[i][0],
        status: "stopped",
        detail: String(s.reason).slice(0, 120),
        durationMs: 0,
      };
    });

    const payload = {
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      results,
    };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
