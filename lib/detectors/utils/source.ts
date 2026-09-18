/**
 * 从可执行文件路径识别安装来源
 */
export function detectSource(path: string | null): string | null {
  if (!path) return null;
  const p = path.toLowerCase();
  const home = (process.env.HOME ?? "").toLowerCase();

  // 1. 特征明显的管理器/安装器目录（子串匹配）
  const subRules: Array<[string, string]> = [
    ["/.nvm/", "nvm"],
    ["/.volta/", "volta"],
    ["/.pyenv/", "pyenv"],
    ["/.rustup/", "rustup"],
    ["/.cargo/", "rustup"],
    ["/.asdf/", "asdf"],
    ["/.local/share/mise", "mise"],
    ["/.bun/", "bun"],
    ["/.deno/", "deno"],
    ["/.jenv/", "jenv"],
    ["/.sdkman/", "sdkman"],
    ["/.npm-global/", "npm-global"],
    ["/opt/homebrew/", "brew"],
    ["/usr/local/cellar/", "brew"],
    ["/home/linuxbrew/", "brew"],
  ];
  for (const [needle, source] of subRules) {
    if (p.includes(needle)) return source;
  }

  // 2. 用户目录下的其他安装 → manual
  if (home && p.startsWith(home)) return "manual";

  // 3. 系统目录（必须前缀匹配，避免误伤 xxx/bin/ 之类的路径）
  if (
    p.startsWith("/usr/local/") ||
    p === "/usr/local" ||
    p.startsWith("/usr/local/bin/")
  ) {
    return "manual";
  }
  if (
    p.startsWith("/usr/bin/") ||
    p.startsWith("/bin/") ||
    p.startsWith("/system/library/") ||
    p.startsWith("/library/")
  ) {
    return "system";
  }
  return "standalone";
}
