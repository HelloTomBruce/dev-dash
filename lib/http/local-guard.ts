/**
 * localhost 来源校验（纵深防御）。
 *
 * 真正的网络边界由监听地址保证：dev/start 脚本均以 `-H 127.0.0.1` 只绑定回环网卡，
 * 外部主机无法建立 TCP 连接。此处的 Host 头校验是第二道防线，用于拦截：
 *   - 代理转发 / Host 头被伪造的情况
 *   - 形如 `localhost.attacker.com` 的前缀混淆（旧实现用 startsWith 会误放行）
 *
 * 注意：Host 头本身可被客户端伪造，因此它不能单独作为安全边界，
 * 必须与回环绑定配合使用。
 */

/** 允许的本地主机名（不含端口） */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** 从 Host 头中提取主机名（去除端口，兼容 IPv6 字面量） */
function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    // IPv6 字面量：[::1]:3100 → [::1]
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  return host.split(":")[0];
}

/** 判断请求是否来自本机回环地址 */
export function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  if (!host) return false;
  return LOCAL_HOSTNAMES.has(hostnameOf(host).toLowerCase());
}
