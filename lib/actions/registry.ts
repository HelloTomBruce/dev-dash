import { run } from "@/lib/detectors/utils/shell";

export interface ActionResult {
  ok: boolean;
  actionId: string;
  /** 实际执行的命令（便于审计） */
  command: string;
  output: string;
  error: string | null;
  durationMs: number;
}

type ActionExecutor = (
  params: Record<string, string> | undefined
) => Promise<ActionResult>;

/** brew services 允许操作的 formula 白名单 */
const BREW_SERVICES_ALLOWED = new Set([
  "postgresql@17",
  "postgresql@16",
  "postgresql",
  "redis",
  "mysql",
  "nginx",
  "mongodb-community",
]);

/** 已安装 brew 包缓存（动态白名单：升级/卸载只允许操作已装的包） */
let brewInstalledCache: {
  at: number;
  formulae: Set<string>;
  casks: Set<string>;
} | null = null;

async function getBrewInstalled(): Promise<{
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

/** 校验 brew 包名：格式合法 + 实际已安装 */
async function validateBrewPackage(
  params: Record<string, string> | undefined,
  kind: "formula" | "cask"
): Promise<string> {
  const f = params?.formula?.trim();
  if (!f || !/^[a-zA-Z0-9@._+/-]+$/.test(f)) {
    throw new Error(`非法包名: ${f ?? "(空)"}`);
  }
  const installed = await getBrewInstalled();
  const set = kind === "formula" ? installed.formulae : installed.casks;
  if (!set.has(f)) {
    throw new Error(`未安装的 ${kind}: ${f}`);
  }
  return f;
}

function requireParam(
  params: Record<string, string> | undefined,
  key: string,
  allowlist: Set<string>
): string {
  const v = params?.[key]?.trim();
  if (!v || !allowlist.has(v)) {
    throw new Error(`${key} 不在白名单中: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验路径参数（open 用）：绝对路径、无目录穿越、无 shell 元字符 */
function validateDir(params: Record<string, string> | undefined): string {
  const d = params?.dir?.trim();
  if (!d || !d.startsWith("/") || d.includes("..") || /[;&|`$"'\\]/.test(d)) {
    throw new Error(`非法路径: ${d ?? "(空)"}`);
  }
  return d;
}

/** 校验版本参数：数字版本 / lts / latest，杜绝注入 */
function validateVersion(params: Record<string, string> | undefined): string {
  const v = params?.version?.trim();
  if (!v || !/^(\d{1,2}(\.\d{1,2}){0,2}|lts|latest)$/.test(v)) {
    throw new Error(`非法版本号: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验完整语义化版本（删除操作用，要求精确） */
function validateExactVersion(params: Record<string, string> | undefined): string {
  const v = params?.version?.trim();
  if (!v || !/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(v)) {
    throw new Error(`删除操作需要完整版本号（x.y.z）: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验数据库名（PostgreSQL 标识符规则） */
function validateDbName(params: Record<string, string> | undefined): string {
  const d = params?.name?.trim();
  if (!d || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(d)) {
    throw new Error(`非法数据库名: ${d ?? "(空)"}`);
  }
  return d;
}

/** PostgreSQL 系统库，禁止删除 */
const PG_PROTECTED_DBS = new Set(["postgres", "template0", "template1"]);

/** 校验 Redis key：禁止引号/反斜线/控制字符/shell 元字符 */
function validateRedisKey(params: Record<string, string> | undefined): string {
  const k = params?.key;
  if (!k || !/^[\x20-\x7E]{1,512}$/.test(k) || /["'\\$`;&|<>]/.test(k)) {
    throw new Error(`key 含不允许的字符`);
  }
  return k;
}

/** 校验 Redis db 序号 */
function validateRedisDb(params: Record<string, string> | undefined): string {
  const d = params?.db?.trim() ?? "0";
  if (!/^\d{1,2}$/.test(d) || Number(d) > 15) {
    throw new Error(`非法 db 序号: ${d}`);
  }
  return d;
}

/** 校验 npm 包名（官方命名规则，天然无 shell 元字符） */
const NPM_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

function validateNpmName(params: Record<string, string> | undefined): string {
  const n = params?.pkg?.trim();
  if (!n || n.length > 214 || !NPM_NAME_RE.test(n)) {
    throw new Error(`非法 npm 包名: ${n ?? "(空)"}`);
  }
  return n;
}

/** npm 全局已装包缓存（升级/卸载只允许操作已装的包） */
let npmGlobalCache: { at: number; names: Set<string> } | null = null;

async function getNpmGlobal(): Promise<Set<string>> {
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

/** 校验 pypi 包名（uv 工具用） */
const PYPI_NAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

function validatePypiName(params: Record<string, string> | undefined): string {
  const n = params?.name?.trim();
  if (!n || n.length > 214 || !PYPI_NAME_RE.test(n)) {
    throw new Error(`非法包名: ${n ?? "(空)"}`);
  }
  return n;
}

/** 校验 Python 版本号（uv python install 用） */
function validatePythonVersion(params: Record<string, string> | undefined): string {
  const v = params?.version?.trim();
  if (!v || !/^\d+(\.\d+){0,2}$/.test(v)) {
    throw new Error(`非法 Python 版本: ${v ?? "(空)"}`);
  }
  return v;
}

/** uv tool 已装列表缓存（升级/卸载动态校验） */
let uvToolCache: { at: number; names: Set<string> } | null = null;

async function getUvTools(): Promise<Set<string>> {
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

async function getUvPythons(): Promise<Set<string>> {
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

async function getPnpmGlobal(): Promise<Set<string>> {
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

/** 校验容器 ID/名称 */
function validateContainerId(params: Record<string, string> | undefined): string {
  const v = params?.id?.trim();
  if (!v || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v)) {
    throw new Error(`非法容器 ID: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验镜像引用（registry/name:tag@digest 字符集） */
function validateImageRef(params: Record<string, string> | undefined): string {
  const v = params?.ref?.trim();
  if (!v || !/^[a-zA-Z0-9][a-zA-Z0-9./:@_-]{0,255}$/.test(v)) {
    throw new Error(`非法镜像引用: ${v ?? "(空)"}`);
  }
  return v;
}

async function exec(
  actionId: string,
  command: string,
  timeoutMs = 60_000,
  opts?: { okIfOutput?: boolean }
): Promise<ActionResult> {
  const start = Date.now();
  const res = await run(command, timeoutMs);
  const output = (res.stdout + (res.stderr ? `\n${res.stderr}` : "")).trim().slice(0, 8000);
  // 某些命令（npm outdated / brew doctor）发现问题时退出码非 0，但有有效输出
  const ok = res.ok || (!!opts?.okIfOutput && res.stdout.trim().length > 0);
  return {
    ok,
    actionId,
    command,
    output,
    error: ok ? null : output || "执行失败",
    durationMs: Date.now() - start,
  };
}

/**
 * 动作白名单注册表 —— 只允许执行此处注册的固定命令模板，
 * 参数经过严格校验，不接受任意命令字符串。
 */
export const actionExecutors: Record<string, ActionExecutor> = {
  // ---- 服务启停 ----
  "brew.services.start": (p) =>
    exec("brew.services.start", `brew services start ${requireParam(p, "formula", BREW_SERVICES_ALLOWED)}`),
  "brew.services.stop": (p) =>
    exec("brew.services.stop", `brew services stop ${requireParam(p, "formula", BREW_SERVICES_ALLOWED)}`),
  "brew.services.restart": (p) =>
    exec("brew.services.restart", `brew services restart ${requireParam(p, "formula", BREW_SERVICES_ALLOWED)}`),
  "container.system.start": () =>
    exec("container.system.start", `container system start`, 90_000),
  "container.system.stop": () =>
    exec("container.system.stop", `container system stop`, 60_000),
  "container.prune": () =>
    exec("container.prune", `container prune -a 2>&1 || container prune`, 120_000, { okIfOutput: true }),
  "container.start-one": (p) =>
    exec("container.start-one", `container start ${validateContainerId(p)}`, 120_000),
  "container.stop-one": (p) =>
    exec("container.stop-one", `container stop ${validateContainerId(p)}`, 60_000),
  "container.rm": (p) =>
    exec("container.rm", `container delete ${validateContainerId(p)}`, 60_000),
  "container.image-rm": (p) =>
    exec("container.image-rm", `container image rm ${validateImageRef(p)}`, 60_000),

  // ---- 通用 ----
  "tool.open-dir": (p) => exec("tool.open-dir", `open "${validateDir(p)}"`, 10_000),

  // ---- brew ----
  "brew.update": () => exec("brew.update", `brew update`, 120_000),
  "brew.upgrade-all": () => exec("brew.upgrade-all", `brew upgrade`, 600_000, { okIfOutput: true }),
  "brew.upgrade": async (p) =>
    exec("brew.upgrade", `brew upgrade ${await validateBrewPackage(p, "formula")}`, 300_000, { okIfOutput: true }),
  "brew.upgrade-cask": async (p) =>
    exec("brew.upgrade-cask", `brew upgrade --cask ${await validateBrewPackage(p, "cask")}`, 300_000, { okIfOutput: true }),
  "brew.uninstall": async (p) =>
    exec("brew.uninstall", `brew uninstall ${await validateBrewPackage(p, "formula")}`, 120_000),
  "brew.cleanup": () => exec("brew.cleanup", `brew cleanup`, 180_000),
  "brew.doctor": () => exec("brew.doctor", `brew doctor`, 90_000, { okIfOutput: true }),
  "brew.outdated": () => exec("brew.outdated", `brew outdated`, 60_000, { okIfOutput: true }),

  // ---- node / n / npm / pnpm ----
  "npm.outdated": () => exec("npm.outdated", `npm outdated -g --depth=0`, 60_000, { okIfOutput: true }),
  "npm.update-g-all": () => exec("npm.update-g-all", `npm update -g`, 600_000),
  "npm.install-g": (p) =>
    exec("npm.install-g", `npm install -g ${validateNpmName(p)}@latest`, 300_000),
  "npm.update-g": async (p) => {
    const pkg = validateNpmName(p);
    const installed = await getNpmGlobal();
    if (!installed.has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("npm.update-g", `npm install -g ${pkg}@latest`, 300_000);
  },
  "npm.uninstall-g": async (p) => {
    const pkg = validateNpmName(p);
    const installed = await getNpmGlobal();
    if (!installed.has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("npm.uninstall-g", `npm uninstall -g ${pkg}`, 120_000);
  },
  "n.install-lts": () => exec("n.install-lts", `n lts`, 300_000),
  "n.install-latest": () => exec("n.install-latest", `n latest`, 300_000),
  "n.prune": () => exec("n.prune", `n prune`, 60_000),
  "n.install-version": (p) =>
    exec("n.install-version", `n ${validateVersion(p)}`, 300_000),
  "n.use": (p) => exec("n.use", `n ${validateVersion(p)}`, 120_000),
  "n.rm": (p) => exec("n.rm", `n rm ${validateExactVersion(p)}`, 60_000),
  "pnpm.outdated": () => exec("pnpm.outdated", `pnpm outdated -g`, 60_000, { okIfOutput: true }),
  "pnpm.update-g-all": () => exec("pnpm.update-g-all", `pnpm update -g`, 600_000),
  "pnpm.install-g": (p) =>
    exec("pnpm.install-g", `pnpm add -g ${validateNpmName(p)}@latest`, 300_000),
  "pnpm.update-g": async (p) => {
    const pkg = validateNpmName(p);
    if (!(await getPnpmGlobal()).has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("pnpm.update-g", `pnpm update -g ${pkg}@latest`, 300_000);
  },
  "pnpm.uninstall-g": async (p) => {
    const pkg = validateNpmName(p);
    if (!(await getPnpmGlobal()).has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("pnpm.uninstall-g", `pnpm remove -g ${pkg}`, 120_000);
  },
  "pnpm.store-prune": () => exec("pnpm.store-prune", `pnpm store prune`, 300_000, { okIfOutput: true }),

  // ---- pip / uv ----
  "pip.outdated": () =>
    exec("pip.outdated", `pip3 list --outdated --disable-pip-version-check`, 60_000, { okIfOutput: true }),
  "uv.tool-upgrade-all": () => exec("uv.tool-upgrade-all", `uv tool upgrade --all`, 300_000, { okIfOutput: true }),
  "uv.tool-upgrade": async (p) => {
    const name = validatePypiName(p);
    if (!(await getUvTools()).has(name)) throw new Error(`未安装的 uv 工具: ${name}`);
    return exec("uv.tool-upgrade", `uv tool upgrade ${name}`, 300_000, { okIfOutput: true });
  },
  "uv.tool-uninstall": async (p) => {
    const name = validatePypiName(p);
    if (!(await getUvTools()).has(name)) throw new Error(`未安装的 uv 工具: ${name}`);
    return exec("uv.tool-uninstall", `uv tool uninstall ${name}`, 60_000);
  },
  "uv.tool-install": (p) =>
    exec("uv.tool-install", `uv tool install ${validatePypiName(p)}`, 300_000),
  "uv.python-install": (p) =>
    exec("uv.python-install", `uv python install ${validatePythonVersion(p)}`, 600_000),
  "uv.python-uninstall": async (p) => {
    const v = validatePythonVersion(p);
    if (!/^\d+\.\d+\.\d+$/.test(v)) {
      throw new Error(`卸载需要完整版本号（x.y.z）: ${v}`);
    }
    if (!(await getUvPythons()).has(v)) throw new Error(`未安装的 Python: ${v}`);
    return exec("uv.python-uninstall", `uv python uninstall ${v}`, 60_000);
  },

  // ---- rust / rubygems ----
  "rustup.update": () => exec("rustup.update", `rustup update`, 600_000, { okIfOutput: true }),
  "gem.update-system": () => exec("gem.update-system", `gem update --system`, 300_000),

  // ---- postgres ----
  "pg.createdb": (p) => exec("pg.createdb", `createdb ${validateDbName(p)}`, 30_000),
  "pg.dropdb": (p) => {
    const db = validateDbName(p);
    if (PG_PROTECTED_DBS.has(db)) {
      throw new Error(`系统数据库不可删除: ${db}`);
    }
    return exec("pg.dropdb", `dropdb ${db}`, 30_000);
  },

  // ---- redis ----
  "redis.del-key": (p) =>
    exec("redis.del-key", `redis-cli del "${validateRedisKey(p)}"`, 15_000),
  "redis.flushdb": (p) =>
    exec("redis.flushdb", `redis-cli -n ${validateRedisDb(p)} flushdb`, 15_000),
};
