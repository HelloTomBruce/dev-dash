import { run } from "@/lib/detectors/utils/shell";

/**
 * 「动态白名单」所需的已安装清单缓存。
 *
 * 升级/卸载类动作不接受任意包名，必须先确认目标确实已安装；
 * 这些探测较重，统一缓存 60s，避免每次动作都重新枚举。
 */

/** 已安装 brew 包缓存（formula / cask 分开） */
let brewInstalledCache: {
  at: number;
  formulae: Set<string>;
  casks: Set<string>;
} | null = null;

export async function getBrewInstalled(): Promise<{
  formulae: Set<string>;
  casks: Set<string>;
}> {
  if (brewInstalledCache && Date.now() - brewInstalledCache.at < 60_000) {
    return brewInstalledCache;
  }
  const [f, c] = await Promise.all([
    run(`brew list --formula`, 30_000),
    run(`brew list --cask`, 30_000),
  ]);
  const toSet = (s: string) => new Set(s.split("\n").map((l) => l.trim()).filter(Boolean));
  brewInstalledCache = {
    at: Date.now(),
    formulae: toSet(f.stdout),
    casks: toSet(c.stdout),
  };
  return brewInstalledCache;
}

/** npm 全局已装包缓存 */
let npmGlobalCache: { at: number; names: Set<string> } | null = null;

export async function getNpmGlobal(): Promise<Set<string>> {
  if (npmGlobalCache && Date.now() - npmGlobalCache.at < 60_000) {
    return npmGlobalCache.names;
  }
  const res = await run(`npm ls -g --depth=0 --json`, 30_000);
  const names = new Set<string>();
  try {
    const j = JSON.parse(res.stdout.trim());
    for (const name of Object.keys(j.dependencies ?? {})) names.add(name);
  } catch {
    /* 保持空集合，后续校验会拦截 */
  }
  npmGlobalCache = { at: Date.now(), names };
  return names;
}

/** uv tool 已装列表缓存（升级/卸载动态校验） */
let uvToolCache: { at: number; names: Set<string> } | null = null;

export async function getUvTools(): Promise<Set<string>> {
  if (uvToolCache && Date.now() - uvToolCache.at < 60_000) return uvToolCache.names;
  const res = await run(`uv tool list`, 20_000);
  const names = new Set<string>();
  for (const line of res.stdout.split("\n")) {
    const m = line.trim().match(/^(\S+)\s+v(\S+)$/);
    if (m) names.add(m[1]);
  }
  uvToolCache = { at: Date.now(), names };
  return names;
}

/** uv 管理的 Python 版本缓存 */
let uvPythonCache: { at: number; versions: Set<string> } | null = null;

export async function getUvPythons(): Promise<Set<string>> {
  if (uvPythonCache && Date.now() - uvPythonCache.at < 60_000) return uvPythonCache.versions;
  const res = await run(`uv python list --only-installed`, 20_000);
  const versions = new Set<string>();
  for (const line of res.stdout.split("\n")) {
    const m = line.trim().match(/^(cpython|pypy)-(\d+\.\d+\.\d+)/);
    if (m) versions.add(m[2]);
  }
  uvPythonCache = { at: Date.now(), versions };
  return versions;
}

/** pnpm 全局已装包缓存 */
let pnpmGlobalCache: { at: number; names: Set<string> } | null = null;

export async function getPnpmGlobal(): Promise<Set<string>> {
  if (pnpmGlobalCache && Date.now() - pnpmGlobalCache.at < 60_000) {
    return pnpmGlobalCache.names;
  }
  const res = await run(`pnpm ls -g --depth=0 --json 2>/dev/null`, 30_000);
  const names = new Set<string>();
  try {
    const arr = JSON.parse(res.stdout.trim() || "[]") as Array<{
      dependencies?: Record<string, unknown>;
    }>;
    for (const proj of arr) {
      for (const name of Object.keys(proj.dependencies ?? {})) names.add(name);
    }
  } catch {
    /* 保持空集合 */
  }
  pnpmGlobalCache = { at: Date.now(), names };
  return names;
}
