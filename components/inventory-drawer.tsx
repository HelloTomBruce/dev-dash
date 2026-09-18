"use client";

import { useCallback, useEffect, useState } from "react";
import type { InventoryItem, InventoryMeta, InventoryResult } from "@/lib/inventories/meta";

export function InventoryDrawer({
  entry,
  onClose,
}: {
  entry: InventoryMeta;
  onClose: () => void;
}) {
  const [data, setData] = useState<InventoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/inventory?id=${entry.id}${force ? "&force=1" : ""}`
        );
        setData(await res.json());
      } catch (e) {
        setData({
          id: entry.id,
          label: entry.label,
          items: [],
          error: String(e),
          durationMs: 0,
        });
      } finally {
        setLoading(false);
      }
    },
    [entry.id, entry.label]
  );

  useEffect(() => {
    // setTimeout 避免在 effect 体内同步 setState（react-hooks/set-state-in-effect）
    const t = setTimeout(() => load(true), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = (data?.items ?? []).filter((it: InventoryItem) =>
    search
      ? it.name.toLowerCase().includes(search.toLowerCase()) ||
        (it.version ?? "").includes(search)
      : true
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 背景遮罩 */}
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{entry.label}</h2>
            {data && !loading && (
              <p className="mt-0.5 text-xs text-zinc-500">
                {data.error ? "加载失败" : `${data.items.length} 项 · ${data.durationMs}ms`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              {loading ? "加载中…" : "刷新"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="border-b border-zinc-800 px-5 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称或版本…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
            autoFocus
          />
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-900" />
              ))}
            </div>
          )}

          {!loading && data?.error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-400">
              {data.error}
            </div>
          )}

          {!loading && !data?.error && items.length === 0 && (
            <p className="mt-8 text-center text-sm text-zinc-600">
              {search ? "没有匹配项" : "空"}
            </p>
          )}

          {!loading &&
            items.map((it) => (
              <button
                key={`${it.name}-${it.version}`}
                onClick={() => {
                  navigator.clipboard.writeText(
                    it.version ? `${it.name}@${it.version}` : it.name
                  );
                  setCopied(it.name);
                  setTimeout(() => setCopied(null), 1200);
                }}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-900"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-200">
                  {it.name}
                  {it.note && (
                    <span className="ml-2 text-[11px] text-zinc-500">
                      {it.note}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs text-emerald-400">
                  {it.version ?? "—"}
                </span>
              </button>
            ))}
        </div>

        {copied && (
          <div className="border-t border-zinc-800 px-5 py-2 text-center text-xs text-zinc-400">
            已复制 {copied}
          </div>
        )}
      </aside>
    </div>
  );
}
