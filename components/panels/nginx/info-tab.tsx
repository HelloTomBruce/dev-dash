"use client";

import type { ProcessInfo } from "@/lib/nginx/types";

/** 「进程与编译参数」标签页 */
export function InfoTab({
  processes,
  configureArgs,
}: {
  processes: ProcessInfo[];
  configureArgs: string[];
}) {
  return (
    <section className="mt-6 space-y-6">
      {/* Processes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">当前活跃进程 (Processes)</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800/80 text-[11px] text-zinc-500">
                <th className="px-3 py-2 font-medium">PID</th>
                <th className="px-3 py-2 font-medium">用户</th>
                <th className="px-3 py-2 font-medium">CPU</th>
                <th className="px-3 py-2 font-medium">MEM</th>
                <th className="px-3 py-2 font-medium">指令</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
              {processes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-zinc-600">
                    无正在运行的 Nginx 进程
                  </td>
                </tr>
              ) : (
                processes.map((proc, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 text-emerald-400">{proc.pid}</td>
                    <td className="px-3 py-2 text-zinc-400">{proc.user}</td>
                    <td className="px-3 py-2 text-zinc-400">{proc.cpu}</td>
                    <td className="px-3 py-2 text-zinc-400">{proc.mem}</td>
                    <td className="px-3 py-2 text-zinc-300 truncate max-w-lg" title={proc.command}>
                      {proc.command}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Build Info */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">编译模块与配置参数</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {configureArgs.map((arg, idx) => (
            <span
              key={idx}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-[11px] text-zinc-300"
            >
              {arg}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
