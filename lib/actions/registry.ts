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

/** brew upgrade 允许操作的 formula 白名单（与 meta.ts BREW_FORMULA 对应） */
const BREW_UPGRADE_ALLOWED = new Set([
  "python@3.14",
  "go",
  "postgresql@17",
  "redis",
  "git",
  "gh",
  "ffmpeg",
  "uv",
  "container",
]);

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

  // ---- 通用 ----
  "tool.open-dir": (p) => exec("tool.open-dir", `open "${validateDir(p)}"`, 10_000),

  // ---- brew ----
  "brew.update": () => exec("brew.update", `brew update`, 120_000),
  "brew.upgrade-all": () => exec("brew.upgrade-all", `brew upgrade`, 600_000, { okIfOutput: true }),
  "brew.upgrade": (p) =>
    exec("brew.upgrade", `brew upgrade ${requireParam(p, "formula", BREW_UPGRADE_ALLOWED)}`, 300_000, { okIfOutput: true }),
  "brew.cleanup": () => exec("brew.cleanup", `brew cleanup`, 180_000),
  "brew.doctor": () => exec("brew.doctor", `brew doctor`, 90_000, { okIfOutput: true }),
  "brew.outdated": () => exec("brew.outdated", `brew outdated`, 60_000, { okIfOutput: true }),

  // ---- node / n / npm / pnpm ----
  "npm.outdated": () => exec("npm.outdated", `npm outdated -g --depth=0`, 60_000, { okIfOutput: true }),
  "npm.update-g-all": () => exec("npm.update-g-all", `npm update -g`, 600_000),
  "n.install-lts": () => exec("n.install-lts", `n lts`, 300_000),
  "n.install-latest": () => exec("n.install-latest", `n latest`, 300_000),
  "n.prune": () => exec("n.prune", `n prune`, 60_000),
  "n.install-version": (p) =>
    exec("n.install-version", `n ${validateVersion(p)}`, 300_000),
  "n.use": (p) => exec("n.use", `n ${validateVersion(p)}`, 120_000),
  "n.rm": (p) => exec("n.rm", `n rm ${validateExactVersion(p)}`, 60_000),
  "pnpm.outdated": () => exec("pnpm.outdated", `pnpm outdated -g`, 60_000, { okIfOutput: true }),
  "pnpm.update-g-all": () => exec("pnpm.update-g-all", `pnpm update -g`, 600_000),

  // ---- pip / uv ----
  "pip.outdated": () =>
    exec("pip.outdated", `pip3 list --outdated --disable-pip-version-check`, 60_000, { okIfOutput: true }),
  "uv.tool-upgrade-all": () => exec("uv.tool-upgrade-all", `uv tool upgrade --all`, 300_000, { okIfOutput: true }),

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
};
