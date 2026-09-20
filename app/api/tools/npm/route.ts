import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const [versionRes, lsRes, outdatedRes, registryRes, prefixRes] =
      await Promise.all([
        run(`npm --version`, 10000),
        run(`npm ls -g --depth=0 --json`, 30000),
        run(`npm outdated -g --depth=0 --json`, 60000),
        run(`npm config get registry`, 10000),
        run(`npm config get prefix`, 10000),
      ]);

    const version = versionRes.stdout.trim();
    const prefix = prefixRes.stdout.trim();
    const registry = registryRes.stdout.trim();

    const ls = JSON.parse(lsRes.stdout.trim() || "{}");
    const packages = Object.entries(
      (ls.dependencies ?? {}) as Record<string, { version?: string }>
    ).map(([name, info]) => ({ name, current: info.version ?? null }));

    // npm outdated --json：有过期时 exit=1 但 stdout 是有效 JSON
    const outdatedMap = new Map<string, { wanted: string; latest: string }>();
    try {
      const od = JSON.parse(outdatedRes.stdout.trim() || "{}") as Record<
        string,
        { current?: string; wanted?: string; latest?: string }
      >;
      for (const [name, info] of Object.entries(od)) {
        if (info.latest) {
          outdatedMap.set(name, {
            wanted: info.wanted ?? info.latest,
            latest: info.latest,
          });
        }
      }
    } catch {
      /* 无过期时输出为空对象或非 JSON，忽略 */
    }

    const list = packages
      .map((p) => ({
        ...p,
        latest: outdatedMap.get(p.name)?.latest ?? null,
        wanted: outdatedMap.get(p.name)?.wanted ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      version,
      prefix,
      registry,
      packages: list,
      outdatedCount: list.filter((p) => p.latest).length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
