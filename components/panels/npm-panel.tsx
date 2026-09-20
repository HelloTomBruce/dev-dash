"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface NpmPackage {
  name: string;
  current: string | null;
  latest: string | null;
  wanted: string | null;
}

interface NpmDetail {
  version: string;
  prefix: string;
  registry: string;
  packages: NpmPackage[];
  outdatedCount: number;
}

export function NpmDetailPanel() {
  const [detail, setDetail] = useState<NpmDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [installName, setInstallName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/npm");
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

  const outdated = useMemo(
    () => detail?.packages.filter((p) => p.latest) ?? [],
    [detail]
  );

  const filtered = useMemo(() => {
    const list = detail?.packages ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [detail, search]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          npm
          {detail?.version && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {detail.version}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {detail && (
            <span
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-400"
              title="当前 registry"
            >
              {detail.registry.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </span>
          )}
          {outdated.length > 0 && (
            <PanelButton
              label="全部升级"
              disabled={busy}
              onClick={() => runAction({ actionId: "npm.update-g-all", label: "升级所有全局包" })}
            />
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

      {detail && (
        <>
          {/* 概要 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoCard label="全局包" value={String(detail.packages.length)} />
            <InfoCard
              label="可升级"
              value={String(detail.outdatedCount)}
              accent={detail.outdatedCount === 0}
              warn={detail.outdatedCount > 0}
            />
            <InfoCard label="全局目录" value={detail.prefix} mono />
          </div>

          {/* 过期包 */}
          {outdated.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-amber-400">
                ⚠️ 可升级（{outdated.length}）
              </h2>
              <div className="overflow-hidden rounded-xl border border-amber-500/30">
                {outdated.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-3 border-b border-amber-500/10 bg-amber-950/10 px-4 py-2.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-100">
                      {p.name}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      {p.current} → <span className="text-amber-400">{p.latest}</span>
                    </span>
                    <PanelButton
                      label="升级"
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "npm.update-g", label: "升级全局包", params: { pkg: p.name }, targetText: p.name })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 全局包 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              全局包（{detail.packages.length}）
            </h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索包名…"
              className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
            />
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              {filtered.length === 0 && (
                <p className="px-4 py-4 text-center text-xs text-zinc-600">无匹配项</p>
              )}
              {filtered.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                    {p.name}
                  </span>
                  {p.latest && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400">
                      可升级
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs text-zinc-500">{p.current}</span>
                  <div className="flex shrink-0 gap-1.5">
                    {p.latest && (
                      <PanelButton
                        label="升级"
                        disabled={busy}
                        onClick={() =>
                          runAction({ actionId: "npm.update-g", label: "升级全局包", params: { pkg: p.name }, targetText: p.name })
                        }
                      />
                    )}
                    <PanelButton
                      label="卸载"
                      danger
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "npm.uninstall-g", label: "卸载全局包", params: { pkg: p.name }, targetText: p.name })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 安装新包 */}
            <div className="mt-3 flex gap-2">
              <input
                value={installName}
                onChange={(e) => setInstallName(e.target.value)}
                placeholder="安装新包，如 typescript 或 @scope/pkg"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
              <button
                disabled={busy || !installName.trim()}
                onClick={() => {
                  runAction({ actionId: "npm.install-g", label: "安装全局包", params: { pkg: installName.trim() }, targetText: installName.trim() });
                  setInstallName("");
                }}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ＋ 安装
              </button>
            </div>
          </section>
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
