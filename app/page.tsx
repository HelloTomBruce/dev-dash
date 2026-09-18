"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToolCard } from "@/components/tool-card";
import { InventoryDrawer } from "@/components/inventory-drawer";
import { CATEGORY_META, type Category, type ScanResult } from "@/lib/detectors/types";
import { INVENTORY_META, type InventoryMeta } from "@/lib/inventories/meta";
import { ACTION_META, COMMON_ACTIONS, SERVICE_ACTIONS, TOOL_ACTIONS, type ToolActionDef } from "@/lib/actions/meta";
import { ActionResultModal, type ResultModalState } from "@/components/action-result-modal";
import type { HealthCheckResult } from "@/lib/health/providers";

const AUTO_REFRESH_MS = 30_000;

const CATEGORY_ORDER: Category[] = [
  "runtime",
  "version-manager",
  "package-manager",
  "container",
  "database",
  "base-tool",
];

export default function Home() {
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drawer, setDrawer] = useState<InventoryMeta | null>(null);
  const [health, setHealth] = useState<Record<string, HealthCheckResult>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [resultModal, setResultModal] = useState<ResultModalState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScan = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const [scanRes, healthRes] = await Promise.all([
        fetch(`/api/scan${force ? "?force=1" : ""}`),
        fetch(`/api/health${force ? "?force=1" : ""}`),
      ]);
      if (!scanRes.ok) throw new Error(`HTTP ${scanRes.status}`);
      const json: ScanResult = await scanRes.json();
      setData(json);
      if (healthRes.ok) {
        const hj: { results: HealthCheckResult[] } = await healthRes.json();
        setHealth(
          Object.fromEntries(hj.results.map((h) => [h.toolId, h]))
        );
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // setTimeout 避免在 effect 体内同步 setState（react-hooks/set-state-in-effect）
    const t = setTimeout(() => fetchScan(true), 0);
    return () => clearTimeout(t);
  }, [fetchScan]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => fetchScan(false), AUTO_REFRESH_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchScan]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  /** 执行服务启停动作 */
  const runServiceAction = useCallback(
    async (toolId: string, kind: "start" | "stop") => {
      const svc = SERVICE_ACTIONS[toolId];
      const ref = kind === "start" ? svc?.start : svc?.stop;
      if (!ref) return;
      const meta = ACTION_META[ref.actionId];
      if (meta && meta.level !== "safe" && !window.confirm(`确认${meta.label}？`)) {
        return;
      }
      setActionBusy(toolId);
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ref.actionId, params: ref.params }),
        });
        const j = await res.json();
        setToast({
          msg: j.ok
            ? `${j.label ?? ref.actionId}成功（${j.durationMs}ms）`
            : `${j.label ?? ref.actionId}失败：${j.error ?? "未知错误"}`,
          type: j.ok ? "ok" : "err",
        });
        // 刷新扫描 + 健康状态（强制绕过缓存）
        await fetchScan(true);
      } catch (e) {
        setToast({ msg: `请求失败：${String(e)}`, type: "err" });
      } finally {
        setActionBusy(null);
        setTimeout(() => setToast(null), 4000);
      }
    },
    [fetchScan]
  );

  /** 执行工具操作菜单项（通用复制 + 服务端动作） */
  const runToolAction = useCallback(
    async (
      tool: { id: string; name: string; version: string | null; path: string | null },
      def: ToolActionDef
    ) => {
      // 纯前端操作
      if (def.clientAction === "copy-version" && tool.version) {
        handleCopy(tool.version);
        return;
      }
      if (def.clientAction === "copy-path" && tool.path) {
        handleCopy(tool.path);
        return;
      }
      if (!def.actionId) return;

      // 分级确认
      if (def.level === "careful" && !window.confirm(`确认执行「${def.label}」？（${tool.name}）`)) {
        return;
      }
      if (def.level === "dangerous" && !window.confirm(`⚠️ 危险操作「${def.label}」（${tool.name}）\n\n该操作会删除数据，确认继续？`)) {
        return;
      }

      // open-dir 的 dir 参数从工具路径推导
      const params =
        def.actionId === "tool.open-dir" && tool.path
          ? { dir: tool.path.split("/").slice(0, -1).join("/") }
          : def.params;

      setActionBusy(`${tool.id}:${def.key}`);
      setResultModal({ title: `${tool.name} · ${def.label}`, loading: true, result: null });
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: def.actionId, params }),
        });
        const j = await res.json();
        setResultModal({ title: `${tool.name} · ${def.label}`, loading: false, result: j });
        if (j.ok && def.refreshAfter) {
          await fetchScan(true);
        }
      } catch (e) {
        setResultModal({
          title: `${tool.name} · ${def.label}`,
          loading: false,
          result: { ok: false, actionId: def.actionId, command: "", output: "", error: String(e), durationMs: 0 },
        });
      } finally {
        setActionBusy(null);
      }
    },
    [fetchScan, handleCopy]
  );

  /** 工具的操作菜单 = 通用操作 + 工具专属操作 */
  const actionsFor = useCallback(
    (tool: { id: string; status: string }): ToolActionDef[] => {
      if (tool.status !== "ok") return [];
      return [...COMMON_ACTIONS, ...(TOOL_ACTIONS[tool.id] ?? [])];
    },
    []
  );

  /** toolId → 可用清单（仅工具安装成功时显示入口） */
  const inventoriesByTool = useMemo(() => {
    const map = new Map<string, InventoryMeta[]>();
    for (const inv of INVENTORY_META) {
      const tool = data?.tools.find((t) => t.id === inv.toolId);
      if (tool && tool.status === "ok") {
        map.set(inv.toolId, [...(map.get(inv.toolId) ?? []), inv]);
      }
    }
    return map;
  }, [data]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* 顶栏 */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            DevDash
            <span className="ml-3 text-sm font-normal text-zinc-500">
              本地开发环境仪表盘
            </span>
          </h1>
          {data && (
            <p className="mt-1 text-xs text-zinc-500">
              上次扫描 {new Date(data.scannedAt).toLocaleTimeString("zh-CN")} ·
              耗时 {data.durationMs}ms
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-emerald-500"
            />
            自动刷新 30s
          </label>
          <button
            onClick={() => fetchScan(true)}
            disabled={refreshing}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-sm text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-50"
          >
            {refreshing ? "扫描中…" : "刷新"}
          </button>
        </div>
      </header>

      {/* 概览条 */}
      {data && (
        <div className="mt-6 flex flex-wrap gap-3">
          <StatCard
            label="已安装"
            value={data.summary.installed}
            tone="emerald"
          />
          <StatCard label="未安装" value={data.summary.notFound} tone="zinc" />
          <StatCard
            label="异常"
            value={data.summary.errors}
            tone={data.summary.errors > 0 ? "red" : "zinc"}
          />
          <StatCard label="检测总数" value={data.summary.total} tone="zinc" />
          {Object.keys(health).length > 0 && (
            <StatCard
              label="服务运行中"
              value={
                Object.values(health).filter((h) => h.status === "running").length
              }
              tone="emerald"
            />
          )}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-400">
          加载失败：{error}
        </div>
      )}

      {/* 加载骨架 */}
      {loading && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40"
            />
          ))}
        </div>
      )}

      {/* 分类工具区 */}
      {data &&
        CATEGORY_ORDER.map((cat) => {
          const tools = data.tools.filter((t) => t.category === cat);
          if (tools.length === 0) return null;
          return (
            <section key={cat} className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-400">
                <span>{CATEGORY_META[cat].icon}</span>
                {CATEGORY_META[cat].label}
                <span className="text-xs font-normal text-zinc-600">
                  {tools.filter((t) => t.status === "ok").length}/{tools.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {tools.map((t) => (
                  <ToolCard
                    key={t.id}
                    tool={t}
                    inventories={inventoriesByTool.get(t.id) ?? []}
                    health={health[t.id] ?? null}
                    service={
                      SERVICE_ACTIONS[t.id]
                        ? {
                            busy: actionBusy === t.id,
                            onStart: () => runServiceAction(t.id, "start"),
                            onStop: () => runServiceAction(t.id, "stop"),
                          }
                        : null
                    }
                    actions={actionsFor(t)}
                    actionBusy={actionBusy?.startsWith(`${t.id}:`) ?? false}
                    onRunAction={(def) => runToolAction(t, def)}
                    onOpenInventory={setDrawer}
                    onCopy={handleCopy}
                  />
                ))}
              </div>
            </section>
          );
        })}

      {/* 操作结果 Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            toast.type === "ok"
              ? "border-emerald-500/40 bg-emerald-950 text-emerald-300"
              : "border-red-500/40 bg-red-950 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* 复制提示 */}
      {copied && !drawer && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-200 shadow-lg">
          已复制 {copied}
        </div>
      )}

      {/* 已装清单抽屉 */}
      {drawer && (
        <InventoryDrawer entry={drawer} onClose={() => setDrawer(null)} />
      )}

      {/* 操作执行结果弹窗 */}
      {resultModal && (
        <ActionResultModal
          state={resultModal}
          onClose={() => setResultModal(null)}
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "red" | "zinc";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "red"
        ? "text-red-400"
        : "text-zinc-300";
  return (
    <div className="flex items-baseline gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <span className={`text-2xl font-bold tabular-nums ${toneCls}`}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
