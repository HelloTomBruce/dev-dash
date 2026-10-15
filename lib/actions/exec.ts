import { run } from "@/lib/detectors/utils/shell";
import type { ActionResult } from "./types";

/**
 * 执行固定的命令模板并归一化结果（截断输出、判定 ok、计时）。
 *
 * 某些命令（npm outdated / brew doctor）发现问题时退出码非 0，但有有效输出，
 * 通过 opts.okIfOutput 放行（有 stdout 即视为成功）。
 */
export async function exec(
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
