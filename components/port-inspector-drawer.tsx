"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortCategory, PortItem, PortsScanResult } from "@/lib/ports/scanner";

interface PortInspectorDrawerProps {
  onClose: () => void;
  onRefreshParent?: () => void;
}

export function PortInspectorDrawer({
  onClose,
  onRefreshParent,
}: PortInspectorDrawerProps) {
  const [data, setData] = useState<PortsScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PortCategory | "all">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmKill, setConfirmKill] = useState<{ item: PortItem; force: boolean } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ports");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PortsScanResult = await res.json();
      setData(json);
    } catch (e) {
      setToast({ msg: `获取端口列表失败: ${e}`, type: "err" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Esc 快捷键关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmKill) {
          setConfirmKill(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmKill, onClose]);

  const handleCopy = useCallback((text: string, label = "已复制") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setToast({ msg: `${label}: ${text}`, type: "ok" });
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const handleKill = async (item: PortItem, force = false) => {
    setActionLoading(item.id);
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "port.kill",
          params: { pid: String(item.pid), force: force ? "true" : "false" },
        }),
      });
      const result = await res.json();
      if (result.ok) {
        setToast({ msg: `端口 ${item.port} (PID ${item.pid}) 已释放`, type: "ok" });
        setConfirmKill(null);
        await load();
        onRefreshParent?.();
      } else {
        setToast({ msg: `释放失败: ${result.error || result.output}`, type: "err" });
      }
    } catch (e) {
      setToast({ msg: `操作失败: ${e}`, type: "err" });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredItems = useMemo(() => {
    if (!data) return [];
    return data.ports.filter((it) => {
      if (categoryFilter !== "all" && it.category !== categoryFilter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        String(it.port).includes(q) ||
        it.processName.toLowerCase().includes(q) ||
        String(it.pid).includes(q) ||
        (it.tag && it.tag.toLowerCase().includes(q)) ||
        it.command.toLowerCase().includes(q)
      );
    });
  }, [data, categoryFilter, search]);

  const categoryCounts = useMemo(() => {
    if (!data) return { all: 0, "dev-server": 0, database: 0, tool: 0, app: 0, system: 0 };
    const counts = { all: data.ports.length, "dev-server": 0, database: 0, tool: 0, app: 0, system: 0 };
    for (const p of data.ports) {
      if (counts[p.category] !== undefined) {
        counts[p.category]++;
      }
    }
    return counts;
  }, [data]);

  const getCategoryBadge = (category: PortCategory, tag?: string) => {
    switch (category) {
      case "dev-server":
        return <span className="rounded bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">{tag || "开发服务"}</span>;
      case "database":
        return <span className="rounded bg-blue-950/80 border border-blue-800/60 px-1.5 py-0.5 text-[11px] font-medium text-blue-400">{tag || "数据库"}</span>;
      case "tool":
        return <span className="rounded bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.5 text-[11px] font-medium text-purple-400">{tag || "开发工具"}</span>;
      case "app":
        return <span className="rounded bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 text-[11px] font-medium text-cyan-400">{tag || "应用"}</span>;
      case "system":
        return <span className="rounded bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">{tag || "系统"}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      {/* 遮罩点击关闭 */}
      <div className="flex-1" onClick={onClose} />

      {/* 抽屉主体 */}
      <div className="flex w-full max-w-2xl flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <span>🔌</span> 全局端口占用监控
              </h2>
              {data && (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                  {data.devPortsCount} 个开发服务 / 共 {data.total} 个监听
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              实时扫描正在监听的本地端口与进程，支持一键安全释放
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              disabled={loading}
              title="刷新端口列表"
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white disabled:opacity-50"
            >
              {loading ? "扫描中…" : "↻ 刷新"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 搜索与分类 Tab */}
        <div className="border-b border-zinc-800/80 px-6 py-3 space-y-3 bg-zinc-900/30">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索端口号 (如 3000)、进程名 (如 node/redis)、PID 或标签..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                categoryFilter === "all"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              全部 ({categoryCounts.all})
            </button>
            <button
              onClick={() => setCategoryFilter("dev-server")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                categoryFilter === "dev-server"
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              开发服务 ({categoryCounts["dev-server"]})
            </button>
            <button
              onClick={() => setCategoryFilter("database")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                categoryFilter === "database"
                  ? "bg-blue-950/80 text-blue-300 border border-blue-800/60"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              数据库 ({categoryCounts.database})
            </button>
            <button
              onClick={() => setCategoryFilter("tool")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                categoryFilter === "tool"
                  ? "bg-purple-950/80 text-purple-300 border border-purple-800/60"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              工具/IDE ({categoryCounts.tool})
            </button>
            <button
              onClick={() => setCategoryFilter("app")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                categoryFilter === "app"
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              应用 ({categoryCounts.app})
            </button>
            <button
              onClick={() => setCategoryFilter("system")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                categoryFilter === "system"
                  ? "bg-zinc-800 text-zinc-200 border border-zinc-700"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              系统 ({categoryCounts.system})
            </button>
          </div>
        </div>

        {/* 端口列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
              <p className="text-xs">正在扫描系统网络与监听端口…</p>
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="py-16 text-center text-xs text-zinc-500">
              {search ? "未找到匹配的端口或进程" : "当前分类下暂无监听端口"}
            </div>
          )}

          {filteredItems.map((item) => {
            const isBusy = actionLoading === item.id;
            return (
              <div
                key={item.id}
                className="group flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* 左侧：端口与标识 */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-zinc-800/90 border border-zinc-700/60 px-2.5 py-1.5 min-w-[68px]">
                      <span className="font-mono text-base font-bold text-zinc-100 tracking-tight">
                        :{item.port}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {item.family}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-200">
                          {item.processName}
                        </span>
                        {getCategoryBadge(item.category, item.tag)}
                        {item.isSelf && (
                          <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 text-[10px]">
                            DevDash (自身)
                          </span>
                        )}
                        <span className="font-mono text-xs text-zinc-400">
                          PID: {item.pid}
                        </span>
                        <span className="text-xs text-zinc-500">
                          ({item.user})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="font-mono text-zinc-400">
                          监听: {item.address}:{item.port}
                        </span>
                        {item.cpuPercent !== undefined && item.cpuPercent > 0 && (
                          <span className="text-zinc-400 font-mono">
                            CPU: {item.cpuPercent.toFixed(1)}%
                          </span>
                        )}
                        {item.memPercent !== undefined && item.memPercent > 0 && (
                          <span className="text-zinc-400 font-mono">
                            内存: {item.memPercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧操作按钮 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(`http://localhost:${item.port}`, "已复制链接")}
                      title="复制本地链接"
                      className="rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    >
                      {copied === `http://localhost:${item.port}` ? "✓" : "🔗"}
                    </button>
                    <button
                      onClick={() => handleCopy(String(item.pid), "已复制 PID")}
                      title="复制 PID"
                      className="rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    >
                      {copied === String(item.pid) ? "✓" : "PID"}
                    </button>

                    {item.isSelf ? (
                      <button
                        disabled
                        className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-600 cursor-not-allowed"
                        title="DevDash 自身服务不可被终止"
                      >
                        受保护
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmKill({ item, force: false })}
                        disabled={isBusy}
                        className="rounded border border-red-900/50 bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/50 hover:text-red-200 hover:border-red-700 disabled:opacity-50"
                      >
                        {isBusy ? "释放中…" : "释放端口"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 展开的完整命令 */}
                <div className="mt-2.5 rounded bg-zinc-950/60 border border-zinc-800/50 px-2.5 py-1.5 text-[11px] font-mono text-zinc-400 break-all select-all">
                  {item.command}
                </div>
              </div>
            );
          })}
        </div>

        {/* 二次确认弹窗 */}
        {confirmKill && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-amber-400">
                <span className="text-xl">⚠️</span>
                <h3 className="font-semibold text-zinc-100">确认终止进程并释放端口？</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                即将终止进程 <strong className="text-zinc-100">{confirmKill.item.processName}</strong> (PID:{" "}
                <span className="font-mono text-amber-300">{confirmKill.item.pid}</span>)，占用端口{" "}
                <strong className="font-mono text-emerald-400">:{confirmKill.item.port}</strong>。
              </p>
              <div className="rounded bg-zinc-950 p-2.5 text-[11px] font-mono text-zinc-400 break-all">
                {confirmKill.item.command}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmKill.force}
                    onChange={(e) =>
                      setConfirmKill({
                        item: confirmKill.item,
                        force: e.target.checked,
                      })
                    }
                    className="accent-red-500"
                  />
                  强制终止 (SIGKILL -9)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmKill(null)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleKill(confirmKill.item, confirmKill.force)}
                    className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors shadow-sm"
                  >
                    {confirmKill.force ? "强制终止 (-9)" : "确认终止"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部浮动 Toast */}
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 rounded-lg px-4 py-2 text-xs font-medium shadow-lg transition-opacity ${
              toast.type === "ok"
                ? "border border-emerald-500/40 bg-emerald-950 text-emerald-200"
                : "border border-red-500/40 bg-red-950 text-red-200"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
