import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    const [versionRes, toolsRes, pythonsRes] = await Promise.all([
      run(`uv --version`, 10000),
      run(`uv tool list`, 20000),
      run(`uv python list --only-installed`, 20000),
    ]);

    const version = versionRes.stdout.match(/uv\s+(\S+)/)?.[1] ?? null;

    // uv tool list：名称行 "name v1.2.3" + 后续 "- bin" 行
    // 注意：先判断 bin 行（bin 可能以 v 开头，如 "- vikingbot"）
    const tools: Array<{ name: string; version: string; bins: string[] }> = [];
    for (const line of toolsRes.stdout.split("\n")) {
      const t = line.trim();
      if (t.startsWith("- ")) {
        if (tools.length > 0) tools[tools.length - 1].bins.push(t.slice(2));
        continue;
      }
      const m = t.match(/^(\S+)\s+v(\S+)$/);
      if (m) {
        tools.push({ name: m[1], version: m[2], bins: [] });
      }
    }

    // uv python list：按版本去重，路径取 -> 后的真实路径，按全行判断是否 uv 托管
    const seen = new Set<string>();
    const pythons: Array<{
      version: string;
      implementation: string;
      path: string;
      managedByUv: boolean;
    }> = [];
    for (const line of pythonsRes.stdout.split("\n")) {
      const t = line.trim();
      const m = t.match(/^(cpython|pypy)-(\d+\.\d+\.\d+)-\S+\s+(.+)$/);
      if (!m || seen.has(m[2])) continue;
      seen.add(m[2]);
      const pathPart = m[3].includes("->") ? m[3].split("->")[1].trim() : m[3].trim();
      pythons.push({
        version: m[2],
        implementation: m[1],
        path: pathPart,
        managedByUv: t.includes("/uv/python/"),
      });
    }
    pythons.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

    return NextResponse.json({
      version,
      tools,
      pythons,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
