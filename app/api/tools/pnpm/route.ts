import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** store 占用计算较慢（可能数 GB），单独 ?sizes=1 获取 + 10 分钟缓存 */
let storeSizeCache: { at: number; size: string | null } | null = null;

async function getStoreSize(storePath: string) {
  if (storeSizeCache && Date.now() - storeSizeCache.at < 600_000) {
    return storeSizeCache.size;
  }
  const res = await run(`du -sh "${storePath}" 2>/dev/null`, 90_000);
  const size = res.stdout.trim().split(/\s+/)[0] ?? null;
  storeSizeCache = { at: Date.now(), size };
  return size;
}

export async function GET(request: Request) {
  const start = Date.now();

  if (new URL(request.url).searchParams.get("sizes") === "1") {
    const storeRes = await run(`pnpm store path`, 10000);
    const size = await getStoreSize(storeRes.stdout.trim());
    return NextResponse.json({ storeSize: size, durationMs: Date.now() - start });
  }

  try {
    const [versionRes, lsRes, rootRes, storeRes] = await Promise.all([
      run(`pnpm --version`, 10000),
      run(`pnpm ls -g --depth=0 --json 2>/dev/null`, 30000),
      run(`pnpm root -g`, 10000),
      run(`pnpm store path`, 10000),
    ]);

    const version = versionRes.stdout.trim();
    const storePath = storeRes.stdout.trim();

    // 全局目录配置问题诊断：root -g 报错 bin 目录不在 PATH
    const rootErr = (rootRes.stderr || "").trim();
    const configIssue = rootErr.includes("not in PATH")
      ? rootErr.split("\n")[0]
      : null;
    const globalRoot = rootRes.ok ? rootRes.stdout.trim() : null;

    // 全局包（JSON 数组，可能为空）
    let packages: Array<{ name: string; version: string | null }> = [];
    try {
      const arr = JSON.parse(lsRes.stdout.trim() || "[]") as Array<{
        dependencies?: Record<string, { version?: string }>;
      }>;
      packages = arr.flatMap((proj) =>
        Object.entries(proj.dependencies ?? {}).map(([name, info]) => ({
          name,
          version: info?.version ?? null,
        }))
      );
    } catch {
      /* 输出非 JSON 时保持空 */
    }

    return NextResponse.json({
      version,
      packages,
      globalRoot,
      configIssue,
      storePath,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
