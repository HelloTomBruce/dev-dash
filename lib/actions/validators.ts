import { getBrewInstalled } from "./caches";

/**
 * 动作参数校验器集合。
 *
 * 所有动作参数都必须经过这里的严格校验（正则白名单 / 枚举 / 动态已装清单），
 * 只有校验通过的值才允许拼进命令模板，杜绝命令注入。
 */

/** brew services 允许操作的 formula 白名单 */
export const BREW_SERVICES_ALLOWED = new Set([
  "postgresql@17",
  "postgresql@16",
  "postgresql",
  "redis",
  "mysql",
  "nginx",
  "mongodb-community",
]);

/** PostgreSQL 系统库，禁止删除 */
export const PG_PROTECTED_DBS = new Set(["postgres", "template0", "template1"]);

/** 校验 brew 包名：格式合法 + 实际已安装 */
export async function validateBrewPackage(
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

/** 从参数中取白名单内的值 */
export function requireParam(
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
export function validateDir(params: Record<string, string> | undefined): string {
  const d = params?.dir?.trim();
  if (!d || !d.startsWith("/") || d.includes("..") || /[;&|`$"'\\]/.test(d)) {
    throw new Error(`非法路径: ${d ?? "(空)"}`);
  }
  return d;
}

/** 校验版本参数：数字版本 / lts / latest，杜绝注入 */
export function validateVersion(params: Record<string, string> | undefined): string {
  const v = params?.version?.trim();
  if (!v || !/^(\d{1,2}(\.\d{1,2}){0,2}|lts|latest)$/.test(v)) {
    throw new Error(`非法版本号: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验完整语义化版本（删除操作用，要求精确） */
export function validateExactVersion(params: Record<string, string> | undefined): string {
  const v = params?.version?.trim();
  if (!v || !/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(v)) {
    throw new Error(`删除操作需要完整版本号（x.y.z）: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验数据库名（PostgreSQL 标识符规则） */
export function validateDbName(params: Record<string, string> | undefined): string {
  const d = params?.name?.trim();
  if (!d || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(d)) {
    throw new Error(`非法数据库名: ${d ?? "(空)"}`);
  }
  return d;
}

/** 校验 Redis key：禁止引号/反斜线/控制字符/shell 元字符 */
export function validateRedisKey(params: Record<string, string> | undefined): string {
  const k = params?.key;
  if (!k || !/^[\x20-\x7E]{1,512}$/.test(k) || /["'\\$`;&|<>]/.test(k)) {
    throw new Error(`key 含不允许的字符`);
  }
  return k;
}

/** 校验 Redis db 序号 */
export function validateRedisDb(params: Record<string, string> | undefined): string {
  const d = params?.db?.trim() ?? "0";
  if (!/^\d{1,2}$/.test(d) || Number(d) > 15) {
    throw new Error(`非法 db 序号: ${d}`);
  }
  return d;
}

/** 校验 npm 包名（官方命名规则，天然无 shell 元字符） */
const NPM_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function validateNpmName(params: Record<string, string> | undefined): string {
  const n = params?.pkg?.trim();
  if (!n || n.length > 214 || !NPM_NAME_RE.test(n)) {
    throw new Error(`非法 npm 包名: ${n ?? "(空)"}`);
  }
  return n;
}

/** 校验 pypi 包名（uv 工具用） */
const PYPI_NAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

export function validatePypiName(params: Record<string, string> | undefined): string {
  const n = params?.name?.trim();
  if (!n || n.length > 214 || !PYPI_NAME_RE.test(n)) {
    throw new Error(`非法包名: ${n ?? "(空)"}`);
  }
  return n;
}

/** 校验 Python 版本号（uv python install 用） */
export function validatePythonVersion(params: Record<string, string> | undefined): string {
  const v = params?.version?.trim();
  if (!v || !/^\d+(\.\d+){0,2}$/.test(v)) {
    throw new Error(`非法 Python 版本: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验容器 ID/名称 */
export function validateContainerId(params: Record<string, string> | undefined): string {
  const v = params?.id?.trim();
  if (!v || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v)) {
    throw new Error(`非法容器 ID: ${v ?? "(空)"}`);
  }
  return v;
}

/** 校验镜像引用（registry/name:tag@digest 字符集） */
export function validateImageRef(params: Record<string, string> | undefined): string {
  const v = params?.ref?.trim();
  if (!v || !/^[a-zA-Z0-9][a-zA-Z0-9./:@_-]{0,255}$/.test(v)) {
    throw new Error(`非法镜像引用: ${v ?? "(空)"}`);
  }
  return v;
}
