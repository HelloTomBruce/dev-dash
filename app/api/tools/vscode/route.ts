import { NextResponse } from "next/server";
import { run } from "@/lib/detectors/utils/shell";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface VscodeProcess {
  pid: string;
  cpu: string;
  mem: string;
  name: string;
  indent: number;
  category: "main" | "gpu" | "window" | "extension-host" | "plugin" | "utility" | "other";
}

export interface VscodeWorkspace {
  windowTitle: string;
  folderName: string;
  fileCount: number;
  fileTypes: Record<string, number>;
  confFiles: Record<string, number>;
}

export interface VscodeExtension {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  description?: string;
  dirName: string;
}

interface SystemInfo {
  version?: string;
  commit?: string;
  osVersion?: string;
  cpus?: string;
  memorySystem?: string;
  loadAvg?: string;
  vm?: string;
}

function parseCodeStatus(out: string) {
  const lines = out.split(/\r?\n/);
  const sys: SystemInfo = {};
  const processes: VscodeProcess[] = [];
  const workspaces: VscodeWorkspace[] = [];

  let section: "header" | "processes" | "workspaces" | "gpu" = "header";
  let currentWorkspace: Partial<VscodeWorkspace> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("Version:")) {
      const vMatch = line.match(/Code\s+([^\s(]+)(?:\s*\(([^,]+))?/);
      if (vMatch) {
        sys.version = vMatch[1];
        sys.commit = vMatch[2];
      }
    } else if (line.startsWith("OS Version:")) {
      sys.osVersion = line.replace("OS Version:", "").trim();
    } else if (line.startsWith("CPUs:")) {
      sys.cpus = line.replace("CPUs:", "").trim();
    } else if (line.startsWith("Memory (System):")) {
      sys.memorySystem = line.replace("Memory (System):", "").trim();
    } else if (line.startsWith("Load (avg):")) {
      sys.loadAvg = line.replace("Load (avg):", "").trim();
    } else if (line.startsWith("VM:")) {
      sys.vm = line.replace("VM:", "").trim();
    }

    if (line.includes("CPU %") && line.includes("PID") && line.includes("Process")) {
      section = "processes";
      continue;
    }

    if (line.startsWith("Workspace Stats:")) {
      section = "workspaces";
      continue;
    }

    if (line.startsWith("GPU Status:")) {
      section = "gpu";
      continue;
    }

    if (section === "processes") {
      if (!line.trim() || line.startsWith("Workspace Stats:")) {
        if (line.startsWith("Workspace Stats:")) section = "workspaces";
        continue;
      }
      // 格式： 0  63331869760  20694  code
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
      if (match) {
        const rawName = match[4];
        const trimmedName = rawName.trim();
        const leadingSpaces = rawName.search(/\S/);
        const indent = Math.max(0, Math.floor(leadingSpaces / 2));

        let category: VscodeProcess["category"] = "other";
        if (trimmedName === "code") category = "main";
        else if (trimmedName.includes("gpu-process")) category = "gpu";
        else if (trimmedName.startsWith("window")) category = "window";
        else if (trimmedName.startsWith("extension-host")) category = "extension-host";
        else if (trimmedName.includes("Plugin") || trimmedName.includes("electron-nodejs") || trimmedName.includes("lsp") || trimmedName.includes("Server")) {
          category = "plugin";
        } else if (trimmedName.includes("utility") || trimmedName.includes("file-watcher") || trimmedName.includes("shared-process")) {
          category = "utility";
        }

        // 格式化内存：如果是超大数字（虚拟内存），转为可读大小
        const rawMem = Number(match[2]);
        let memStr = "";
        if (rawMem > 1024 * 1024 * 1024) {
          memStr = `${(rawMem / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        } else if (rawMem > 1024 * 1024) {
          memStr = `${(rawMem / (1024 * 1024)).toFixed(0)} MB`;
        } else {
          memStr = `${rawMem} MB`;
        }

        processes.push({
          cpu: `${match[1]}%`,
          mem: memStr,
          pid: match[3],
          name: trimmedName,
          indent,
          category,
        });
      }
    } else if (section === "workspaces") {
      // 匹配：|  Window (.gitignore — fastech-energy-web-main)
      const winMatch = line.match(/\|\s*Window\s*\(([^)]+)\)/);
      if (winMatch) {
        if (currentWorkspace?.folderName) {
          workspaces.push(currentWorkspace as VscodeWorkspace);
        }
        currentWorkspace = {
          windowTitle: winMatch[1].trim(),
          folderName: "",
          fileCount: 0,
          fileTypes: {},
          confFiles: {},
        };
        continue;
      }

      // 匹配：|    Folder (fastech-energy-web-main): 1890 files
      const folderMatch = line.match(/\|\s*Folder\s*\(([^)]+)\):\s*(\d+)\s*files/);
      if (folderMatch && currentWorkspace) {
        currentWorkspace.folderName = folderMatch[1].trim();
        currentWorkspace.fileCount = Number(folderMatch[2]);
        continue;
      }

      // 匹配文件类型：|      File types: ts(602) vue(580) ...
      if (line.includes("File types:") || (currentWorkspace && line.includes("(") && !line.includes("Conf files:"))) {
        const matches = line.matchAll(/([a-zA-Z0-9_-]+)\((\d+)\)/g);
        for (const m of matches) {
          if (currentWorkspace && currentWorkspace.fileTypes) {
            currentWorkspace.fileTypes[m[1]] = Number(m[2]);
          }
        }
      }

      // 匹配配置文件：|      Conf files: package.json(2) tsconfig.json(1) ...
      if (line.includes("Conf files:")) {
        const matches = line.matchAll(/([a-zA-Z0-9._-]+)\((\d+)\)/g);
        for (const m of matches) {
          if (currentWorkspace && currentWorkspace.confFiles) {
            currentWorkspace.confFiles[m[1]] = Number(m[2]);
          }
        }
      }
    }
  }

  if (currentWorkspace?.folderName) {
    workspaces.push(currentWorkspace as VscodeWorkspace);
  }

  return { sys, processes, workspaces };
}

async function getInstalledExtensions(): Promise<VscodeExtension[]> {
  const extDir = path.join(os.homedir(), ".vscode/extensions");
  const extMap = new Map<string, VscodeExtension>();

  try {
    const dirs = await fs.readdir(extDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const pkgJsonPath = path.join(extDir, d.name, "package.json");
      try {
        const raw = await fs.readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(raw);
        const publisher = pkg.publisher || d.name.split(".")[0] || "unknown";
        const name = pkg.name || d.name.split("-")[0] || d.name;
        const id = `${publisher}.${name}`;
        const item: VscodeExtension = {
          id,
          name,
          displayName: pkg.displayName || name,
          publisher,
          version: pkg.version || "unknown",
          description: pkg.description || "",
          dirName: d.name,
        };
        const existing = extMap.get(id);
        if (!existing || item.version > existing.version) {
          extMap.set(id, item);
        }
      } catch {
        // ignore malformed extension
      }
    }
  } catch {
    // extensions dir doesn't exist
  }

  const extensions = Array.from(extMap.values());
  extensions.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return extensions;
}

export async function GET(request: Request) {
  const start = Date.now();
  const url = new URL(request.url);
  const readFile = url.searchParams.get("file");

  const home = os.homedir();
  const settingsPath = path.join(home, "Library/Application Support/Code/User/settings.json");
  const keybindingsPath = path.join(home, "Library/Application Support/Code/User/keybindings.json");

  // 如果请求特定文件内容
  if (readFile === "settings") {
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      return NextResponse.json({ path: settingsPath, content });
    } catch (e) {
      return NextResponse.json({ path: settingsPath, content: "{\n}\n", error: String(e) });
    }
  } else if (readFile === "keybindings") {
    try {
      const content = await fs.readFile(keybindingsPath, "utf-8");
      return NextResponse.json({ path: keybindingsPath, content });
    } catch (e) {
      return NextResponse.json({ path: keybindingsPath, content: "[\n]\n", error: String(e) });
    }
  }

  // 检查 code 命令路径
  const whichRes = await run("which code 2>/dev/null", 3000);
  const codeBin = whichRes.ok && whichRes.stdout.trim()
    ? whichRes.stdout.trim()
    : "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";

  // 并行获取：版本、进程、状态输出、已安装插件、设置文件摘要
  const [versionRes, pgrepRes, statusRes, extensions, settingsStat] = await Promise.all([
    run(`"${codeBin}" --version 2>&1`, 8000),
    run('pgrep -f "Visual Studio Code|Code Helper"', 5000),
    run(`"${codeBin}" --status 2>&1`, 15000),
    getInstalledExtensions(),
    fs.stat(settingsPath).catch(() => null),
  ]);

  const pids = pgrepRes.stdout.trim().split("\n").filter(Boolean);
  const isRunning = pgrepRes.ok && pids.length > 0;

  const versionLines = versionRes.stdout.trim().split("\n");
  const version = versionLines[0] || "1.x";
  const commit = versionLines[1] || "";
  const arch = versionLines[2] || "arm64";

  const { sys, processes, workspaces } = parseCodeStatus(statusRes.stdout);

  return NextResponse.json({
    status: isRunning ? "running" : "stopped",
    version: sys.version || version,
    commit: sys.commit || commit,
    architecture: arch,
    codeBin,
    appPath: "/Applications/Visual Studio Code.app",
    settingsPath,
    settingsExists: !!settingsStat,
    processCount: isRunning ? Math.max(pids.length, processes.length) : 0,
    systemInfo: {
      ...sys,
      architecture: arch,
    },
    processes,
    workspaces,
    extensions,
    extensionsCount: extensions.length,
    statusRaw: statusRes.stdout.trim().slice(0, 10000),
    durationMs: Date.now() - start,
  });
}
