import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** redis-cli INFO 输出解析（行尾为 \r\n） */
function parseInfo(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0 && !line.startsWith("#")) {
      map.set(line.slice(0, i), line.slice(i + 1));
    }
  }
  return map;
}

interface DbSample {
  db: number;
  keys: number;
  expires: number;
  sampleKeys: Array<{ key: string; type: string; ttl: number }>;
}

/** 取某个 db 的 key 样例（SCAN 前 15 个 + 类型 + TTL） */
async function sampleDb(db: number): Promise<DbSample["sampleKeys"]> {
  const scan = await run(`redis-cli -n ${db} scan 0 COUNT 30`, 10000);
  const lines = scan.stdout.split(/\r?\n/).filter(Boolean);
  const keys = lines.slice(1, 16); // 第一行是游标
  if (keys.length === 0) return [];

  // 管道批量执行 TYPE/TTL（key 中的双引号剔除，避免破坏命令）
  const cmds = keys
    .map((k) => {
      const safe = k.replace(/["\\]/g, "");
      return `TYPE "${safe}"\\nTTL "${safe}"`;
    })
    .join("\\n");
  const res = await run(`printf "${cmds}\\n" | redis-cli -n ${db}`, 15000);
  const out = res.stdout.split(/\r?\n/).filter(Boolean);

  return keys.map((key, i) => ({
    key,
    type: out[i * 2] ?? "?",
    ttl: Number(out[i * 2 + 1] ?? -1),
  }));
}

export async function GET() {
  const start = Date.now();

  const ping = await run(`redis-cli ping`, 8000);
  if (!ping.ok || !ping.stdout.includes("PONG")) {
    return NextResponse.json({
      status: "stopped",
      detail: ping.stderr.trim() || ping.stdout.trim() || null,
      durationMs: Date.now() - start,
    });
  }

  try {
    const [serverRes, memRes, clientRes, statsRes, keyspaceRes] = await Promise.all([
      run(`redis-cli info server`, 10000),
      run(`redis-cli info memory`, 10000),
      run(`redis-cli info clients`, 10000),
      run(`redis-cli info stats`, 10000),
      run(`redis-cli info keyspace`, 10000),
    ]);

    const server = parseInfo(serverRes.stdout);
    const mem = parseInfo(memRes.stdout);
    const clients = parseInfo(clientRes.stdout);
    const stats = parseInfo(statsRes.stdout);
    const keyspace = parseInfo(keyspaceRes.stdout);

    // keyspace 条目： db0:keys=3,expires=1,avg_ttl=0
    const dbs: DbSample[] = [];
    for (const [k, v] of keyspace) {
      const m = k.match(/^db(\d+)$/);
      if (!m) continue;
      const kv = Object.fromEntries(v.split(",").map((p) => p.split("=")));
      const db = Number(m[1]);
      dbs.push({
        db,
        keys: Number(kv.keys) || 0,
        expires: Number(kv.expires) || 0,
        sampleKeys: await sampleDb(db),
      });
    }
    dbs.sort((a, b) => a.db - b.db);

    return NextResponse.json({
      status: "running",
      version: server.get("redis_version"),
      mode: server.get("redis_mode"),
      port: server.get("tcp_port"),
      uptimeSeconds: Number(server.get("uptime_in_seconds")) || 0,
      usedMemory: mem.get("used_memory_human"),
      usedMemoryPeak: mem.get("used_memory_peak_human"),
      connectedClients: Number(clients.get("connected_clients")) || 0,
      totalCommands: stats.get("total_commands_processed"),
      totalKeys: dbs.reduce((s, d) => s + d.keys, 0),
      dbs,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
