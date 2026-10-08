import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { run, extractVersion } from "@/lib/detectors/utils/shell";
import type { PipConfigInfo, PythonOverviewResult, PythonRuntimeInfo, VirtualEnvInfo } from "./types";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 识别 Python 解释器来源 */
function identifyRuntimeSource(p: string): PythonRuntimeInfo["source"] {
  if (p.startsWith("/opt/homebrew") || p.includes("Cellar")) return "brew";
  if (p.includes(".local/share/uv") || p.includes(".cache/uv")) return "uv";
  if (p.includes(".pyenv")) return "pyenv";
  if (p.startsWith("/usr/bin") || p.startsWith("/System")) return "system";
  return "other";
}

/** 扫描本机所有安装的 Python 解释器 */
async function scanPythonRuntimes(): Promise<PythonRuntimeInfo[]> {
  const runtimes: PythonRuntimeInfo[] = [];
  const seenPaths = new Set<string>();

  // 1. 获取默认 python3
  const whichRes = await run("which python3", 3000);
  const defaultPath = whichRes.ok ? whichRes.stdout.trim() : null;

  // 2. which -a python3
  const whichAllRes = await run("which -a python3 2>/dev/null", 3000);
  const rawPaths: string[] = [];
  if (whichAllRes.ok && whichAllRes.stdout) {
    for (const l of whichAllRes.stdout.split("\n")) {
      const line = l.trim();
      if (line && path.isAbsolute(line) && !line.includes("aliased to")) {
        rawPaths.push(line);
      }
    }
  }

  // 3. uv 托管的 python
  try {
    const uvRes = await run("uv python list --only-installed", 3000);
    if (uvRes.ok && uvRes.stdout) {
      for (const line of uvRes.stdout.split("\n")) {
        const parts = line.trim().split(/\s+/);
        const last = parts[parts.length - 1];
        if (last && path.isAbsolute(last)) {
          rawPaths.push(last);
        }
      }
    }
  } catch {
    // uv not installed
  }

  // 4. 去重并获取各个实例的版本
  for (const p of rawPaths) {
    if (seenPaths.has(p)) continue;
    seenPaths.add(p);

    let version: string | null = null;
    try {
      const vRes = await run(`"${p}" --version 2>&1`, 2500);
      version = extractVersion(vRes.stdout || vRes.stderr);
    } catch {
      // ignore
    }

    runtimes.push({
      path: p,
      version,
      source: identifyRuntimeSource(p),
      isDefault: p === defaultPath,
    });
  }

  return runtimes;
}

/** 检查并解析单个虚拟环境 */
async function inspectVirtualEnv(venvPath: string, projectName: string, projectPath: string, home: string): Promise<VirtualEnvInfo | null> {
  const cfgPath = path.join(venvPath, "pyvenv.cfg");
  let cfgContent = "";
  try {
    cfgContent = await fs.readFile(cfgPath, "utf-8");
  } catch {
    return null; // not a valid venv
  }

  // 解析 pyvenv.cfg
  let pythonVersion: string | null = null;
  let uvManaged = false;
  for (const line of cfgContent.split("\n")) {
    const [k, v] = line.split("=").map((s) => s.trim());
    if (k === "version_info" || k === "version") {
      pythonVersion = v;
    }
    if (k === "uv") {
      uvManaged = true;
    }
  }

  // 计算大小
  let sizeBytes = 0;
  try {
    const duRes = await run(`du -sk "${venvPath}" 2>/dev/null`, 4000);
    if (duRes.ok && duRes.stdout) {
      const kb = parseInt(duRes.stdout.trim().split(/\s+/)[0], 10);
      if (!isNaN(kb)) sizeBytes = kb * 1024;
    }
  } catch {
    // ignore
  }

  // 计算已安装包数量 (扫描 site-packages)
  let packageCount = 0;
  try {
    const libDir = path.join(venvPath, "lib");
    const pyDirs = await fs.readdir(/*turbopackIgnore: true*/ libDir);
    for (const pd of pyDirs) {
      if (pd.startsWith("python")) {
        const spDir = path.join(libDir, pd, "site-packages");
        const packages = await fs.readdir(/*turbopackIgnore: true*/ spDir);
        packageCount = packages.filter((pkg) => pkg.endsWith(".dist-info") || pkg.endsWith(".egg-info")).length;
        break;
      }
    }
  } catch {
    // ignore
  }

  const displayPath = venvPath.startsWith(home) ? `~${venvPath.slice(home.length)}` : venvPath;

  return {
    id: venvPath,
    projectName,
    projectPath,
    venvPath,
    displayPath,
    sizeBytes,
    humanSize: formatBytes(sizeBytes),
    pythonVersion,
    uvManaged,
    packageCount,
  };
}

/** 扫描本机项目下的虚拟环境 */
async function scanVirtualEnvs(home: string): Promise<VirtualEnvInfo[]> {
  const candidateRoots = [
    path.join(home, "code"),
    path.join(home, "Projects"),
    path.join(home, "workspace"),
    path.join(home, "dev"),
  ];

  const venvTargets: Array<{ venvPath: string; projectName: string; projectPath: string }> = [];

  for (const rootDir of candidateRoots) {
    try {
      const projects = await fs.readdir(/*turbopackIgnore: true*/ rootDir, { withFileTypes: true });
      for (const proj of projects) {
        if (!proj.isDirectory() || proj.name.startsWith(".")) continue;
        const projectPath = path.join(rootDir, proj.name);

        for (const venvDirName of [".venv", "venv", "env"]) {
          const venvPath = path.join(/*turbopackIgnore: true*/ projectPath, venvDirName);
          try {
            const stat = await fs.stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ venvPath, "pyvenv.cfg"));
            if (stat.isFile()) {
              venvTargets.push({
                venvPath,
                projectName: proj.name,
                projectPath,
              });
            }
          } catch {
            // not existing
          }
        }
      }
    } catch {
      // rootDir not existing
    }
  }

  const results = await Promise.all(
    venvTargets.map((t) => inspectVirtualEnv(t.venvPath, t.projectName, t.projectPath, home))
  );

  const valid = results.filter(Boolean) as VirtualEnvInfo[];
  valid.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return valid;
}

/** 扫描 pip 配置 */
async function scanPipConfig(): Promise<PipConfigInfo> {
  let indexUrl: string | null = null;
  let trustedHost: string | null = null;
  let extraIndexUrl: string | null = null;

  try {
    const res = await run("pip3 config list 2>/dev/null", 3000);
    if (res.ok && res.stdout) {
      for (const line of res.stdout.split("\n")) {
        const idx = line.indexOf("=");
        if (idx > 0) {
          const key = line.slice(0, idx).trim().replace(/^global\./, "");
          const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
          if (key === "index-url") indexUrl = val;
          if (key === "trusted-host") trustedHost = val;
          if (key === "extra-index-url") extraIndexUrl = val;
        }
      }
    }
  } catch {
    // ignore
  }

  return { indexUrl, trustedHost, extraIndexUrl };
}

export async function scanPythonOverview(): Promise<PythonOverviewResult> {
  const t0 = Date.now();
  const home = os.homedir();

  const [runtimes, virtualEnvs, pipConfig] = await Promise.all([
    scanPythonRuntimes(),
    scanVirtualEnvs(home),
    scanPipConfig(),
  ]);

  const totalVenvSizeBytes = virtualEnvs.reduce((sum, v) => sum + v.sizeBytes, 0);

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    runtimes,
    virtualEnvs,
    totalVenvSizeBytes,
    totalVenvHumanSize: formatBytes(totalVenvSizeBytes),
    pipConfig,
  };
}
