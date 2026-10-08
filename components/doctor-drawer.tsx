"use client";

import { useCallback, useEffect, useState } from "react";
import type { BinaryShadow, DoctorScanResult, PathEntry } from "@/lib/doctor/scanner";

interface DoctorDrawerProps {
  onClose: () => void;
}

export function DoctorDrawer({ onClose }: DoctorDrawerProps) {
  const [data, setData] = useState<DoctorScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"shadows" | "paths" | "suggestions">("shadows");
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor${force ? "?force=1" : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DoctorScanResult = await res.json();
      setData(json);
      // 如果没有遮蔽项但有建议，默认切到建议
      if (json.shadowedBinaries.length === 0 && json.suggestions.length > 0) {
        setActiveTab("suggestions");
      }
      if (force) {
        setToast({ msg: "环境体检已重新完成！", type: "ok" });
        setTimeout(() => setToast(null), 2000);
      }
    } catch (e) {
      setToast({ msg: `环境体检失败: ${e}`, type: "err" });
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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = useCallback((text: string, label = "已复制") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setToast({ msg: `${label}: ${text}`, type: "ok" });
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
          {score} 分 · 极佳
        </span>
      );
    }
    if (score >= 75) {
      return (
        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/20">
          {score} 分 · 良好
        </span>
      );
    }
    return (
      <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/20">
        {score} 分 · 需关注
      </span>
    );
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
                <span>🩺</span> 开发环境体检与冲突诊断
              </h2>
              {data && getScoreBadge(data.healthScore)}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              深度诊断 PATH 查找顺序、多版本优先级遮蔽与死路径
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={loading}
              title="重新体检"
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white disabled:opacity-50"
            >
              {loading ? "体检中…" : "↻ 重新体检"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab 导航 */}
        {data && (
          <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-2.5 bg-zinc-900/40 text-xs">
            <button
              onClick={() => setActiveTab("shadows")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "shadows"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              多版本遮蔽 ({data.shadowedCount})
            </button>
            <button
              onClick={() => setActiveTab("paths")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "paths"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              PATH 目录 ({data.totalPathEntries})
              {(data.duplicateCount > 0 || data.deadCount > 0) && (
                <span className="ml-1.5 rounded bg-amber-500/20 text-amber-400 px-1 py-0.2 text-[10px]">
                  {data.duplicateCount + data.deadCount} 异常
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("suggestions")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                activeTab === "suggestions"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              诊断建议 ({data.suggestions.length})
            </button>
          </div>
        )}

        {/* 内容主体 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-500" />
              <p className="text-xs">正在深度分析系统 PATH 与多版本优先级…</p>
            </div>
          )}

          {/* Tab 1: 多版本遮蔽 */}
          {!loading && activeTab === "shadows" && data && (
            <div className="space-y-3">
              {data.shadowedBinaries.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-500">
                  🎉 未发现多版本冲突或遮蔽现象，所有常用工具均单一生效！
                </div>
              ) : (
                data.shadowedBinaries.map((sh: BinaryShadow) => (
                  <div
                    key={sh.name}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">
                          {sh.label} ({sh.name})
                        </span>
                        <span className="rounded bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          存在 {sh.shadowed.length + 1} 个不同来源
                        </span>
                      </div>
                    </div>

                    {/* 当前激活版本 */}
                    <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/50 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold text-xs">🟢 正在生效 (Active)</span>
                          <span className="rounded bg-emerald-900/50 text-emerald-300 px-1.5 py-0.2 text-[10px]">
                            {sh.active.source}
                          </span>
                        </div>
                        {sh.active.version && (
                          <span className="font-mono text-xs font-semibold text-emerald-300">
                            v{sh.active.version}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                        <span className="break-all">{sh.active.path}</span>
                        <button
                          onClick={() => handleCopy(sh.active.path, "已复制路径")}
                          className="text-zinc-400 hover:text-zinc-200 ml-2"
                        >
                          {copied === sh.active.path ? "✓ 已复制" : "复制"}
                        </button>
                      </div>
                    </div>

                    {/* 被遮蔽的版本 */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-zinc-400 font-medium">被 PATH 顺序遮蔽的低优先级版本：</p>
                      {sh.shadowed.map((inst, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-zinc-950/60 border border-zinc-800/60 p-2.5 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400 font-medium">⚪️ {inst.source}</span>
                              {inst.version && (
                                <span className="font-mono text-[11px] text-zinc-400">
                                  v{inst.version}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-zinc-400 break-all">
                              {inst.path}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopy(inst.path, "已复制路径")}
                            className="text-zinc-400 hover:text-zinc-200 text-xs ml-2 shrink-0"
                          >
                            {copied === inst.path ? "✓ 已复制" : "复制"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: PATH 路径列表 */}
          {!loading && activeTab === "paths" && data && (
            <div className="space-y-2">
              <div className="text-xs text-zinc-400 pb-1">
                PATH 按查找优先级从前往后排列（前面的目录优先命中）：
              </div>
              {data.paths.map((p: PathEntry) => (
                <div
                  key={p.index}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-xs transition-colors ${
                    !p.exists
                      ? "border-red-900/50 bg-red-950/20 text-red-200"
                      : p.isDuplicate
                      ? "border-amber-900/50 bg-amber-950/20 text-amber-200"
                      : "border-zinc-800/80 bg-zinc-900/40 text-zinc-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-zinc-400 w-5 shrink-0 pt-0.5">
                      #{p.index}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-medium break-all select-all">
                          {p.displayPath}
                        </span>
                        <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 text-[10px] text-zinc-300">
                          {p.sourceTag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {!p.exists ? (
                          <span className="text-red-400 font-semibold">❌ 目录不存在 (失效)</span>
                        ) : p.isDuplicate ? (
                          <span className="text-amber-400 font-semibold">⚠️ 重复出现的路径</span>
                        ) : (
                          <span className="text-emerald-400">✓ 正常目录</span>
                        )}
                        {p.exists && (
                          <span className="text-zinc-400">
                            {p.writable ? "(可写)" : "(只读)"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(p.rawPath, "已复制 PATH 路径")}
                    className="text-zinc-400 hover:text-zinc-200 shrink-0 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 text-[11px]"
                  >
                    {copied === p.rawPath ? "✓ 已复制" : "复制"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: 诊断建议 */}
          {!loading && activeTab === "suggestions" && data && (
            <div className="space-y-3">
              {data.suggestions.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-500">
                  ✨ 完美！当前未发现任何需要优化的环境配置。
                </div>
              ) : (
                data.suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{s.level === "warning" ? "⚠️" : "💡"}</span>
                      <h4 className="font-semibold text-sm text-zinc-200">{s.title}</h4>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{s.detail}</p>
                    <div className="mt-2 rounded bg-zinc-950/80 border border-zinc-800/60 p-2.5 text-xs text-emerald-300 font-mono">
                      <span className="text-zinc-400 font-sans block mb-1">🛠 优化建议：</span>
                      {s.fixTip}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
