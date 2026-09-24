import { run } from "@/lib/detectors/utils/shell";
import type { OutdatedInfo } from "./types";

/**
 * 各工具的过期检查逻辑。
 * 返回 null 表示"无需检查"或"检查失败/无数据"。
 */
type OutdatedCheckFn = () => Promise<OutdatedInfo | null>;

/** npm 全局过期包 */
const npmOutdated: OutdatedCheckFn = async () => {
  const res = await run(`npm outdated -g --depth=0 --json 2>/dev/null`, 15_000, { okIfOutput: true });
  if (!res.ok || !res.stdout.trim()) return null;
  try {
    const j = JSON.parse(res.stdout.trim());
    const names = Object.keys(j);
    if (names.length === 0) return null;
    return { current: "—", latest: `${names.length} 个包可更新` };
  } catch {
    return null;
  }
};

/** pnpm 全局过期 */
const pnpmOutdated: OutdatedCheckFn = async () => {
  const res = await run(`pnpm outdated -g --json 2>/dev/null`, 15_000, { okIfOutput: true });
  if (!res.ok || !res.stdout.trim()) return null;
  try {
    const j = JSON.parse(res.stdout.trim());
    const names = Object.keys(j);
    if (names.length === 0) return null;
    return { current: "—", latest: `${names.length} 个包可更新` };
  } catch {
    return null;
  }
};

/** pip 过期包 */
const pipOutdated: OutdatedCheckFn = async () => {
  const res = await run(`pip3 list --outdated --format=json --disable-pip-version-check 2>/dev/null || pip list --outdated --format=json`, 15_000);
  if (!res.ok || !res.stdout.trim()) return null;
  try {
    const arr = JSON.parse(res.stdout.trim()) as Array<{ name: string; latest_version: string }>;
    if (arr.length === 0) return null;
    return { current: "—", latest: `${arr.length} 个包可更新` };
  } catch {
    return null;
  }
};

/** brew 过期包 */
const brewOutdated: OutdatedCheckFn = async () => {
  const res = await run(`brew outdated --formula 2>/dev/null; brew outdated --cask 2>/dev/null`, 15_000, { okIfOutput: true });
  if (!res.ok || !res.stdout.trim()) return null;
  const lines = res.stdout.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return null;
  return { current: "—", latest: `${lines.length} 个包可更新` };
};

/** uv 工具升级 */
const uvOutdated: OutdatedCheckFn = async () => {
  const res = await run(`uv tool upgrade --dry-run 2>/dev/null || uv tool list`, 15_000, { okIfOutput: true });
  if (!res.ok) return null;
  // uv tool upgrade --dry-run 还没广泛支持，降级为检查是否有更新提示
  if (res.stdout.includes("upgrading") || res.stdout.includes("would upgrade")) {
    return { current: "—", latest: "有工具可更新" };
  }
  return null;
};

/** 全部过期检查映射 */
export const outdatedChecks: Record<string, OutdatedCheckFn> = {
  "npm": npmOutdated,
  "pnpm": pnpmOutdated,
  "pip": pipOutdated,
  "brew": brewOutdated,
  "uv": uvOutdated,
};
