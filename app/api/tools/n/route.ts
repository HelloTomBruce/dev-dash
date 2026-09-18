import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NodeRelease {
  version: string;
  date: string;
  lts: string | false;
}

/** nodejs.org 版本索引缓存 1 小时 */
let releasesCache: { at: number; data: NodeRelease[] } | null = null;

async function fetchReleases(): Promise<NodeRelease[]> {
  if (releasesCache && Date.now() - releasesCache.at < 3600_000) {
    return releasesCache.data;
  }
  const res = await fetch("https://nodejs.org/dist/index.json", {
    signal: AbortSignal.timeout(8000),
  });
  const all: NodeRelease[] = await res.json();
  // 每个大版本只留最新一条
  const seen = new Set<string>();
  const data = all
    .filter((r) => {
      const major = r.version.split(".")[0];
      if (seen.has(major)) return false;
      seen.add(major);
      return true;
    })
    .slice(0, 10);
  releasesCache = { at: Date.now(), data };
  return data;
}

export async function GET() {
  const start = Date.now();
  try {
    // 并行收集本地信息
    const [lsRes, nodeRes, prefixRes] = await Promise.all([
      run(`n ls`, 15000),
      run(`node --version`, 10000),
      run(`/bin/zsh -ilc 'printf %s "$N_PREFIX"'`, 10000),
    ]);

    const current = nodeRes.stdout.trim().replace(/^v/, "");
    const prefix = prefixRes.stdout.trim() || "/usr/local";
    const versionsDir = `${prefix}/n/versions/node`;

    const [duRes, writableRes, releases] = await Promise.all([
      run(`du -sh "${versionsDir}"/* 2>/dev/null`, 30000),
      run(`test -w "${versionsDir}"`, 5000),
      fetchReleases().catch(() => [] as NodeRelease[]),
    ]);

    // du 输出：  180M\t/usr/local/n/versions/node/16.20.0
    const sizeMap = new Map<string, string>();
    for (const line of duRes.stdout.trim().split("\n")) {
      const m = line.trim().match(/^(\S+)\s+(.+)$/);
      if (m) sizeMap.set(m[2].split("/").pop() ?? "", m[1]);
    }

    // n ls 输出： node/16.15.0
    const versions = lsRes.stdout
      .trim()
      .split("\n")
      .map((l) => l.trim().match(/node\/(\S+)/)?.[1])
      .filter((v): v is string => !!v)
      .map((version) => ({
        version,
        size: sizeMap.get(version) ?? null,
        current: version === current,
        path: `${versionsDir}/${version}`,
      }))
      .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0)); // 当前版本排最前

    return NextResponse.json({
      current,
      prefix,
      versionsDir,
      writable: writableRes.ok,
      versions,
      releases: releases.map((r) => ({
        version: r.version.replace(/^v/, ""),
        lts: r.lts || null,
        date: r.date,
      })),
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
