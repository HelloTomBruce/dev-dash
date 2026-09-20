"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface RedisDetail {
  status: "running" | "stopped";
  detail?: string | null;
  version?: string;
  mode?: string;
  port?: string;
  uptimeSeconds?: number;
  usedMemory?: string;
  usedMemoryPeak?: string;
  connectedClients?: number;
  totalCommands?: string;
  totalKeys?: number;
  dbs?: Array<{
    db: number;
    keys: number;
    expires: number;
    sampleKeys: Array<{ key: string; type: string; ttl: number }>;
  }>;
}

function formatUptime(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天 ${Math.floor((seconds % 86400) / 3600)} 小时`;
}

export function RedisDetailPanel() {
  const [detail, setDetail] = useState<RedisDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/redis");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setDetail(j);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const { modal, busy, runAction, closeModal } = useActionRunner(() => load());

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const running = detail?.status === "running";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Redis
          {detail?.version && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {detail.version}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {detail && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                running
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-red-500/30 bg-red-500/15 text-red-400"
              }`}
            >
              <span className={`size-1.5 rounded-full ${running ? "bg-emerald-400" : "bg-red-400"}`} />
              {running ? "运行中" : "已停止"}
            </span>
          )}
          {detail && (
            running ? (
              <>
                <PanelButton
                  label="重启"
                  disabled={busy}
                  onClick={() =>
                    runAction({ actionId: "brew.services.restart", label: "重启服务", params: { formula: "redis" } })
                  }
                />
                <PanelButton
                  label="停止"
                  danger
                  disabled={busy}
                  onClick={() =>
                    runAction({ actionId: "brew.services.stop", label: "停止服务", params: { formula: "redis" } })
                  }
                />
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  runAction({ actionId: "brew.services.start", label: "启动服务", params: { formula: "redis" } })
                }
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ▶ 启动
              </button>
            )
          )}
          <button
            onClick={load}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
          >
            刷新
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!detail && !error && (
        <div className="mt-8 space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-zinc-900" />
          <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
        </div>
      )}

      {detail && !running && (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <p className="text-zinc-400">Redis 服务未运行</p>
          <p className="mt-1 font-mono text-xs text-zinc-600">{detail.detail}</p>
          <p className="mt-4 text-xs text-zinc-500">点击右上角「▶ 启动」启动服务后查看详情</p>
        </div>
      )}

      {detail && running && (
        <>
          {/* 概要 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard label="端口 / 模式" value={`${detail.port} · ${detail.mode}`} accent />
            <InfoCard label="运行时长" value={formatUptime(detail.uptimeSeconds ?? 0)} />
            <InfoCard
              label="内存占用"
              value={`${detail.usedMemory}（峰值 ${detail.usedMemoryPeak}）`}
            />
            <InfoCard
              label="客户端连接 / 总键数"
              value={`${detail.connectedClients} / ${detail.totalKeys}`}
            />
          </div>

          {/* keyspace */}
          <section className="mt-8 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400">
              Keyspace（{detail.dbs?.length ?? 0} 个 db 有数据）
            </h2>
            {(detail.dbs?.length ?? 0) === 0 && (
              <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-600">
                所有 db 均为空
              </p>
            )}
            {detail.dbs?.map((db) => (
              <div key={db.db} className="overflow-hidden rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
                  <span className="font-mono text-sm font-medium text-zinc-200">
                    db{db.db}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {db.keys} keys · {db.expires} 个带过期时间
                    </span>
                  </span>
                  <PanelButton
                    label="⚠️ FLUSHDB"
                    danger
                    disabled={busy}
                    onClick={() =>
                      runAction({ actionId: "redis.flushdb", label: "清空数据库（FLUSHDB）", params: { db: String(db.db) }, targetText: `db${db.db}` })
                    }
                  />
                </div>
                {db.sampleKeys.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-600">（无 key 样例）</p>
                ) : (
                  db.sampleKeys.map((k) => (
                    <div
                      key={k.key}
                      className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2 last:border-0"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200" title={k.key}>
                        {k.key}
                      </span>
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                        {k.type}
                      </span>
                      <span className="w-20 shrink-0 text-right font-mono text-[11px] text-zinc-500">
                        {k.ttl === -1 ? "永久" : k.ttl < 0 ? "—" : `${k.ttl}s`}
                      </span>
                      <PanelButton
                        label="删除"
                        danger
                        disabled={busy}
                        onClick={() =>
                          runAction({ actionId: "redis.del-key", label: "删除 key", params: { key: k.key }, targetText: k.key })
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
