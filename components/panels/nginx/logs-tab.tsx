"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";

/** 「运行日志」标签页：access / error 日志切换（切换状态由父级持有以跨标签页保留） */
export function LogsTab({
  logType,
  onChangeLogType,
  accessLogs,
  errorLogs,
  accessLogPath,
  errorLogPath,
  onRefresh,
}: {
  logType: "access" | "error";
  onChangeLogType: (t: "access" | "error") => void;
  accessLogs: string[];
  errorLogs: string[];
  accessLogPath: string;
  errorLogPath: string;
  onRefresh: () => void;
}) {
  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeLogType("access")}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              logType === "access"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Access Log ({accessLogs.length} 行)
          </button>
          <button
            onClick={() => onChangeLogType("error")}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              logType === "error"
                ? "bg-red-600/20 text-red-300 border border-red-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Error Log ({errorLogs.length} 行)
          </button>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
        >
          <ArrowsClockwiseIcon size={12} weight="bold" /> 刷新日志
        </button>
      </div>

      <div className="mt-3">
        <p className="text-[11px] text-zinc-500 font-mono mb-2 truncate">
          文件路径: {logType === "access" ? accessLogPath : errorLogPath}
        </p>
        <div className="h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-tight text-zinc-300 space-y-1">
          {logType === "access" ? (
            accessLogs.length ? (
              accessLogs.map((l, i) => (
                <div key={i} className="hover:bg-zinc-900/60 py-0.5 whitespace-pre-wrap">
                  {l}
                </div>
              ))
            ) : (
              <div className="text-zinc-600 text-center py-8">暂无访问日志</div>
            )
          ) : (
            errorLogs.length ? (
              errorLogs.map((l, i) => (
                <div
                  key={i}
                  className={`hover:bg-zinc-900/60 py-0.5 whitespace-pre-wrap ${
                    l.includes("[error]") || l.includes("[crit]")
                      ? "text-red-400"
                      : l.includes("[warn]")
                      ? "text-amber-400"
                      : "text-zinc-400"
                  }`}
                >
                  {l}
                </div>
              ))
            ) : (
              <div className="text-zinc-600 text-center py-8">暂无错误日志</div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
