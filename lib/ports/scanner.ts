import { run } from "@/lib/detectors/utils/shell";

export type PortCategory = "dev-server" | "database" | "tool" | "app" | "system";

export interface PortItem {
  id: string; // unique key: `${port}-${pid}-${family}`
  port: number;
  protocol: string; // "TCP"
  family: "IPv4" | "IPv6";
  address: string;
  rawNode: string; // e.g. "*:3000" or "127.0.0.1:3456"
  pid: number;
  processName: string;
  command: string;
  user: string;
  cpuPercent?: number;
  memPercent?: number;
  category: PortCategory;
  tag?: string;
  isSelf?: boolean;
}

export interface PortsScanResult {
  scannedAt: string;
  durationMs: number;
  total: number;
  devPortsCount: number;
  ports: PortItem[];
}

/** 识别已知端口或进程标签 */
function identifyPort(port: number, processName: string, command: string): { category: PortCategory; tag?: string } {
  const pName = processName.toLowerCase();
  const cmd = command.toLowerCase();

  // 常见数据库与缓存
  if (port === 5432 || port === 5433 || pName.includes("postgres") || cmd.includes("postgres")) {
    return { category: "database", tag: "PostgreSQL" };
  }
  if (port === 6379 || port === 6380 || pName.includes("redis") || cmd.includes("redis-server")) {
    return { category: "database", tag: "Redis" };
  }
  if (port === 3306 || port === 33060 || pName.includes("mysqld") || cmd.includes("mysql")) {
    return { category: "database", tag: "MySQL" };
  }
  if (port === 27017 || pName.includes("mongod") || cmd.includes("mongod")) {
    return { category: "database", tag: "MongoDB" };
  }
  if ((port === 80 || port === 443 || port === 8080) && pName.includes("nginx")) {
    return { category: "dev-server", tag: "Nginx" };
  }

  // 常见开发服务
  if (cmd.includes("next dev") || cmd.includes("next start") || cmd.includes("next-server")) {
    return { category: "dev-server", tag: "Next.js" };
  }
  if (cmd.includes("vite") || port === 5173 || port === 5174) {
    return { category: "dev-server", tag: "Vite" };
  }
  if (cmd.includes("webpack") || port === 8080 || port === 8081) {
    return { category: "dev-server", tag: "Webpack / DevServer" };
  }
  if (cmd.includes("astro") || port === 4321) {
    return { category: "dev-server", tag: "Astro" };
  }
  if (cmd.includes("nuxt") || cmd.includes("remix")) {
    return { category: "dev-server", tag: "Web Dev" };
  }
  if (cmd.includes("uvicorn") || cmd.includes("gunicorn") || cmd.includes("fastapi") || cmd.includes("flask") || cmd.includes("django")) {
    return { category: "dev-server", tag: "Python Web" };
  }
  if (cmd.includes("go run") || cmd.includes("gin") || cmd.includes("fiber")) {
    return { category: "dev-server", tag: "Go Server" };
  }
  if (cmd.includes("cargo") || cmd.includes("actix") || cmd.includes("axum") || cmd.includes("tokio")) {
    return { category: "dev-server", tag: "Rust Server" };
  }
  if (port === 3000 || port === 3100 || port === 5000 || port === 5001 || port === 8000 || port === 8001 || port === 8888 || port === 9000) {
    if (pName === "node" || pName === "bun" || pName === "deno" || pName === "python" || pName === "python3") {
      return { category: "dev-server", tag: `${pName} Server` };
    }
  }

  // 工具与调试器
  if (cmd.includes("workbuddy") || pName.includes("workbuddy") || cmd.includes("codebuddy")) {
    return { category: "tool", tag: "WorkBuddy (Sidecar/MCP)" };
  }
  if (port === 9222 || port === 9229 || cmd.includes("--inspect")) {
    return { category: "tool", tag: "Node/Chrome Debugger" };
  }
  if (pName.includes("docker") || cmd.includes("docker") || pName.includes("containerd")) {
    return { category: "tool", tag: "Docker" };
  }
  if (pName.includes("zed") || pName.includes("code") || pName.includes("electron") || pName.includes("cursor")) {
    return { category: "tool", tag: "Editor / IDE" };
  }
  if (pName.includes("wechat") || pName.includes("feishu") || pName.includes("slack") || pName.includes("chrome") || pName.includes("safari")) {
    return { category: "app", tag: "Desktop App" };
  }
  if (pName === "rapportd" || pName === "controlcenter" || pName === "launchd" || pName === "systemstats" || pName === "cupsd") {
    return { category: "system", tag: "macOS System" };
  }

  // 默认推断
  if (pName === "node" || pName === "python" || pName === "python3" || pName === "bun" || pName === "deno" || pName === "ruby" || pName === "java") {
    return { category: "dev-server", tag: `${processName} Server` };
  }

  return { category: "tool" };
}

export async function scanListeningPorts(): Promise<PortsScanResult> {
  const t0 = Date.now();
  const selfPid = process.pid;

  // 1. 获取所有监听中的 TCP 端口
  // 2. 获取 ps 进程清单（CPU、内存、完整命令行）
  const [lsofRes, psRes] = await Promise.all([
    run("lsof -iTCP -sTCP:LISTEN -P -n", 6000),
    run("ps -eo pid,user,%cpu,%mem,command", 6000),
  ]);

  // 解析 ps 输出: pid -> { user, cpu, mem, command }
  const psMap = new Map<number, { user: string; cpu: number; mem: number; command: string }>();
  if (psRes.ok && psRes.stdout) {
    const lines = psRes.stdout.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // PID USER %CPU %MEM COMMAND
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const pid = parseInt(parts[0], 10);
        const user = parts[1];
        const cpu = parseFloat(parts[2]) || 0;
        const mem = parseFloat(parts[3]) || 0;
        const command = parts.slice(4).join(" ");
        if (!isNaN(pid)) {
          psMap.set(pid, { user, cpu, mem, command });
        }
      }
    }
  }

  const items: PortItem[] = [];
  const seenKey = new Set<string>();

  if (lsofRes.stdout) {
    const lines = lsofRes.stdout.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // lsof columns: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
      const parts = line.split(/\s+/);
      if (parts.length < 8) continue;

      const processName = parts[0];
      const pid = parseInt(parts[1], 10);
      const user = parts[2];
      const type = parts[4]; // IPv4 or IPv6

      // 从行尾或 NAME 列提取 IP 与端口
      // 常见格式: "TCP *:3000 (LISTEN)", "TCP 127.0.0.1:8080 (LISTEN)", "TCP [::1]:5432 (LISTEN)", "*:55967 (LISTEN)"
      const match = line.match(/(?:TCP\s+)?(\*|\[[a-f0-9:]+\]|[0-9.]+|localhost):(\d+)\s+\(LISTEN\)/i);
      if (!match) continue;

      const rawAddr = match[1];
      const port = parseInt(match[2], 10);
      if (isNaN(port) || isNaN(pid)) continue;

      const family: "IPv4" | "IPv6" = type === "IPv6" ? "IPv6" : "IPv4";
      const key = `${port}-${pid}-${family}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);

      const psInfo = psMap.get(pid);
      const fullCmd = psInfo?.command || processName;
      const { category, tag } = identifyPort(port, processName, fullCmd);

      items.push({
        id: key,
        port,
        protocol: "TCP",
        family,
        address: rawAddr,
        rawNode: `${rawAddr}:${port}`,
        pid,
        processName,
        command: fullCmd,
        user: psInfo?.user || user,
        cpuPercent: psInfo?.cpu,
        memPercent: psInfo?.mem,
        category,
        tag,
        isSelf: pid === selfPid,
      });
    }
  }

  // 排序：开发服务与数据库排前面，然后按端口号升序
  const categoryOrder: Record<PortCategory, number> = {
    "dev-server": 1,
    "database": 2,
    "tool": 3,
    "app": 4,
    "system": 5,
  };

  items.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return a.port - b.port;
  });

  const devPortsCount = items.filter(
    (item) => item.category === "dev-server" || item.category === "database"
  ).length;

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    total: items.length,
    devPortsCount,
    ports: items,
  };
}
