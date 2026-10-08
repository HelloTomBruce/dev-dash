import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getLoginPath, resetLoginPath, run, extractVersion } from "@/lib/detectors/utils/shell";

export interface PathEntry {
  index: number;
  rawPath: string;
  displayPath: string;
  exists: boolean;
  isDuplicate: boolean;
  sourceTag: string;
  writable: boolean;
}

export interface BinaryInstance {
  path: string;
  version: string | null;
  source: string;
}

export interface BinaryShadow {
  name: string;
  label: string;
  active: BinaryInstance;
  shadowed: BinaryInstance[];
}

export interface DoctorSuggestion {
  id: string;
  level: "warning" | "info";
  title: string;
  detail: string;
  fixTip: string;
}

export interface DoctorScanResult {
  scannedAt: string;
  durationMs: number;
  healthScore: number;
  totalPathEntries: number;
  uniquePathCount: number;
  duplicateCount: number;
  deadCount: number;
  shadowedCount: number;
  paths: PathEntry[];
  shadowedBinaries: BinaryShadow[];
  suggestions: DoctorSuggestion[];
}

/** 识别 PATH 路径来源 */
function identifyPathSource(p: string): string {
  const norm = p.replace(/\/+$/, "");
  if (norm.startsWith("/opt/homebrew") || norm.startsWith("/usr/local/Homebrew")) return "Homebrew";
  if (norm.includes(".nvm")) return "NVM (Node)";
  if (norm.includes(".pyenv")) return "Pyenv (Python)";
  if (norm.includes(".local/bin")) return "User Local (~/.local/bin)";
  if (norm.includes(".cargo/bin")) return "Cargo (Rust)";
  if (norm.includes("go/bin")) return "Go (GOPATH)";
  if (norm.includes(".npm-global") || norm.includes("npm/bin")) return "npm 全局";
  if (norm.includes("pnpm")) return "pnpm 全局";
  if (norm.includes(".opencode")) return "OpenCode";
  if (norm.includes(".gemini") || norm.includes("antigravity")) return "Antigravity";
  if (norm.includes("/usr/local/bin")) return "Local Bin (/usr/local/bin)";
  if (norm.startsWith("/System") || norm.startsWith("/usr/bin") || norm.startsWith("/bin") || norm.startsWith("/usr/sbin") || norm.startsWith("/sbin")) {
    return "macOS 系统";
  }
  if (norm.includes("/var/folders/") || norm.includes("/tmp/")) return "临时会话 PATH";
  return "用户自定义";
}

/** 识别二进制来源 */
function identifyBinarySource(binPath: string): string {
  if (binPath.startsWith("/opt/homebrew") || binPath.startsWith("/usr/local/Cellar")) return "Homebrew";
  if (binPath.includes(".cargo/bin")) return "Cargo / Rust";
  if (binPath.includes("go/bin")) return "Go";
  if (binPath.includes(".nvm")) return "NVM";
  if (binPath.includes(".pyenv")) return "Pyenv";
  if (binPath.includes(".local/bin")) return "Local (~/.local/bin)";
  if (binPath.includes(".npm-global") || binPath.includes("npm/bin")) return "npm global";
  if (binPath.includes("pnpm")) return "pnpm";
  if (binPath.startsWith("/usr/bin") || binPath.startsWith("/bin") || binPath.startsWith("/System")) return "macOS 系统内置";
  if (binPath.startsWith("/usr/local/bin")) return "/usr/local/bin (n/手动)";
  return "自定义路径";
}

/** 关键常用开发工具列表 */
const KEY_BINARIES = [
  { name: "node", label: "Node.js", versionCmd: "node -v" },
  { name: "python3", label: "Python 3", versionCmd: "python3 --version" },
  { name: "git", label: "Git", versionCmd: "git --version" },
  { name: "go", label: "Go", versionCmd: "go version" },
  { name: "rustc", label: "Rustc", versionCmd: "rustc --version" },
  { name: "cargo", label: "Cargo", versionCmd: "cargo --version" },
  { name: "npm", label: "npm", versionCmd: "npm -v" },
  { name: "pnpm", label: "pnpm", versionCmd: "pnpm -v" },
  { name: "yarn", label: "Yarn", versionCmd: "yarn -v" },
  { name: "uv", label: "uv", versionCmd: "uv --version" },
  { name: "brew", label: "Homebrew", versionCmd: "brew --version" },
  { name: "gh", label: "GitHub CLI", versionCmd: "gh --version" },
  { name: "docker", label: "Docker", versionCmd: "docker --version" },
  { name: "nginx", label: "Nginx", versionCmd: "nginx -v" },
  { name: "psql", label: "PostgreSQL", versionCmd: "psql --version" },
  { name: "redis-server", label: "Redis", versionCmd: "redis-server --version" },
];

export async function runEnvironmentDoctor(force = false): Promise<DoctorScanResult> {
  const t0 = Date.now();
  const home = os.homedir();

  if (force) {
    resetLoginPath();
  }

  // 1. 获取登录 PATH
  const rawPathStr = (await getLoginPath()) || process.env.PATH || "";
  const rawSegments = rawPathStr.split(":").map((s) => s.trim()).filter(Boolean);

  // 2. 检查 PATH 各目录存在性、重复性、权限
  const seenPaths = new Set<string>();
  const duplicatePaths = new Set<string>();
  const pathEntries: PathEntry[] = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const p = rawSegments[i];
    const isDup = seenPaths.has(p);
    if (isDup) duplicatePaths.add(p);
    seenPaths.add(p);

    let exists = false;
    let writable = false;
    try {
      const st = await fs.stat(p);
      exists = st.isDirectory();
      if (exists) {
        try {
          await fs.access(p, fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
      }
    } catch {
      exists = false;
    }

    const display = p.startsWith(home) ? `~${p.slice(home.length)}` : p;
    pathEntries.push({
      index: i + 1,
      rawPath: p,
      displayPath: display,
      exists,
      isDuplicate: isDup,
      sourceTag: identifyPathSource(p),
      writable,
    });
  }

  // 3. 扫描多版本遮蔽
  const shadowResults: BinaryShadow[] = [];

  // 并行检测各个 binary
  const binaryChecks = KEY_BINARIES.map(async (tool) => {
    try {
      // 在登录 shell 环境执行 which -a
      const whichRes = await run(`which -a "${tool.name}" 2>/dev/null`, 3000);
      if (!whichRes.ok || !whichRes.stdout.trim()) return null;

      const rawLines = whichRes.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.includes("aliased to") && path.isAbsolute(l));

      // 去重保持顺序
      const uniqueBins = Array.from(new Set(rawLines));
      if (uniqueBins.length <= 1) return null; // 没有发生遮蔽

      // 获取各实例的版本
      const instances: BinaryInstance[] = await Promise.all(
        uniqueBins.map(async (binPath) => {
          let version: string | null = null;
          try {
            const vRes = await run(`"${binPath}" --version 2>&1 || "${binPath}" -v 2>&1`, 2500);
            if (vRes.stdout || vRes.stderr) {
              version = extractVersion(vRes.stdout || vRes.stderr);
            }
          } catch {
            // ignore
          }
          return {
            path: binPath,
            version,
            source: identifyBinarySource(binPath),
          };
        })
      );

      return {
        name: tool.name,
        label: tool.label,
        active: instances[0],
        shadowed: instances.slice(1),
      };
    } catch {
      return null;
    }
  });

  const resolvedBinaries = (await Promise.all(binaryChecks)).filter(Boolean) as BinaryShadow[];
  shadowResults.push(...resolvedBinaries);

  // 4. 生成诊断建议与健康评分
  const suggestions: DoctorSuggestion[] = [];
  const deadEntries = pathEntries.filter((p) => !p.exists);
  const dupEntries = pathEntries.filter((p) => p.isDuplicate);

  if (dupEntries.length > 0) {
    const dupNames = Array.from(duplicatePaths).map((p) => p.startsWith(home) ? `~${p.slice(home.length)}` : p);
    suggestions.push({
      id: "dup-paths",
      level: "warning",
      title: `发现 ${dupEntries.length} 处重复的 PATH 路径`,
      detail: `重复路径不会提升查找速度，反而拉长查找时间并增加排查困扰：${dupNames.slice(0, 3).join(", ")}${dupNames.length > 3 ? " 等" : ""}`,
      fixTip: "建议检查 ~/.zshrc 或 ~/.zprofile，使用 typeset -U path 自动去重，或移除重复的 export PATH 语句。",
    });
  }

  if (deadEntries.length > 0) {
    const deadNames = deadEntries.map((p) => p.displayPath);
    suggestions.push({
      id: "dead-paths",
      level: "warning",
      title: `发现 ${deadEntries.length} 个不存在的失效 PATH 路径`,
      detail: `以下目录在磁盘上不存在，系统搜索命令时会产生无谓的 I/O：${deadNames.slice(0, 3).join(", ")}${deadNames.length > 3 ? " 等" : ""}`,
      fixTip: "通常是由于软件卸载或临时会话残留，建议从 ~/.zshrc 中移除对应目录声明。",
    });
  }

  if (shadowResults.length > 0) {
    for (const sh of shadowResults) {
      suggestions.push({
        id: `shadow-${sh.name}`,
        level: "info",
        title: `${sh.label} 存在多版本，当前生效的是 ${sh.active.source} 版本`,
        detail: `当前正使用 ${sh.active.path} (版本: ${sh.active.version ?? "未知"})，被遮蔽的有: ${sh.shadowed.map((s) => `${s.source} (${s.path})`).join("、")}`,
        fixTip: "若需使用被遮蔽的版本，可调整 PATH 目录前后顺序，或通过对应版本管理器 (如 n / pyenv / mise) 进行版本切换。",
      });
    }
  }

  // 计算健康评分 (满分 100)
  // 每个死路径扣 10 分，每个重复扣 5 分，发生多版本遮蔽扣 2 分 (多版本有时是正常现象)
  let score = 100;
  score -= deadEntries.length * 10;
  score -= dupEntries.length * 5;
  score -= Math.min(shadowResults.length * 2, 10);
  score = Math.max(score, 10);

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    healthScore: score,
    totalPathEntries: pathEntries.length,
    uniquePathCount: seenPaths.size,
    duplicateCount: dupEntries.length,
    deadCount: deadEntries.length,
    shadowedCount: shadowResults.length,
    paths: pathEntries,
    shadowedBinaries: shadowResults,
    suggestions,
  };
}
