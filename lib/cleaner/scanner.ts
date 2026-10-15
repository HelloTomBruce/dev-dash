import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { runArgs } from "@/lib/detectors/utils/shell";

export interface CleanerTarget {
  id: string;
  name: string;
  toolId: string;
  category: "package-manager" | "runtime" | "build-tool" | "container" | "ide";
  path: string;
  displayPath: string;
  sizeBytes: number;
  humanSize: string;
  description: string;
  cleanCommand: string;
  level: "safe" | "careful";
  installed: boolean;
}

export interface CleanerScanResult {
  scannedAt: string;
  durationMs: number;
  totalSizeBytes: number;
  totalHumanSize: string;
  targets: CleanerTarget[];
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 快速使用 du -sk 计算目录体积（返回 bytes） */
async function getDirSize(dirPath: string): Promise<number> {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory() && !stat.isFile()) return 0;
  } catch {
    return 0; // 目录不存在
  }

  try {
    const res = await runArgs("du", ["-sk", dirPath], 4000, { redirections: "2>/dev/null" });
    if (res.ok && res.stdout) {
      const match = res.stdout.trim().split(/\s+/)[0];
      const kb = parseInt(match, 10);
      if (!isNaN(kb)) return kb * 1024;
    }
  } catch {
    // ignore
  }
  return 0;
}

export async function scanCleanerTargets(): Promise<CleanerScanResult> {
  const t0 = Date.now();
  const home = os.homedir();

  const candidates = [
    {
      id: "uv",
      name: "uv 缓存",
      toolId: "uv",
      category: "package-manager" as const,
      path: path.join(home, ".cache/uv"),
      displayPath: "~/.cache/uv",
      description: "Python 包预编译 wheels、下载归档与元数据缓存，清理后按需重新拉取",
      cleanCommand: "uv cache clean",
      level: "safe" as const,
    },
    {
      id: "npm",
      name: "npm 缓存",
      toolId: "npm",
      category: "package-manager" as const,
      path: path.join(home, ".npm"),
      displayPath: "~/.npm",
      description: "npm 全局下载的 tarball 与元数据缓存，清理不影响已安装的项目",
      cleanCommand: "npm cache clean --force",
      level: "safe" as const,
    },
    {
      id: "pnpm",
      name: "pnpm Store 无引用内容",
      toolId: "pnpm",
      category: "package-manager" as const,
      path: path.join(home, "Library/pnpm/store"),
      displayPath: "~/Library/pnpm/store",
      description: "硬链接内容可寻址存储中未被任何项目引用的孤立包",
      cleanCommand: "pnpm store prune",
      level: "safe" as const,
    },
    {
      id: "pip",
      name: "pip 缓存",
      toolId: "pip",
      category: "package-manager" as const,
      path: path.join(home, "Library/Caches/pip"),
      displayPath: "~/Library/Caches/pip",
      description: "pip 安装 Python 包时缓存的 wheel 和源码归档",
      cleanCommand: "pip3 cache purge",
      level: "safe" as const,
    },
    {
      id: "brew",
      name: "Homebrew 下载缓存",
      toolId: "brew",
      category: "package-manager" as const,
      path: path.join(home, "Library/Caches/Homebrew"),
      displayPath: "~/Library/Caches/Homebrew",
      description: "Homebrew 安装 bottle 和 formula 遗留的历史下载文件与锁定缓存",
      cleanCommand: "brew cleanup --prune=all",
      level: "safe" as const,
    },
    {
      id: "yarn",
      name: "Yarn 缓存",
      toolId: "yarn",
      category: "package-manager" as const,
      path: path.join(home, "Library/Caches/Yarn"),
      displayPath: "~/Library/Caches/Yarn",
      description: "Yarn v1/v2 全局包下载缓存",
      cleanCommand: "yarn cache clean",
      level: "safe" as const,
    },
    {
      id: "cargo",
      name: "Cargo Registry 缓存",
      toolId: "cargo",
      category: "package-manager" as const,
      path: path.join(home, ".cargo/registry/cache"),
      displayPath: "~/.cargo/registry/cache",
      description: "crates.io 下载的 .crate 归档包缓存",
      cleanCommand: "rm -rf ~/.cargo/registry/cache ~/.cargo/git/db",
      level: "safe" as const,
    },
    {
      id: "node-gyp",
      name: "node-gyp 构建缓存",
      toolId: "node",
      category: "runtime" as const,
      path: path.join(home, ".cache/node-gyp"),
      displayPath: "~/.cache/node-gyp",
      description: "Node.js 原生 C++ 插件编译下载的头文件和开发包缓存",
      cleanCommand: "rm -rf ~/.cache/node-gyp",
      level: "safe" as const,
    },
    {
      id: "xcode-derived",
      name: "Xcode 派生构建数据",
      toolId: "base-tool",
      category: "build-tool" as const,
      path: path.join(home, "Library/Developer/Xcode/DerivedData"),
      displayPath: "~/Library/Developer/Xcode/DerivedData",
      description: "Xcode / iOS 构建索引与中间产物，可在重新编译时自动重建",
      cleanCommand: "rm -rf ~/Library/Developer/Xcode/DerivedData",
      level: "careful" as const,
    },
  ];

  // 并行计算各目录体积
  const sizePromises = candidates.map(async (item) => {
    const size = await getDirSize(item.path);
    return {
      ...item,
      sizeBytes: size,
      humanSize: formatBytes(size),
      installed: size > 0,
    };
  });

  const targets = (await Promise.all(sizePromises))
    .filter((t) => t.sizeBytes > 0)
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  const totalSizeBytes = targets.reduce((sum, t) => sum + t.sizeBytes, 0);

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    totalSizeBytes,
    totalHumanSize: formatBytes(totalSizeBytes),
    targets,
  };
}
