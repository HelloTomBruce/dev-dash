import { exec } from "node:child_process";

export interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/**
 * 预取登录 shell（zsh -il）的 PATH。
 * Node 服务端 exec 默认 PATH 里没有 nvm/pyenv 等安装的工具，
 * 必须先拿到用户交互 shell 的 PATH 再执行探测命令。
 * 结果进程内缓存（登录 shell 启动较慢，不能每次探测都跑）。
 */
let loginPathPromise: Promise<string | null> | null = null;

function fetchLoginPath(): Promise<string | null> {
  const home = process.env.HOME || "";
  const user = process.env.USER || "";
  return new Promise((resolve) => {
    exec(
      `env -i HOME="${home}" USER="${user}" SHELL="/bin/zsh" PATH="/usr/bin:/bin:/usr/sbin:/sbin" /bin/zsh -ilc 'printf "__PATH__%s__END__" "$PATH"'`,
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(null);
        const m = stdout.match(/__PATH__([\s\S]*?)__END__/);
        resolve(m ? m[1].trim() : null);
      }
    );
  });
}

export function getLoginPath(): Promise<string | null> {
  if (!loginPathPromise) {
    loginPathPromise = fetchLoginPath().catch(() => null);
  }
  return loginPathPromise;
}

/** 丢弃缓存的登录 PATH（环境变更后强制刷新时调用，下次执行重新预取） */
export function resetLoginPath(): void {
  loginPathPromise = null;
}

/** 用登录 shell 的环境执行命令（带超时，永不抛异常） */
export async function run(
  cmd: string,
  timeoutMs = 5000,
  opts?: { okIfOutput?: boolean }
): Promise<ExecResult> {
  const loginPath = await getLoginPath();
  const env = { ...process.env };
  if (loginPath) env.PATH = loginPath;

  return new Promise((resolve) => {
    exec(
      cmd,
      {
        timeout: timeoutMs,
        env,
        shell: "/bin/zsh",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (err, stdout, stderr) => {
        const ok = !err || (opts?.okIfOutput && stdout.trim().length > 0);
        resolve({
          ok: !!ok,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      }
    );
  });
}

/** 默认版本提取：从输出中抓 x.y.z 形式的版本号 */
export function extractVersion(out: string): string | null {
  const m = out.match(/(\d+(\.\d+)+(-[\w.]+)?)/);
  return m ? m[1] : null;
}

/** zsh 单引号安全转义：把任意字符串包成 '...'，内部单引号替换为 '"'"' */
export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

/**
 * 参数数组化执行：调用方只传二进制与参数数组，禁止拼接命令字符串。
 * 每个 token 经 shQuote 转义，杜绝含 shell 元字符的值（路径/名称/包名）造成注入。
 * `opts.redirections` 原样追加到命令末尾（如 "2>/dev/null"）。
 */
export async function runArgs(
  bin: string,
  args: string[],
  timeoutMs = 5000,
  opts?: { okIfOutput?: boolean; redirections?: string }
): Promise<ExecResult> {
  const tail = opts?.redirections ? ` ${opts.redirections}` : "";
  const cmd = [bin, ...args].map(shQuote).join(" ") + tail;
  return run(cmd, timeoutMs, opts);
}
