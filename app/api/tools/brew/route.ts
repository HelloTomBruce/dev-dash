import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 目录大小计算很慢（Cellar 可能数 GB），单独接口 + 10 分钟缓存 */
let sizesCache: { at: number; cellarSize: string | null; cacheSize: string | null } | null = null;

async function getSizes(prefix: string) {
  if (sizesCache && Date.now() - sizesCache.at < 600_000) return sizesCache;
  const [cellarRes, cacheRes] = await Promise.all([
    run(`du -sh "${prefix}/Cellar" 2>/dev/null`, 90_000),
    run(`du -sh "$(brew --cache)" 2>/dev/null`, 60_000),
  ]);
  const sizeOf = (s: string) => s.trim().split(/\s+/)[0] ?? null;
  sizesCache = {
    at: Date.now(),
    cellarSize: sizeOf(cellarRes.stdout),
    cacheSize: sizeOf(cacheRes.stdout),
  };
  return sizesCache;
}

interface OutdatedEntry {
  name: string;
  installed_versions: string[];
  current_version: string;
  pinned: boolean;
}

export async function GET(request: Request) {
  const start = Date.now();

  // 懒加载模式：只算目录大小（首次较慢，面板在主体渲染后再请求）
  if (new URL(request.url).searchParams.get("sizes") === "1") {
    const prefixRes = await run(`brew --prefix`, 10000);
    const sizes = await getSizes(prefixRes.stdout.trim() || "/opt/homebrew");
    return NextResponse.json({ ...sizes, durationMs: Date.now() - start });
  }

  try {
    const [versionRes, listRes, caskRes, outdatedRes, leavesRes, prefixRes] =
      await Promise.all([
        run(`brew --version`, 10000),
        run(`brew list --versions`, 30000),
        run(`brew list --cask --versions`, 30000),
        run(`brew outdated --json=v2`, 60000),
        run(`brew leaves`, 30000),
        run(`brew --prefix`, 10000),
      ]);

    const version = versionRes.stdout.match(/Homebrew (\S+)/)?.[1] ?? null;
    const prefix = prefixRes.stdout.trim() || "/opt/homebrew";

    const outdated = JSON.parse(outdatedRes.stdout || "{}") as {
      formulae?: OutdatedEntry[];
      casks?: OutdatedEntry[];
    };
    const outdatedMap = new Map(
      (outdated.formulae ?? []).map((o) => [o.name, o.current_version])
    );
    const outdatedCaskMap = new Map(
      (outdated.casks ?? []).map((o) => [o.name, o.current_version])
    );
    const leaves = new Set(
      leavesRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean)
    );

    const parseList = (s: string) =>
      s
        .split("\n")
        .map((l) => l.trim().match(/^(\S+)\s+(\S+)/))
        .filter((m): m is RegExpMatchArray => !!m);

    const formulae = parseList(listRes.stdout).map((m) => ({
      name: m[1],
      version: m[2],
      outdated: outdatedMap.get(m[1]) ?? null,
      leaf: leaves.has(m[1]),
    }));
    const casks = parseList(caskRes.stdout).map((m) => ({
      name: m[1],
      version: m[2],
      outdated: outdatedCaskMap.get(m[1]) ?? null,
    }));

    return NextResponse.json({
      version,
      prefix,
      formulae,
      casks,
      outdatedCount: formulae.filter((f) => f.outdated).length,
      outdatedCaskCount: casks.filter((c) => c.outdated).length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
