"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CleanerScanResult, CleanerTarget } from "@/lib/cleaner/scanner";
import { ActionResultModal, type ResultModalState } from "@/components/action-result-modal";

interface DevCleanerDrawerProps {
  onClose: () => void;
  onRefreshParent?: () => void;
}

export function DevCleanerDrawer({
  onClose,
  onRefreshParent,
}: DevCleanerDrawerProps) {
  const [data, setData] = useState<CleanerScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [actionModal, setActionModal] = useState<ResultModalState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cleaner");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CleanerScanResult = await res.json();
      setData(json);
      // 默认勾选所有 safe 级别的项目
      setSelectedIds(new Set(json.targets.filter((t) => t.level === "safe").map((t) => t.id)));
    } catch (e) {
      setToast({ msg: `扫描缓存失败: ${e}`, type: "err" });
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
      if (e.key === "Escape" && !actionModal) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionModal, onClose]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.targets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.targets.map((t) => t.id)));
    }
  };

  // 轮询异步任务
  const pollTask = async (taskId: string, title: string, actionId: string) => {
    try {
      while (true) {
        const tr = await fetch(`/api/tasks?taskId=${taskId}`);
        const t = await tr.json();
        if (t.status === "done" || t.status === "failed") {
          setActionModal({
            title,
            loading: false,
            result: {
              ok: t.status === "done",
              actionId,
              command: "",
              output: t.output,
              error: t.error,
              durationMs: t.durationMs,
            },
          });
          await load();
          onRefreshParent?.();
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      setActionModal({
        title,
        loading: false,
        result: {
          ok: false,
          actionId,
          command: "",
          output: "",
          error: String(e),
          durationMs: 0,
        },
      });
    }
  };

  // 执行单项清理
  const handleCleanSingle = async (target: CleanerTarget) => {
    setActionModal({
      title: `清理 · ${target.name}`,
      loading: true,
      result: null,
    });

    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "cleaner.clean",
          params: { target: target.id },
        }),
      });
      const j = await res.json();
      if (j.taskId) {
        setActionModal((prev) => (prev ? { ...prev, taskId: j.taskId } : null));
        await pollTask(j.taskId, `清理 · ${target.name}`, "cleaner.clean");
      } else {
        setActionModal({
          title: `清理 · ${target.name}`,
          loading: false,
          result: j,
        });
        if (j.ok) {
          await load();
          onRefreshParent?.();
        }
      }
    } catch (e) {
      setActionModal({
        title: `清理 · ${target.name}`,
        loading: false,
        result: {
          ok: false,
          actionId: "cleaner.clean",
          command: target.cleanCommand,
          output: "",
          error: String(e),
          durationMs: 0,
        },
      });
    }
  };

  // 执行一键清理所有选中项
  const handleCleanSelected = async () => {
    if (selectedIds.size === 0) return;
    const targetArr = Array.from(selectedIds);
    const title = `一键清理选中缓存 (${targetArr.length} 项)`;

    setActionModal({
      title,
      loading: true,
      result: null,
    });

    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "cleaner.clean-all",
          params: { targets: targetArr.join(",") },
        }),
      });
      const j = await res.json();
      if (j.taskId) {
        setActionModal((prev) => (prev ? { ...prev, taskId: j.taskId } : null));
        await pollTask(j.taskId, title, "cleaner.clean-all");
      } else {
        setActionModal({
          title,
          loading: false,
          result: j,
        });
        if (j.ok) {
          await load();
          onRefreshParent?.();
        }
      }
    } catch (e) {
      setActionModal({
        title,
        loading: false,
        result: {
          ok: false,
          actionId: "cleaner.clean-all",
          command: `clean-all [${targetArr.join(", ")}]`,
          output: "",
          error: String(e),
          durationMs: 0,
        },
      });
    }
  };

  // 计算选中项大小
  const selectedSizeHuman = useMemo(() => {
    if (!data) return "0 B";
    const bytes = data.targets
      .filter((t) => selectedIds.has(t.id))
      .reduce((sum, t) => sum + t.sizeBytes, 0);
    if (bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
  }, [data, selectedIds]);

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
                <span>🧹</span> 开发磁盘清理助手
              </h2>
              {data && (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  可释放: {data.totalHumanSize}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              集中扫描并安全清理各类包管理器临时下载、构建缓存与孤立包
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              disabled={loading}
              title="重新扫描磁盘缓存"
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white disabled:opacity-50"
            >
              {loading ? "扫描中…" : "↻ 重新扫描"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 概览与一键清理控制条 */}
        {data && data.targets.length > 0 && (
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-3 bg-zinc-900/40">
            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === data.targets.length}
                  onChange={toggleSelectAll}
                  className="accent-emerald-500"
                />
                全选
              </label>
              <span className="text-xs text-zinc-500">
                已选 {selectedIds.size} / {data.targets.length} 项 ({selectedSizeHuman})
              </span>
            </div>

            <button
              onClick={handleCleanSelected}
              disabled={selectedIds.size === 0 || loading}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              一键清理已选 ({selectedSizeHuman})
            </button>
          </div>
        )}

        {/* 缓存项列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
              <p className="text-xs">正在计算各项开发缓存体积…</p>
            </div>
          )}

          {!loading && data && data.targets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400 space-y-2">
              <span className="text-3xl">✨</span>
              <p className="font-medium text-sm text-zinc-200">系统非常干净！</p>
              <p className="text-xs text-zinc-500">未检测到占用磁盘的开发缓存或中间文件</p>
            </div>
          )}

          {data?.targets.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`group flex flex-col rounded-xl border p-4 transition-all cursor-pointer select-none ${
                  isSelected
                    ? "border-emerald-500/40 bg-zinc-900/80 shadow-xs"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 accent-emerald-500"
                    />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-100">
                          {item.name}
                        </span>
                        {item.level === "safe" ? (
                          <span className="rounded bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 text-[10px] text-emerald-400">
                            安全清理
                          </span>
                        ) : (
                          <span className="rounded bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.2 text-[10px] text-amber-400">
                            编译缓存
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-2 pt-0.5 text-xs text-zinc-500 font-mono">
                        <span>路径:</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(item.path);
                          }}
                          title="点击复制完整路径"
                          className="hover:text-zinc-300 underline decoration-zinc-700 cursor-pointer"
                        >
                          {item.displayPath}
                        </span>
                        {copied === item.path && (
                          <span className="text-emerald-400 text-[10px]">已复制</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧大小与单独清理按钮 */}
                  <div
                    className="flex flex-col items-end gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="rounded-lg bg-zinc-800/90 border border-zinc-700/60 px-3 py-1 font-mono text-sm font-bold text-emerald-400 tabular-nums">
                      {item.humanSize}
                    </span>

                    <button
                      onClick={() => handleCleanSingle(item)}
                      className="rounded border border-zinc-800 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                    >
                      单独清理
                    </button>
                  </div>
                </div>

                {/* 清理命令提示 */}
                <div className="mt-3 flex items-center justify-between rounded bg-zinc-950/60 border border-zinc-800/50 px-2.5 py-1 text-[11px] font-mono text-zinc-500">
                  <span>执行: {item.cleanCommand}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 异步结果与执行弹窗 */}
        {actionModal && (
          <ActionResultModal
            state={actionModal}
            onClose={() => setActionModal(null)}
          />
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
