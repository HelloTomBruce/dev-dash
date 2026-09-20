"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface BrewPackage {
  name: string;
  version: string;
  outdated: string | null;
  leaf?: boolean;
}

interface BrewDetail {
  version: string;
  prefix: string;
  formulae: BrewPackage[];
  casks: BrewPackage[];
  outdatedCount: number;
  outdatedCaskCount: number;
}

interface BrewSizes {
  cellarSize: string | null;
  cacheSize: string | null;
}

export function BrewDetailPanel() {
  const [detail, setDetail] = useState<BrewDetail | null>(null);
  const [sizes, setSizes] = useState<BrewSizes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/brew");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setDetail(j);
      // 目录大小较慢，主体渲染后异步获取
      fetch("/api/tools/brew?sizes=1")
        .then((r) => r.json())
        .then((s) => !s.error && setSizes(s))
        .catch(() => {});
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const { modal, busy, runAction, closeModal } = useActionRunner(() => load());

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const outdatedFormulae = useMemo(
    () => detail?.formulae.filter((f) => f.outdated) ?? [],
    [detail]
  );

  const filtered = useMemo(() => {
    const list = detail?.formulae ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((f) => f.name.toLowerCase().includes(q));
  }, [detail, search]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Homebrew
          {detail?.version && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {detail.version}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <PanelButton
            label="brew update"
            disabled={busy}
            onClick={() => runAction({ actionId: "brew.update", label: "brew update" })}
          />
          <PanelButton
            label={`清理缓存（${sizes?.cacheSize ?? "…"}）`}
            disabled={busy}
            onClick={() => runAction({ actionId: "brew.cleanup", label: "清理旧版本缓存" })}
          />
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
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard label="Formula" value={String(detail.formulae.length)} />
            <InfoCard label="Cask" value={String(detail.casks.length)} />
            <InfoCard
              label="可升级"
              value={String(detail.outdatedCount + detail.outdatedCaskCount)}
              accent={detail.outdatedCount + detail.outdatedCaskCount === 0}
              warn={detail.outdatedCount + detail.outdatedCaskCount > 0}
            />
            <InfoCard label="Cellar 占用" value={sizes?.cellarSize ?? "计算中…"} />
          </div>

          {/* 过期包 */}
          {outdatedFormulae.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-400">
                  ⚠️ 可升级（{outdatedFormulae.length}）
                </h2>
                <PanelButton
                  label="全部升级"
                  disabled={busy}
                  onClick={() => runAction({ actionId: "brew.upgrade-all", label: "升级所有 formula" })}
                />
              </div>
              <div className="overflow-hidden rounded-xl border border-amber-500/30">
                {outdatedFormulae.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-3 border-b border-amber-500/10 bg-amber-950/10 px-4 py-2.5 last:border-0"
                  >
                    <span className="font-mono text-sm text-zinc-100">{f.name}</span>
                    <span className="font-mono text-xs text-zinc-500">
                      {f.version} → <span className="text-amber-400">{f.outdated}</span>
                    </span>
                    <div className="ml-auto">
                      <PanelButton
                        label="升级"
                        disabled={busy}
                        onClick={() =>
                          runAction({ actionId: "brew.upgrade", label: "brew upgrade", params: { formula: f.name }, targetText: f.name })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 全部软件包 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              软件包（{detail.formulae.length}）
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
              {filtered.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                    {f.name}
                  </span>
                  {f.leaf && (
                    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
                      主装
                    </span>
                  )}
                  {f.outdated && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400">
                      可升级
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs text-zinc-500">{f.version}</span>
                  <div className="flex shrink-0 gap-1.5">
                    {f.outdated && (
                      <PanelButton
                        label="升级"
                        disabled={busy}
                        onClick={() =>
                          runAction({ actionId: "brew.upgrade", label: "brew upgrade", params: { formula: f.name }, targetText: f.name })
                        }
                      />
                    )}
                    <PanelButton
                      label="卸载"
                      danger
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "brew.uninstall", label: "卸载软件包", params: { formula: f.name }, targetText: f.name })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cask */}
          {detail.casks.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-zinc-400">
                Cask（{detail.casks.length}）
              </h2>
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                {detail.casks.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2 last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                      {c.name}
                    </span>
                    {c.outdated && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400">
                        可升级 → {c.outdated}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-xs text-zinc-500">{c.version}</span>
                    {c.outdated && (
                      <PanelButton
                        label="升级"
                        disabled={busy}
                        onClick={() =>
                          runAction({ actionId: "brew.upgrade-cask", label: "brew upgrade --cask", params: { formula: c.name }, targetText: c.name })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
