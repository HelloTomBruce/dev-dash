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
  return new Promise((resolve) => {
    exec(
      `/bin/zsh -ilc 'printf "__PATH__%s__END__" "$PATH"'`,
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
