import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * psql 查询辅助：-X 忽略 psqlrc，-A 不对齐，-t 只要数据行，-F '|' 分隔符
 */
async function query(sql: string) {
  return run(
    `psql -d postgres -X -A -t -F '|' -c "${sql.replace(/"/g, '\\"')}"`,
    15000
  );
}

export async function GET() {
  const start = Date.now();

  // 1. 服务状态
  const ready = await run(`pg_isready`, 8000);
  if (!ready.ok) {
    return NextResponse.json({
      status: "stopped",
      detail: ready.stderr.trim() || ready.stdout.trim() || null,
      durationMs: Date.now() - start,
    });
  }

  try {
    const [infoRes, dbRes, roleRes, connRes] = await Promise.all([
      query(
        `SELECT current_setting('server_version'), current_setting('port'), current_setting('data_directory')`
      ),
      query(
        `SELECT datname, pg_size_pretty(pg_database_size(datname)), pg_get_userbyid(datdba), (SELECT count(*) FROM pg_stat_activity a WHERE a.datname = d.datname) FROM pg_database d WHERE NOT datistemplate ORDER BY datname`
      ),
      query(
        `SELECT rolname, rolsuper, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg\\_%' ORDER BY rolname`
      ),
      query(`SELECT count(*) FROM pg_stat_activity`),
    ]);

    const [serverVersion, port, dataDir] = infoRes.stdout.trim().split("|");

    const databases = dbRes.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, size, owner, connections] = line.split("|");
        return { name, size, owner, connections: Number(connections) || 0 };
      });

    const roles = roleRes.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, rolsuper, rolcreatedb, rolcanlogin] = line.split("|");
        const attrs: string[] = [];
        if (rolsuper === "t") attrs.push("superuser");
        if (rolcreatedb === "t") attrs.push("createdb");
        if (rolcanlogin === "t") attrs.push("login");
        return { name, attrs };
      });

    return NextResponse.json({
      status: "running",
      detail: ready.stdout.trim(),
      serverVersion,
      port,
      dataDir,
      connections: Number(connRes.stdout.trim()) || 0,
      databases,
      roles,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
