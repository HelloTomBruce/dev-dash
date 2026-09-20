import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** container 系统状态解析：退出码不可靠（有时 0 有时 1），按输出文本判断 */
function parseSystemStatus(out: string): {
  running: boolean;
  info: Record<string, string>;
} {
  if (out.includes("apiserver is not running")) {
    return { running: false, info: {} };
  }
  const info: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (m && m[1] !== "FIELD") info[m[1]] = m[2].trim();
  }
  return { running: info.status === "running", info };
}

/** 通用列表解析：优先 --format json，失败退回表格文本解析 */
async function listCmd(
  cmd: string,
  mapJson: (o: Record<string, unknown>) => Record<string, unknown>,
  mapText: (cols: string[]) => Record<string, unknown> | null
): Promise<Array<Record<string, unknown>>> {
  const res = await run(`${cmd} --format json`, 20000);
  const out = res.stdout.trim();
  if (out.startsWith("[")) {
    try {
      return (JSON.parse(out) as Array<Record<string, unknown>>).map(mapJson);
    } catch {
      /* fallthrough 到文本解析 */
    }
  }
  const textRes = await run(cmd, 20000);
  const lines = textRes.stdout.trim().split("\n");
  if (lines.length <= 1) return [];
  return lines
    .slice(1)
    .map((l) => mapText(l.trim().split(/\s{2,}|\s+/)))
    .filter((x): x is Record<string, unknown> => x !== null);
}

export async function GET() {
  const start = Date.now();
  try {
    const [statusRes, versionRes, kernelRes] = await Promise.all([
      run(`container system status`, 15000),
      run(`container --version`, 10000),
      run(
        `ls "${process.env.HOME}/Library/Application Support/com.apple.container/kernels/" 2>/dev/null | grep -c '^default.kernel'`,
        10000
      ),
    ]);

    const version = versionRes.stdout.match(/container CLI version (\S+)/)?.[1] ?? null;
    const kernelConfigured = Number(kernelRes.stdout.trim()) > 0;
    const { running, info } = parseSystemStatus(statusRes.stdout + statusRes.stderr);

    if (!running) {
      return NextResponse.json({
        status: "stopped",
        version,
        kernelConfigured,
        containers: [],
        images: [],
        durationMs: Date.now() - start,
      });
    }

    const [containers, images] = await Promise.all([
      listCmd(
        `container ls`,
        (o) => {
          const cfg = (o.configuration ?? {}) as Record<string, unknown>;
          const img = (cfg.image ?? {}) as Record<string, unknown>;
          const st = (o.status ?? {}) as Record<string, unknown>;
          const nets = (st.networks ?? []) as Array<Record<string, unknown>>;
          return {
            id: (o.id as string) ?? "?",
            image: (img.reference as string) ?? "?",
            state: (st.state as string) ?? "?",
            ip: (nets[0]?.ipv4Address as string)?.split("/")[0] ?? null,
          };
        },
        (cols) =>
          cols.length >= 2
            ? { id: cols[0], image: cols[1], state: cols.find((c) => /^(running|stopped|exited)$/i.test(c)) ?? "?", ip: null }
            : null
      ),
      listCmd(
        `container image ls`,
        (o) => {
          const cfg = (o.configuration ?? {}) as Record<string, unknown>;
          return {
            reference: (cfg.name as string) ?? "?",
            size: null,
          };
        },
        (cols) => (cols.length >= 1 ? { reference: cols[0], size: cols[cols.length - 1] } : null)
      ),
    ]);

    return NextResponse.json({
      status: "running",
      version,
      kernelConfigured,
      containers,
      images,
      systemInfo: {
        containersTotal: info["containers.total"],
        containersRunning: info["containers.running"],
        imagesTotal: info["images.total"],
        serverVersion: info["server.version"],
      },
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
