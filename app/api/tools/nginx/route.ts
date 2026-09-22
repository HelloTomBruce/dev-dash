import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NginxLocation {
  path: string;
  target: string;
  type: "proxy" | "root" | "alias" | "return" | "other";
}

interface NginxServerBlock {
  file: string;
  relPath: string;
  listen: string[];
  serverNames: string[];
  root?: string;
  locations: NginxLocation[];
  ssl: boolean;
}

interface ProcessInfo {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  command: string;
}

interface ConfigFileInfo {
  path: string;
  name: string;
  relPath: string;
  size: number;
  updatedAt: string;
}

/** 简单的 Nginx 配置块提取 */
function parseServerBlocks(content: string, filePath: string, baseDir: string): NginxServerBlock[] {
  const blocks: NginxServerBlock[] = [];
  const relPath = path.relative(baseDir, filePath);

  // 匹配 server { ... } 结构（考虑大括号嵌套）
  let depth = 0;
  let inServer = false;
  let currentServerText = "";

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    // 简单跳过注释
    if (ch === "#") {
      const nextNewline = content.indexOf("\n", i);
      if (nextNewline === -1) break;
      i = nextNewline;
      continue;
    }

    if (ch === "{" ) {
      if (!inServer) {
        // 检查前面是否有 server 关键字
        const prevWords = content.slice(Math.max(0, i - 20), i).trim();
        if (/\bserver\s*$/.test(prevWords)) {
          inServer = true;
          depth = 1;
          currentServerText = "";
          continue;
        }
      } else {
        depth++;
      }
    } else if (ch === "}") {
      if (inServer) {
        depth--;
        if (depth === 0) {
          inServer = false;
          // 解析已收集到的 server 块内容
          blocks.push(parseSingleServer(currentServerText, filePath, relPath));
          currentServerText = "";
          continue;
        }
      }
    }

    if (inServer) {
      currentServerText += ch;
    }
  }

  return blocks;
}

function parseSingleServer(blockText: string, filePath: string, relPath: string): NginxServerBlock {
  const listen: string[] = [];
  const serverNames: string[] = [];
  let root: string | undefined;
  let ssl = false;

  const listenMatches = blockText.matchAll(/\blisten\s+([^;]+);/g);
  for (const m of listenMatches) {
    const val = m[1].trim();
    listen.push(val);
    if (val.includes("ssl") || val.includes("443")) ssl = true;
  }

  const nameMatches = blockText.matchAll(/\bserver_name\s+([^;]+);/g);
  for (const m of nameMatches) {
    const names = m[1].trim().split(/\s+/).filter(Boolean);
    serverNames.push(...names);
  }

  const rootMatch = blockText.match(/\broot\s+([^;]+);/);
  if (rootMatch) {
    root = rootMatch[1].trim();
  }

  const sslCertMatch = blockText.match(/\bssl_certificate\b/);
  if (sslCertMatch) {
    ssl = true;
  }

  // 提取 location 块
  const locations: NginxLocation[] = [];
  const locRegex = /\blocation\s+([^{]+)\{([^}]+)\}/g;
  let locMatch;
  while ((locMatch = locRegex.exec(blockText)) !== null) {
    const locPath = locMatch[1].trim();
    const locBody = locMatch[2];

    const proxyPass = locBody.match(/\bproxy_pass\s+([^;]+);/);
    const alias = locBody.match(/\balias\s+([^;]+);/);
    const locRoot = locBody.match(/\broot\s+([^;]+);/);
    const ret = locBody.match(/\breturn\s+([^;]+);/);

    if (proxyPass) {
      locations.push({ path: locPath, target: proxyPass[1].trim(), type: "proxy" });
    } else if (alias) {
      locations.push({ path: locPath, target: alias[1].trim(), type: "alias" });
    } else if (locRoot) {
      locations.push({ path: locPath, target: locRoot[1].trim(), type: "root" });
    } else if (ret) {
      locations.push({ path: locPath, target: ret[1].trim(), type: "return" });
    } else {
      locations.push({ path: locPath, target: "(directive block)", type: "other" });
    }
  }

  return {
    file: filePath,
    relPath,
    listen: listen.length ? listen : ["80"],
    serverNames: serverNames.length ? serverNames : ["_"],
    root,
    locations,
    ssl,
  };
}

async function readTail(filePath: string, lines = 50): Promise<string[]> {
  try {
    const res = await run(`tail -n ${lines} "${filePath}" 2>/dev/null`, 5000);
    if (!res.ok || !res.stdout.trim()) return [];
    return res.stdout.trim().split("\n");
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const start = Date.now();
  const url = new URL(request.url);
  const requestedFile = url.searchParams.get("file");

  const [versionRes, pgrepRes, psRes, testRes] = await Promise.all([
    run("nginx -V 2>&1", 8000),
    run("pgrep nginx", 5000),
    run("ps -eo pid,user,%cpu,%mem,command | grep '[n]ginx' | grep -v grep", 5000),
    run("nginx -t 2>&1", 8000),
  ]);

  const pids = pgrepRes.stdout.trim().split("\n").filter(Boolean);
  const isRunning = pgrepRes.ok && pids.length > 0;

  // 解析 Nginx -V 信息
  const rawV = versionRes.stdout;
  const versionMatch = rawV.match(/nginx version:\s*nginx\/(\S+)/);
  const version = versionMatch ? `nginx/${versionMatch[1]}` : "nginx";
  const confPathMatch = rawV.match(/--conf-path=([^\s]+)/);
  const confPath = confPathMatch ? confPathMatch[1] : "/opt/homebrew/etc/nginx/nginx.conf";
  const confDir = path.dirname(confPath);
  const prefixMatch = rawV.match(/--prefix=([^\s]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : "/opt/homebrew";
  const logPathMatch = rawV.match(/--http-log-path=([^\s]+)/);
  const logDir = logPathMatch ? path.dirname(logPathMatch[1]) : "/opt/homebrew/var/log/nginx";
  const errorLogMatch = rawV.match(/--error-log-path=([^\s]+)/);
  const accessLogPath = logPathMatch ? logPathMatch[1] : path.join(logDir, "access.log");
  const errorLogPath = errorLogMatch ? errorLogMatch[1] : path.join(logDir, "error.log");

  // 如果请求特定文件内容
  if (requestedFile) {
    const normalized = path.normalize(requestedFile);
    if (
      (!normalized.startsWith(confDir) && !normalized.startsWith("/etc/nginx")) ||
      normalized.includes("..")
    ) {
      return NextResponse.json({ error: "非法文件路径" }, { status: 400 });
    }
    try {
      const content = await fs.readFile(normalized, "utf-8");
      return NextResponse.json({ file: normalized, content });
    } catch (e) {
      return NextResponse.json({ error: `读取文件失败: ${String(e)}` }, { status: 404 });
    }
  }

  // 解析进程列表
  const processes: ProcessInfo[] = [];
  for (const line of psRes.stdout.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      processes.push({
        pid: parts[0],
        user: parts[1],
        cpu: `${parts[2]}%`,
        mem: `${parts[3]}%`,
        command: parts.slice(4).join(" "),
      });
    }
  }

  // 扫描配置文件列表
  const configFiles: ConfigFileInfo[] = [];
  async function scanDir(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".conf") || entry.name.includes("mime.types") || entry.name.endsWith(".default") || entry.name === "nginx.conf")) {
          const stat = await fs.stat(fullPath);
          configFiles.push({
            path: fullPath,
            name: entry.name,
            relPath: path.relative(confDir, fullPath),
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    } catch {
      // ignore
    }
  }
  await scanDir(confDir);

  // 解析 Server blocks
  const serverBlocks: NginxServerBlock[] = [];
  try {
    if (await fs.stat(confPath).catch(() => null)) {
      const mainContent = await fs.readFile(confPath, "utf-8");
      serverBlocks.push(...parseServerBlocks(mainContent, confPath, confDir));
    }
  } catch {}

  const serversDir = path.join(confDir, "servers");
  try {
    const serverFiles = await fs.readdir(serversDir).catch(() => []);
    for (const file of serverFiles) {
      if (file.endsWith(".conf")) {
        const full = path.join(serversDir, file);
        const c = await fs.readFile(full, "utf-8").catch(() => "");
        serverBlocks.push(...parseServerBlocks(c, full, confDir));
      }
    }
  } catch {}

  // 日志读取
  const [accessLogs, errorLogs] = await Promise.all([
    readTail(accessLogPath, 40),
    readTail(errorLogPath, 40),
  ]);

  // 构建参数
  const configureArgs = (rawV.match(/configure arguments:\s*(.+)/)?.[1] ?? "")
    .split(/\s+(?=--)/)
    .map((s) => s.trim())
    .filter(Boolean);

  return NextResponse.json({
    status: isRunning ? "running" : "stopped",
    version,
    prefix,
    confPath,
    confDir,
    serversDir,
    logDir,
    accessLogPath,
    errorLogPath,
    testResult: {
      ok: testRes.ok,
      output: testRes.stdout.trim(),
    },
    processCount: pids.length,
    processes,
    servers: serverBlocks,
    configFiles,
    accessLogs,
    errorLogs,
    buildInfo: {
      raw: rawV,
      configureArgs,
    },
    durationMs: Date.now() - start,
  });
}
