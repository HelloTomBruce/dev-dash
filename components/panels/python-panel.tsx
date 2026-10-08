"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink, InfoCard, useActionRunner } from "./shared";
import { ActionResultModal } from "@/components/action-result-modal";
import type { PythonOverviewResult, PythonRuntimeInfo, VirtualEnvInfo } from "@/lib/python/types";

const POPULAR_MIRRORS = [
  { name: "清华大学 (TUNA)", url: "https://pypi.tuna.tsinghua.edu.cn/simple" },
  { name: "阿里云 (Aliyun)", url: "https://mirrors.aliyun.com/pypi/simple/" },
  { name: "腾讯云 (Tencent)", url: "https://mirrors.cloud.tencent.com/pypi/simple/" },
  { name: "华为云 (Huawei)", url: "https://repo.huaweicloud.com/repository/pypi/simple/" },
  { name: "官方默认 (PyPI)", url: "" },
];

export function PythonPanel() {
  const [data, setData] = useState<PythonOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"venvs" | "runtimes" | "pip">("venvs");
  const [search, setSearch] = useState("");
  const [customMirror, setCustomMirror] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tools/python");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PythonOverviewResult = await res.json();
      setData(json);
      setCustomMirror(json.pipConfig.indexUrl || "");
    } catch (e) {
      setToast({ msg: `加载 Python 信息失败: ${e}`, type: "err" });
    } finally {
      setLoading(false);
    }
  }, []);

  const { modal, busy, runAction, closeModal } = useActionRunner(load);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const handleCopy = useCallback((text: string, label = "已复制") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setToast({ msg: `${label}: ${text}`, type: "ok" });
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const handleSwitchMirror = (url: string, name: string) => {
    runAction({
      actionId: "python.set-pip-index",
      label: `切换 pip 镜像源至 ${name}`,
      params: { url },
    });
  };

  const filteredVenvs = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.virtualEnvs;
    const q = search.toLowerCase();
    return data.virtualEnvs.filter(
      (v) =>
        v.projectName.toLowerCase().includes(q) ||
        v.displayPath.toLowerCase().includes(q) ||
        (v.pythonVersion && v.pythonVersion.includes(q))
    );
  }, [data, search]);

  const defaultRuntime = data?.runtimes.find((r) => r.isDefault);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <BackLink />
        <button
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
        >
          {loading ? "刷新中…" : "↻ 刷新"}
        </button>
      </div>

      {/* 顶栏 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
            <span>🐍</span> Python 多环境与包管理
            {defaultRuntime?.version && (
              <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                v{defaultRuntime.version}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 font-mono">
            当前激活解释器: {defaultRuntime?.path || "未检测到"} ({defaultRuntime?.source || "未知"})
          </p>
        </div>
      </div>

      {/* 概览指标 */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard
            label="Python 解释器"
            value={`${data.runtimes.length} 个版本`}
          />
          <InfoCard
            label="项目虚拟环境"
            value={`${data.virtualEnvs.length} 个环境`}
          />
          <InfoCard
            label="虚拟环境总占用"
            value={data.totalVenvHumanSize}
            warn={data.totalVenvSizeBytes > 1024 * 1024 * 1024}
          />
          <InfoCard
            label="pip 当前镜像源"
            value={data.pipConfig.indexUrl ? "自定义加速源" : "官方默认 PyPI"}
            accent={!!data.pipConfig.indexUrl}
          />
        </div>
      )}

      {/* Tab 导航 */}
      <div className="mt-8 flex items-center gap-2 border-b border-zinc-800 pb-3 text-sm">
        <button
          onClick={() => setActiveTab("venvs")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
            activeTab === "venvs"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
        >
          项目虚拟环境雷达 ({data?.virtualEnvs.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("runtimes")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
            activeTab === "runtimes"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
        >
          解释器多版本清单 ({data?.runtimes.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("pip")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
            activeTab === "pip"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
        >
          pip 镜像源与配置
        </button>
      </div>

      {/* Tab 1: 项目虚拟环境雷达 */}
      {activeTab === "venvs" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索项目名、路径或 Python 版本..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
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

            <span className="text-xs text-zinc-500">
              共 {data?.virtualEnvs.length ?? 0} 个虚拟环境，累计占用 {data?.totalVenvHumanSize}
            </span>
          </div>

          <div className="space-y-3">
            {filteredVenvs.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                {search ? "未找到匹配的虚拟环境" : "未在常用代码目录下检测到虚拟环境 (.venv / venv)"}
              </div>
            ) : (
              filteredVenvs.map((venv: VirtualEnvInfo) => (
                <div
                  key={venv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-zinc-100">
                        {venv.projectName}
                      </span>
                      {venv.uvManaged ? (
                        <span className="rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.2 text-[10px]">
                          uv 管理
                        </span>
                      ) : (
                        <span className="rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 text-[10px]">
                          原生 venv
                        </span>
                      )}
                      {venv.pythonVersion && (
                        <span className="font-mono text-xs text-emerald-400">
                          Python {venv.pythonVersion}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">
                        ({venv.packageCount} 个已装包)
                      </span>
                    </div>

                    <p
                      onClick={() => handleCopy(venv.venvPath, "已复制路径")}
                      className="text-xs font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer truncate max-w-lg"
                      title={venv.venvPath}
                    >
                      {venv.displayPath}
                    </p>
                  </div>

                  {/* 右侧大小与删除操作 */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="rounded-lg bg-zinc-800/90 border border-zinc-700/60 px-3 py-1 font-mono text-sm font-bold text-emerald-400">
                      {venv.humanSize}
                    </span>

                    <button
                      onClick={() => handleCopy(venv.venvPath, "已复制路径")}
                      className="rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-700"
                    >
                      {copied === venv.venvPath ? "✓" : "复制路径"}
                    </button>

                    <button
                      onClick={() =>
                        runAction({
                          actionId: "python.del-venv",
                          label: `删除项目虚拟环境`,
                          params: { path: venv.venvPath },
                          targetText: `${venv.projectName} (${venv.humanSize})`,
                        })
                      }
                      disabled={busy}
                      className="rounded border border-red-900/50 bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/50 hover:text-red-200 hover:border-red-700 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: 解释器多版本清单 */}
      {activeTab === "runtimes" && (
        <div className="mt-4 space-y-3">
          {data?.runtimes.map((rt: PythonRuntimeInfo) => (
            <div
              key={rt.path}
              className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
                rt.isDefault
                  ? "border-emerald-500/40 bg-zinc-900/80 shadow-xs"
                  : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-100 font-mono">
                    {rt.version ? `Python ${rt.version}` : "Python"}
                  </span>
                  {rt.isDefault && (
                    <span className="rounded bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.2 text-[10px] font-bold">
                      🟢 默认生效
                    </span>
                  )}
                  <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 text-[10px] text-zinc-300 uppercase">
                    {rt.source}
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-400 break-all">{rt.path}</p>
              </div>

              <button
                onClick={() => handleCopy(rt.path, "已复制路径")}
                className="rounded border border-zinc-800 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700"
              >
                {copied === rt.path ? "✓ 已复制" : "复制路径"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: pip 镜像源与配置 */}
      {activeTab === "pip" && data && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-zinc-200">当前 pip 镜像源</h3>
              <p className="text-xs font-mono text-emerald-400 mt-1 break-all">
                {data.pipConfig.indexUrl || "https://pypi.org/simple (官方默认)"}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-zinc-300 block">
                一键切换国内高速镜像源
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {POPULAR_MIRRORS.map((m) => {
                  const isCurrent =
                    (m.url === "" && !data.pipConfig.indexUrl) ||
                    m.url === data.pipConfig.indexUrl;
                  return (
                    <button
                      key={m.name}
                      onClick={() => handleSwitchMirror(m.url, m.name)}
                      disabled={isCurrent || busy}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                        isCurrent
                          ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-200 cursor-default"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-600 text-zinc-300"
                      }`}
                    >
                      <span className="font-semibold text-xs flex items-center justify-between w-full">
                        {m.name}
                        {isCurrent && <span className="text-emerald-400">✓ 当前使用</span>}
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate w-full mt-1 font-mono">
                        {m.url || "官方源"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 自定义输入 */}
            <div className="pt-2 space-y-2 border-t border-zinc-800">
              <label className="text-xs font-medium text-zinc-300 block">
                自定义镜像源 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customMirror}
                  onChange={(e) => setCustomMirror(e.target.value)}
                  placeholder="https://pypi.tuna.tsinghua.edu.cn/simple"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() =>
                    runAction({
                      actionId: "python.set-pip-index",
                      label: "设置自定义镜像源",
                      params: { url: customMirror },
                    })
                  }
                  disabled={busy || !customMirror.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 结果弹窗 */}
      {modal && <ActionResultModal state={modal} onClose={closeModal} />}

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
    </main>
  );
}
