"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface ContainerDetail {
  status: "running" | "stopped";
  version: string | null;
  kernelConfigured: boolean;
  containers: Array<Record<string, unknown>>;
  images: Array<Record<string, unknown>>;
  systemInfo?: {
    containersTotal?: string;
    containersRunning?: string;
    imagesTotal?: string;
    serverVersion?: string;
  };
}

export function ContainerDetailPanel() {
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/container");
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
          Apple Container
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
              {running ? "apiserver 运行中" : "已停止"}
            </span>
          )}
          {detail &&
            (running ? (
              <>
                <PanelButton
                  label="清理已停止容器"
                  disabled={busy}
                  onClick={() => runAction({ actionId: "container.prune", label: "清理已停止容器" })}
                />
                <PanelButton
                  label="停止系统"
                  danger
                  disabled={busy}
                  onClick={() => runAction({ actionId: "container.system.stop", label: "停止容器系统" })}
                />
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() => runAction({ actionId: "container.system.start", label: "启动容器系统" })}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ▶ 启动系统
              </button>
            ))}
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
            <InfoCard
              label="内核"
              value={detail.kernelConfigured ? "✓ 已配置" : "✗ 未配置"}
              accent={detail.kernelConfigured}
              warn={!detail.kernelConfigured}
            />
            <InfoCard
              label="容器（运行/总数）"
              value={
                running
                  ? `${detail.systemInfo?.containersRunning ?? detail.containers.length} / ${detail.systemInfo?.containersTotal ?? detail.containers.length}`
                  : "—"
              }
            />
            <InfoCard label="镜像" value={running ? String(detail.systemInfo?.imagesTotal ?? detail.images.length) : "—"} />
          </div>

          {!detail.kernelConfigured && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              ⚠️ 未配置默认内核。首次运行容器前需执行：
              <code className="ml-1 font-mono">container system kernel set --recommended</code>
            </p>
          )}

          {!running && (
            <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
              <p className="text-zinc-400">容器系统未运行</p>
              <p className="mt-4 text-xs text-zinc-500">
                点击右上角「▶ 启动系统」后可管理容器与镜像
              </p>
            </div>
          )}

          {running && (
            <>
              {/* 容器 */}
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold text-zinc-400">
                  容器（{detail.containers.length}）
                </h2>
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  {detail.containers.length === 0 && (
                    <p className="px-4 py-4 text-center text-xs text-zinc-600">
                      暂无容器。试试：container run --rm alpine echo hello
                    </p>
                  )}
                  {detail.containers.map((c) => {
                    const id = String(c.id);
                    const state = String(c.state).toLowerCase();
                    const isRunning = state === "running";
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-0"
                      >
                        <span className={`size-2 shrink-0 rounded-full ${isRunning ? "bg-emerald-400" : "bg-zinc-600"}`} />
                        <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-100" title={id}>
                          {id}
                        </span>
                        <span className="shrink-0 truncate font-mono text-[11px] text-zinc-500">
                          {String(c.image)}
                        </span>
                        <div className="flex shrink-0 gap-1.5">
                          {isRunning ? (
                            <PanelButton
                              label="停止"
                              disabled={busy}
                              onClick={() => runAction({ actionId: "container.stop-one", label: "停止容器", params: { id }, targetText: id })}
                            />
                          ) : (
                            <PanelButton
                              label="启动"
                              disabled={busy}
                              onClick={() => runAction({ actionId: "container.start-one", label: "启动容器", params: { id }, targetText: id })}
                            />
                          )}
                          <PanelButton
                            label="删除"
                            danger
                            disabled={busy}
                            onClick={() => runAction({ actionId: "container.rm", label: "删除容器", params: { id }, targetText: id })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 镜像 */}
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold text-zinc-400">
                  镜像（{detail.images.length}）
                </h2>
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  {detail.images.length === 0 && (
                    <p className="px-4 py-4 text-center text-xs text-zinc-600">暂无镜像</p>
                  )}
                  {detail.images.map((img) => {
                    const ref = String(img.reference);
                    return (
                      <div
                        key={ref}
                        className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-0"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200" title={ref}>
                          {ref}
                        </span>
                        {img.size != null && (
                          <span className="shrink-0 font-mono text-xs text-zinc-500">{String(img.size)}</span>
                        )}
                        <PanelButton
                          label="删除"
                          danger
                          disabled={busy}
                          onClick={() => runAction({ actionId: "container.image-rm", label: "删除镜像", params: { ref }, targetText: ref })}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
