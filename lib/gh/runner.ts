import { run } from "@/lib/detectors/utils/shell";

/** zsh 单引号转义：把参数包成 '...'，内部单引号替换为 '"'"' */
export function zshQuote(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

/**
 * 参数数组化的 gh 执行器。
 * 调用方只传参数数组，禁止拼命令字符串；每个参数经 zsh 单引号转义。
 */
export async function runGh(
  args: string[],
  timeoutMs = 15000
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return run(`gh ${args.map(zshQuote).join(" ")}`, timeoutMs);
}

/** 运行 gh 并解析 JSON stdout；失败抛错（stderr 摘要） */
export async function runGhJson<T>(args: string[], timeoutMs = 15000): Promise<T> {
  const res = await runGh(args, timeoutMs);
  const text = res.stdout.trim();
  if (!res.ok) {
    throw new Error((res.stderr || text || "gh 执行失败").trim().slice(0, 500));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`gh 输出不是合法 JSON: ${text.slice(0, 200)}`);
  }
}
