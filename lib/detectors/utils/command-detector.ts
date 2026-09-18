import type { Category, Detector, ToolStatus } from "../types";
import { run, extractVersion } from "./shell";
import { detectSource } from "./source";

interface CommandDetectorOptions {
  id: string;
  name: string;
  category: Category;
  /** 候选可执行文件，按顺序尝试（如 python3 → python） */
  binaries: string[];
  /** 版本参数，默认 --version */
  versionArgs?: string;
  /** 自定义版本解析（默认：正则抓 x.y.z） */
  parseVersion?: (out: string) => string | null;
}

/**
 * 通用命令行探测器工厂。
 * 探测命令：command -v <bin> && <bin> <versionArgs> 2>&1
 * 未安装（command -v 失败）→ not-found，不算错误。
 */
export function commandDetector(opts: CommandDetectorOptions): Detector {
  const { id, name, category, binaries, versionArgs = "--version" } = opts;

  return {
    id,
    name,
    category,
    async detect() {
      for (const bin of binaries) {
        const res = await run(
          `command -v ${bin} && ${bin} ${versionArgs} 2>&1`,
          8000
        );
        if (!res.ok || !res.stdout.trim()) continue;

        const lines = res.stdout.trim().split("\n");
        const path = lines[0].trim();
        if (!path || path.startsWith("/")) {
          // 第一行是路径，其余是版本输出
          const versionOut = lines.slice(1).join("\n").trim();
          const version =
            opts.parseVersion?.(versionOut) ?? extractVersion(versionOut);
          return {
            id,
            name,
            category,
            status: version ? "ok" : "error",
            version: version ?? null,
            path: path.startsWith("/") ? path : null,
            source: detectSource(path),
            raw: versionOut.slice(0, 500) || null,
            error: version
              ? null
              : `无法从输出解析版本号: ${versionOut.slice(0, 200)}`,
          };
        }
      }
      return {
        id,
        name,
        category,
        status: "not-found" as ToolStatus,
        version: null,
        path: null,
        source: null,
        raw: null,
        error: null,
      };
    },
  };
}
