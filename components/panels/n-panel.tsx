"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface NDetail {
  current: string;
  prefix: string;
  versionsDir: string;
  writable: boolean;
  versions: Array<{ version: string; size: string | null; current: boolean; path: string }>;
  releases: Array<{ version: string; lts: string | null; date: string }>;
}

export function NDetailPanel() {
  const [detail, setDetail] = useState<NDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customVersion, setCustomVersion] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/n");
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          n <span className="ml-2 text-sm font-normal text-zinc-500">Node 版本管理器</span>
        </h1>
        <button
          onClick={load}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
        >
          刷新
        </button>
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

      {detail && (
        <>
          {/* 概要 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoCard label="当前激活" value={`v${detail.current}`} accent />
            <InfoCard label="版本目录" value={detail.versionsDir} mono />
            <InfoCard
              label="目录可写"
              value={detail.writable ? "✓ 可写" : "✗ 需 sudo"}
              warn={!detail.writable}
            />
          </div>
          {!detail.writable && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              ⚠️ 版本目录不可写，安装/切换/删除操作可能因权限失败（n 默认写入 {detail.prefix}）
            </p>
          )}

          {/* 已安装版本 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              已安装版本（{detail.versions.length}）
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              {detail.versions.map((v) => (
                <div
                  key={v.version}
                  className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-3 last:border-0"
                >
                  <span
                    className={`size-2 rounded-full ${v.current ? "bg-emerald-400" : "bg-zinc-700"}`}
                  />
                  <span className="font-mono text-sm font-medium text-zinc-100">
                    v{v.version}
                  </span>
                  {v.current && (
                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      当前
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-zinc-500">
                    {v.size ?? "—"}
                  </span>
                  <div className="flex gap-1.5">
                    {!v.current && (
                      <>
                        <PanelButton
                          label="设为默认"
                          disabled={busy}
                          onClick={() =>
                            runAction({ actionId: "n.use", label: "设为默认版本", params: { version: v.version }, targetText: v.version })
                          }
                        />
                        <PanelButton
                          label="删除"
                          danger
                          disabled={busy}
                          onClick={() =>
                            runAction({ actionId: "n.rm", label: "删除版本", params: { version: v.version }, targetText: v.version })
                          }
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 安装新版本 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">安装新版本</h2>
            <div className="rounded-xl border border-zinc-800 p-4">
              {detail.releases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detail.releases.slice(0, 6).map((r) => (
                    <button
                      key={r.version}
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "n.install-version", label: "安装", params: { version: r.version }, targetText: r.version })
                      }
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
                    >
                      {r.version}
                      {r.lts && (
                        <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] text-emerald-400">
                          LTS
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  value={customVersion}
                  onChange={(e) => setCustomVersion(e.target.value)}
                  placeholder="自定义版本，如 22.14.0 / lts"
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
                />
                <button
                  disabled={busy || !customVersion.trim()}
                  onClick={() => {
                    runAction({ actionId: "n.install-version", label: "安装", params: { version: customVersion.trim() }, targetText: customVersion.trim() });
                    setCustomVersion("");
                  }}
                  className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                >
                  安装
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
