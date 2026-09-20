"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface UvDetail {
  version: string;
  tools: Array<{ name: string; version: string; bins: string[] }>;
  pythons: Array<{
    version: string;
    implementation: string;
    path: string;
    managedByUv: boolean;
  }>;
}

const PYTHON_QUICK_INSTALL = ["3.14", "3.13", "3.12", "3.11"];

export function UvDetailPanel() {
  const [detail, setDetail] = useState<UvDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolName, setToolName] = useState("");
  const [pyVersion, setPyVersion] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/uv");
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

  const installedPyMajors = new Set(
    detail?.pythons.map((p) => p.version.split(".").slice(0, 2).join(".")) ?? []
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          uv
          {detail?.version && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {detail.version}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <PanelButton
            label="升级所有工具"
            disabled={busy}
            onClick={() => runAction({ actionId: "uv.tool-upgrade-all", label: "升级所有 uv 工具" })}
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
          <div className="mt-6 grid grid-cols-2 gap-3">
            <InfoCard label="uv 工具" value={String(detail.tools.length)} />
            <InfoCard label="Python 解释器" value={String(detail.pythons.length)} />
          </div>

          {/* uv 工具 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              uv 工具（{detail.tools.length}）
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              {detail.tools.length === 0 && (
                <p className="px-4 py-4 text-center text-xs text-zinc-600">未安装任何工具</p>
              )}
              {detail.tools.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-sm text-zinc-100">{t.name}</span>
                    {t.bins.length > 0 && (
                      <p className="truncate font-mono text-[10px] text-zinc-600">
                        bins: {t.bins.join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-xs text-emerald-400">
                    {t.version}
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <PanelButton
                      label="升级"
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "uv.tool-upgrade", label: "升级 uv 工具", params: { name: t.name }, targetText: t.name })
                      }
                    />
                    <PanelButton
                      label="卸载"
                      danger
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "uv.tool-uninstall", label: "卸载 uv 工具", params: { name: t.name }, targetText: t.name })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="安装新工具，如 ruff / black"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
              <button
                disabled={busy || !toolName.trim()}
                onClick={() => {
                  runAction({ actionId: "uv.tool-install", label: "安装 uv 工具", params: { name: toolName.trim() }, targetText: toolName.trim() });
                  setToolName("");
                }}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ＋ 安装
              </button>
            </div>
          </section>

          {/* uv 管理的 Python */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              Python 解释器（{detail.pythons.length}）
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              {detail.pythons.map((p) => (
                <div
                  key={p.version}
                  className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-0"
                >
                  <span className="font-mono text-sm text-zinc-100">{p.version}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] ${
                      p.managedByUv
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-zinc-500/15 text-zinc-400"
                    }`}
                  >
                    {p.managedByUv ? "uv 托管" : "外部"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500" title={p.path}>
                    {p.path}
                  </span>
                  {p.managedByUv && (
                    <PanelButton
                      label="卸载"
                      danger
                      disabled={busy}
                      onClick={() =>
                        runAction({ actionId: "uv.python-uninstall", label: "卸载 Python", params: { version: p.version }, targetText: p.version })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {PYTHON_QUICK_INSTALL.filter((v) => !installedPyMajors.has(v)).map((v) => (
                <button
                  key={v}
                  disabled={busy}
                  onClick={() =>
                    runAction({ actionId: "uv.python-install", label: "安装 Python", params: { version: v }, targetText: v })
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
                >
                  安装 {v}
                </button>
              ))}
              <input
                value={pyVersion}
                onChange={(e) => setPyVersion(e.target.value)}
                placeholder="或自定义，如 3.10.5"
                className="flex-1 min-w-40 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
              />
              <button
                disabled={busy || !pyVersion.trim()}
                onClick={() => {
                  runAction({ actionId: "uv.python-install", label: "安装 Python", params: { version: pyVersion.trim() }, targetText: pyVersion.trim() });
                  setPyVersion("");
                }}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
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
