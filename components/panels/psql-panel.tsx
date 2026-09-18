"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface PsqlDetail {
  status: "running" | "stopped";
  detail: string | null;
  serverVersion?: string;
  port?: string;
  dataDir?: string;
  connections?: number;
  databases?: Array<{ name: string; size: string; owner: string; connections: number }>;
  roles?: Array<{ name: string; attrs: string[] }>;
}

const PROTECTED_DBS = new Set(["postgres", "template0", "template1"]);

export function PsqlDetailPanel() {
  const [detail, setDetail] = useState<PsqlDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newDb, setNewDb] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/psql");
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

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const running = detail?.status === "running";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          PostgreSQL
          {detail?.serverVersion && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {detail.serverVersion}
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
              title={detail.detail ?? ""}
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
                    runAction({ actionId: "brew.services.restart", label: "重启服务", params: { formula: "postgresql@17" } })
                  }
                />
                <PanelButton
                  label="停止"
                  danger
                  disabled={busy}
                  onClick={() =>
                    runAction({ actionId: "brew.services.stop", label: "停止服务", params: { formula: "postgresql@17" } })
                  }
                />
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  runAction({ actionId: "brew.services.start", label: "启动服务", params: { formula: "postgresql@17" } })
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
          <p className="text-zinc-400">PostgreSQL 服务未运行</p>
          <p className="mt-1 font-mono text-xs text-zinc-600">{detail.detail}</p>
          <p className="mt-4 text-xs text-zinc-500">点击右上角「▶ 启动」启动服务后查看数据库信息</p>
        </div>
      )}

      {detail && running && (
        <>
          {/* 概要 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard label="端口" value={detail.port ?? "—"} accent />
            <InfoCard label="活动连接" value={String(detail.connections ?? 0)} />
            <InfoCard label="数据库" value={String(detail.databases?.length ?? 0)} />
            <InfoCard label="数据目录" value={detail.dataDir ?? "—"} mono />
          </div>

          {/* 数据库列表 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              数据库（{detail.databases?.length ?? 0}）
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <div className="grid grid-cols-[1fr_80px_110px_70px_auto] gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 text-[11px] font-medium text-zinc-500">
                <span>名称</span>
                <span>大小</span>
                <span>属主</span>
                <span>连接</span>
                <span className="text-right">操作</span>
              </div>
              {detail.databases?.map((db) => (
                <div
                  key={db.name}
                  className="grid grid-cols-[1fr_80px_110px_70px_auto] items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5 last:border-0"
                >
                  <span className="truncate font-mono text-sm text-zinc-100">{db.name}</span>
                  <span className="font-mono text-xs text-zinc-400">{db.size}</span>
                  <span className="truncate text-xs text-zinc-500">{db.owner}</span>
                  <span className={`font-mono text-xs ${db.connections > 0 ? "text-emerald-400" : "text-zinc-600"}`}>
                    {db.connections}
                  </span>
                  <div className="flex justify-end gap-1.5">
                    <PanelButton
                      label="复制连接串"
                      onClick={() => copy(`postgresql://localhost:${detail.port}/${db.name}`)}
                    />
                    {!PROTECTED_DBS.has(db.name) && (
                      <PanelButton
                        label="删除"
                        danger
                        disabled={busy || db.connections > 0}
                        onClick={() =>
                          runAction({ actionId: "pg.dropdb", label: "删除数据库", params: { name: db.name }, targetText: db.name })
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 新建数据库 */}
            <div className="mt-3 flex gap-2">
              <input
                value={newDb}
                onChange={(e) => setNewDb(e.target.value)}
                placeholder="新数据库名（字母/数字/下划线）"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
              <button
                disabled={busy || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(newDb.trim())}
                onClick={() => {
                  runAction({ actionId: "pg.createdb", label: "新建数据库", params: { name: newDb.trim() }, targetText: newDb.trim() });
                  setNewDb("");
                }}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ＋ 新建
              </button>
            </div>
          </section>

          {/* 角色 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              角色（{detail.roles?.length ?? 0}）
            </h2>
            <div className="flex flex-wrap gap-2">
              {detail.roles?.map((r) => (
                <span
                  key={r.name}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono text-zinc-200">{r.name}</span>
                  {r.attrs.length > 0 && (
                    <span className="ml-2 text-[10px] text-zinc-500">{r.attrs.join(" · ")}</span>
                  )}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}

      {copied && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-200 shadow-lg">
          已复制 {copied}
        </div>
      )}
    </main>
  );
}
