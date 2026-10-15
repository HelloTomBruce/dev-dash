"use client";

import { ArrowUpRightIcon } from "@phosphor-icons/react";
import type { NginxServerBlock } from "@/lib/nginx/types";

/** 「站点与路由」标签页：server 块与 location 规则 */
export function SitesTab({ servers }: { servers: NginxServerBlock[] }) {
  return (
    <section className="mt-6 space-y-4">
      {servers.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500">
          未在配置文件中解析到 server 块。
        </div>
      ) : (
        servers.map((server, idx) => {
          const primaryPort = server.listen[0]?.replace(/\s+ssl.*/, "").replace(/.*:/, "").trim() || "80";
          const openUrl = `http://localhost:${primaryPort}`;
          return (
            <div
              key={idx}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm transition hover:border-zinc-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-200">
                    {server.serverNames.join(", ")}
                  </span>
                  {server.listen.map((l, i) => (
                    <span
                      key={i}
                      className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald-400 border border-emerald-500/20"
                    >
                      Port: {l}
                    </span>
                  ))}
                  {server.ssl && (
                    <span className="rounded bg-purple-500/10 px-2 py-0.5 font-mono text-xs font-medium text-purple-400 border border-purple-500/20">
                      SSL
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
                  >
                    <ArrowUpRightIcon size={11} /> 打开 {openUrl}
                  </a>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                <div>
                  <span className="text-zinc-500">定义文件: </span>
                  <span className="font-mono text-zinc-300">{server.relPath}</span>
                </div>
                {server.root && (
                  <div>
                    <span className="text-zinc-500">默认 Root: </span>
                    <span className="font-mono text-zinc-300">{server.root}</span>
                  </div>
                )}
              </div>

              {server.locations.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-zinc-400 mb-2">路由与代理规则 (Locations):</p>
                  <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800/80 text-[11px] text-zinc-500">
                          <th className="px-3 py-2 font-medium">路径 (Path)</th>
                          <th className="px-3 py-2 font-medium">类型</th>
                          <th className="px-3 py-2 font-medium">目标 / 动作 (Target)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                        {server.locations.map((loc, lIdx) => (
                          <tr key={lIdx} className="hover:bg-zinc-900/40">
                            <td className="px-3 py-2 font-semibold text-emerald-300">
                              {loc.path}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] ${
                                  loc.type === "proxy"
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : loc.type === "alias"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : loc.type === "root"
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {loc.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-zinc-300 truncate max-w-md" title={loc.target}>
                              {loc.target}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
