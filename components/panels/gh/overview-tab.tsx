"use client";

import type { GhOverview } from "@/lib/gh/types";
import { InfoCard } from "../shared";

export function OverviewTab({ overview }: { overview: GhOverview }) {
  const { extensions, config, rateLimit } = overview;
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <InfoCard label="扩展" value={String(extensions.length)} />
        <InfoCard
          label="API 配额"
          value={rateLimit ? `${rateLimit.remaining}/${rateLimit.limit}` : "—"}
          warn={!!rateLimit && rateLimit.remaining < 500}
        />
        <InfoCard
          label="配额重置"
          value={rateLimit ? new Date(rateLimit.resetAt * 1000).toLocaleTimeString() : "—"}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          扩展（{extensions.length}）
        </h2>
        {extensions.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
            未安装扩展，可用 gh extension install 安装
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            {extensions.map((e) => (
              <div
                key={e.name}
                className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                  {e.name}
                </span>
                <span className="font-mono text-xs text-zinc-500">{e.version}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          配置（{config.length}）
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {config.map((c) => (
            <div
              key={c.key}
              className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2 last:border-0"
            >
              <span className="w-40 shrink-0 font-mono text-xs text-zinc-400">{c.key}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                {c.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}