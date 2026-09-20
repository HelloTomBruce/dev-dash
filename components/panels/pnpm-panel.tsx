"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface PnpmDetail {
  version: string;
  packages: Array<{ name: string; version: string | null }>;
  globalRoot: string | null;
  configIssue: string | null;
  storePath: string;
}

export function PnpmDetailPanel() {
  const [detail, setDetail] = useState<PnpmDetail | null>(null);
  const [storeSize, setStoreSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installName, setInstallName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/pnpm");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setDetail(j);
      // store 大小较慢，异步获取
      fetch("/api/tools/pnpm?sizes=1")
        .then((r) => r.json())
        .then((s) => !s.error && setStoreSize(s.storeSize))
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          pnpm
          {detail?.version && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {detail.version}
            </span>
          )}
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
          {/* 配置诊断 */}
          {detail.configIssue && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3">
              <p className="text-xs font-medium text-amber-300">⚠️ 全局目录配置问题</p>
              <p className="mt-1 font-mono text-[11px] text-amber-200/80">{detail.configIssue}</p>
              <p className="mt-2 text-[11px] text-zinc-500">
                提示：执行 <code className="text-zinc-300">pnpm setup</code> 并重启 shell 可修复；当前 pnpm 全局装的包不会出现在 PATH 中。
              </p>
            </div>
          )}

          {/* 概要 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoCard label="全局包" value={String(detail.packages.length)} />
            <InfoCard label="Store 占用" value={storeSize ?? "计算中…"} />
            <InfoCard label="Store 路径" value={detail.storePath} mono />
          </div>

          {/* Store 管理 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">Store 管理</h2>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3.5">
              <div>
                <p className="text-sm text-zinc-200">内容寻址存储（所有项目共享）</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  store prune 会移除没有任何项目引用的内容，不影响使用中的依赖
                </p>
              </div>
              <PanelButton
                label={`store prune（${storeSize ?? "…"}）`}
                disabled={busy}
                onClick={() => runAction({ actionId: "pnpm.store-prune", label: "清理 store 无引用内容" })}
              />
            </div>
          </section>

          {/* 全局包 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              全局包（{detail.packages.length}）
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              {detail.packages.length === 0 && (
                <p className="px-4 py-4 text-center text-xs text-zinc-600">
                  未通过 pnpm 全局安装任何包（你的 pnpm 本体是 npm 全局装的）
                </p>
              )}
              {detail.packages.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                    {p.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-500">{p.version}</span>
                  <div className="flex shrink-0 gap-1.5">
                    <PanelButton
                      label="升级"
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "pnpm.update-g", label: "升级全局包", params: { pkg: p.name }, targetText: p.name })
                      }
                    />
                    <PanelButton
                      label="卸载"
                      danger
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "pnpm.uninstall-g", label: "卸载全局包", params: { pkg: p.name }, targetText: p.name })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
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
                  runAction({ actionId: "pnpm.install-g", label: "安装全局包", params: { pkg: installName.trim() }, targetText: installName.trim() });
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
