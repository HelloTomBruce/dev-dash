"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface VscodeProcess {
  pid: string;
  cpu: string;
  mem: string;
  name: string;
  indent: number;
  category: "main" | "gpu" | "window" | "extension-host" | "plugin" | "utility" | "other";
}

interface VscodeWorkspace {
  windowTitle: string;
  folderName: string;
  fileCount: number;
  fileTypes: Record<string, number>;
  confFiles: Record<string, number>;
}

interface VscodeExtension {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  description?: string;
  dirName: string;
}

interface VscodeDetail {
  status: "running" | "stopped";
  version: string;
  commit: string;
  architecture: string;
  codeBin: string;
  appPath: string;
  settingsPath: string;
  settingsExists: boolean;
  processCount: number;
  systemInfo: {
    version?: string;
    commit?: string;
    osVersion?: string;
    cpus?: string;
    memorySystem?: string;
    loadAvg?: string;
    vm?: string;
    architecture?: string;
  };
  processes: VscodeProcess[];
  workspaces: VscodeWorkspace[];
  extensions: VscodeExtension[];
  extensionsCount: number;
  statusRaw: string;
}

export function VscodeDetailPanel() {
  const [detail, setDetail] = useState<VscodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"processes" | "workspaces" | "extensions" | "settings" | "system">("processes");

  // Extension search & install
  const [extSearch, setExtSearch] = useState("");
  const [newExtId, setNewExtId] = useState("");

  // Settings editor
  const [settingsContent, setSettingsContent] = useState("");
  const [originalSettings, setOriginalSettings] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/vscode");
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

  // Load settings file
  useEffect(() => {
    if (activeTab !== "settings") return;
    let cancel = false;
    const timer = setTimeout(() => {
      setSettingsLoading(true);
      setSettingsStatus(null);
    }, 0);

    fetch("/api/tools/vscode?file=settings")
      .then((res) => res.json())
      .then((data) => {
        if (!cancel) {
          if (data.content !== undefined) {
            setSettingsContent(data.content);
            setOriginalSettings(data.content);
          }
          setSettingsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancel) {
          setSettingsLoading(false);
          setSettingsStatus({ ok: false, msg: `读取 settings.json 失败: ${String(err)}` });
        }
      });

    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [activeTab]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const handleSaveSettings = async () => {
    setSettingsStatus(null);
    try {
      JSON.parse(settingsContent);
    } catch (err) {
      setSettingsStatus({ ok: false, msg: `JSON 格式校验不通过: ${String(err)}` });
      return;
    }

    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "vscode.save-settings",
          params: { content: settingsContent },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSettingsStatus({ ok: false, msg: data.error || data.output || "保存失败" });
        return;
      }
      setOriginalSettings(settingsContent);
      setSettingsStatus({ ok: true, msg: "settings.json 已成功保存！" });
    } catch (e) {
      setSettingsStatus({ ok: false, msg: `请求异常: ${String(e)}` });
    }
  };

  const handleInstallExtension = async () => {
    if (!newExtId.trim()) return;
    await runAction({
      actionId: "vscode.install-extension",
      label: `安装插件 ${newExtId.trim()}`,
      params: { id: newExtId.trim() },
    });
    setNewExtId("");
    load();
  };

  const running = detail?.status === "running";

  const filteredExtensions = (detail?.extensions ?? []).filter((ext) => {
    const q = extSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      ext.id.toLowerCase().includes(q) ||
      ext.displayName.toLowerCase().includes(q) ||
      (ext.description ?? "").toLowerCase().includes(q) ||
      ext.publisher.toLowerCase().includes(q)
    );
  });

  const isSettingsDirty = settingsContent !== originalSettings;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <BackLink />

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <span>Visual Studio Code</span>
            {detail?.version && (
              <span className="font-mono text-base font-medium text-emerald-400">
                v{detail.version}
              </span>
            )}
            {detail?.architecture && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                {detail.architecture}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            代码编辑器 · 进程资源监控 · 扩展插件管理 · 配置中心
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {detail && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                running
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-red-500/30 bg-red-500/15 text-red-400"
              }`}
            >
              <span className={`size-2 rounded-full ${running ? "bg-emerald-400" : "bg-red-400"}`} />
              {running ? "运行中" : "已停止"}
            </span>
          )}

          {detail && (
            running ? (
              <>
                <PanelButton
                  label="重启应用"
                  disabled={busy}
                  onClick={() =>
                    runAction({
                      actionId: "vscode.restart",
                      label: "重启 VS Code",
                    })
                  }
                />
                <PanelButton
                  label="退出"
                  danger
                  disabled={busy}
                  onClick={() =>
                    runAction({
                      actionId: "vscode.quit",
                      label: "退出 VS Code",
                    })
                  }
                />
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  runAction({
                    actionId: "vscode.open",
                    label: "启动 VS Code",
                  })
                }
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ▶ 启动 VS Code
              </button>
            )
          )}

          <PanelButton
            label="诊断状态"
            disabled={busy}
            onClick={() =>
              runAction({
                actionId: "vscode.status",
                label: "VS Code 状态诊断 (code --status)",
              })
            }
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
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Info Cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard
          label="运行状态"
          value={running ? `${detail?.processCount ?? 0} 个进程活跃` : "已停止"}
          accent={running}
          warn={!running}
        />
        <InfoCard
          label="已安装扩展"
          value={detail ? `${detail.extensionsCount} 个插件` : "—"}
        />
        <InfoCard
          label="当前打开工作区"
          value={detail?.workspaces?.[0]?.folderName || (running ? "无打开文件夹" : "未运行")}
          mono
        />
        <InfoCard
          label="系统内存"
          value={detail?.systemInfo?.memorySystem || "—"}
          mono
        />
      </section>

      {/* Navigation Tabs */}
      <div className="mt-6 flex border-b border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("processes")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "processes"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          🖥️ 进程树与性能 ({detail?.processes?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("workspaces")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "workspaces"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          📂 工作区与代码统计 ({detail?.workspaces?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("extensions")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "extensions"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          🧩 扩展插件 ({detail?.extensionsCount ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "settings"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          ⚙️ settings.json
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "system"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          💻 硬件与诊断
        </button>
      </div>

      {/* Tab 1: Process Tree */}
      {activeTab === "processes" && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Electron 进程拓扑与资源占用</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  监控主进程、渲染窗口、GPU加速、插件宿主及独立语言服务 LSP 资源消耗
                </p>
              </div>
              <button
                onClick={load}
                className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
              >
                🔄 刷新进程
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/80 text-[11px] text-zinc-500">
                    <th className="px-3 py-2 font-medium">进程结构 / 角色</th>
                    <th className="px-3 py-2 font-medium">类型</th>
                    <th className="px-3 py-2 font-medium">PID</th>
                    <th className="px-3 py-2 font-medium">CPU%</th>
                    <th className="px-3 py-2 font-medium">物理内存 (RSS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                  {(!detail?.processes || detail.processes.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-zinc-600">
                        {running ? "正在获取进程拓扑..." : "VS Code 未在运行"}
                      </td>
                    </tr>
                  ) : (
                    detail.processes.map((proc, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-zinc-200 max-w-md truncate">
                          <span style={{ paddingLeft: `${proc.indent * 16}px` }} className="inline-flex items-center gap-1.5">
                            {proc.indent > 0 && <span className="text-zinc-600">└─</span>}
                            <span className={proc.category === "main" ? "font-bold text-emerald-300" : proc.category === "plugin" ? "text-blue-300" : "text-zinc-300"}>
                              {proc.name}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              proc.category === "main"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : proc.category === "gpu"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : proc.category === "window"
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                : proc.category === "extension-host"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : proc.category === "plugin"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {proc.category}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{proc.pid}</td>
                        <td className="px-3 py-2 text-emerald-400">{proc.cpu}</td>
                        <td className="px-3 py-2 text-zinc-300">{proc.mem}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Tab 2: Workspaces */}
      {activeTab === "workspaces" && (
        <section className="mt-6 space-y-4">
          {(!detail?.workspaces || detail.workspaces.length === 0) ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500">
              {running ? "当前没有检测到活跃的项目工作区或窗口。" : "VS Code 未运行，请先启动。"}
            </div>
          ) : (
            detail.workspaces.map((ws, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-200">
                      {ws.folderName || "工作区窗口"}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500 font-mono">
                      {ws.windowTitle}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                    {ws.fileCount} 个文件
                  </span>
                </div>

                {/* File types distribution */}
                {Object.keys(ws.fileTypes).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-zinc-400 mb-2">文件类型分布:</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ws.fileTypes).map(([ext, count]) => (
                        <span
                          key={ext}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-mono text-zinc-300"
                        >
                          <span className="font-semibold text-emerald-400">.{ext}</span>
                          <span className="text-zinc-500">({count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config files detected */}
                {Object.keys(ws.confFiles).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-zinc-400 mb-2">识别到的项目配置文件:</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ws.confFiles).map(([conf, count]) => (
                        <span
                          key={conf}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-950/20 px-2 py-0.5 text-xs font-mono text-blue-300"
                        >
                          <span>{conf}</span>
                          {count > 1 && <span className="text-blue-500">x{count}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {/* Tab 3: Extensions */}
      {activeTab === "extensions" && (
        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            {/* Search and Install bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="text"
                  placeholder="搜索已装扩展插件（名称 / ID / 作者 / 描述）..."
                  value={extSearch}
                  onChange={(e) => setExtSearch(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="安装新插件 (如 dbaeumer.vscode-eslint)"
                  value={newExtId}
                  onChange={(e) => setNewExtId(e.target.value)}
                  className="w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  disabled={busy || !newExtId.trim()}
                  onClick={handleInstallExtension}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  安装插件
                </button>
              </div>
            </div>

            {/* Extension Grid */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredExtensions.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-zinc-500">
                  没有找到匹配的扩展插件。
                </div>
              ) : (
                filteredExtensions.map((ext, idx) => (
                  <div
                    key={ext.dirName || `${ext.id}-${idx}`}
                    className="flex flex-col justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 p-3.5 transition hover:border-zinc-700"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-xs text-zinc-200 truncate" title={ext.displayName}>
                          {ext.displayName}
                        </h4>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                          v{ext.version}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-500 truncate" title={ext.id}>
                        {ext.id}
                      </p>
                      {ext.description && (
                        <p className="mt-1.5 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                          {ext.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-zinc-850 pt-2.5 text-[11px]">
                      <button
                        onClick={() => copy(ext.id)}
                        className="text-zinc-400 hover:text-emerald-400"
                      >
                        {copied === ext.id ? "✓ 已复制 ID" : "复制 ID"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          runAction({
                            actionId: "vscode.uninstall-extension",
                            label: "卸载插件",
                            params: { id: ext.id },
                            targetText: ext.displayName,
                          })
                        }
                        className="text-red-400 hover:text-red-300 disabled:opacity-40"
                      >
                        卸载
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Settings Editor */}
      {activeTab === "settings" && (
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">用户全局配置 (settings.json)</h2>
              <p className="mt-0.5 text-xs text-zinc-500 font-mono">
                {detail?.settingsPath}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  runAction({
                    actionId: "tool.open-dir",
                    label: "打开配置目录",
                    params: { dir: "/Users/zhangbei/Library/Application Support/Code/User" },
                  })
                }
                className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
              >
                📂 打开目录
              </button>
              <button
                disabled={settingsLoading || !isSettingsDirty}
                onClick={handleSaveSettings}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                💾 保存设置
              </button>
            </div>
          </div>

          {settingsStatus && (
            <div
              className={`mt-3 rounded-lg border p-2.5 text-xs font-mono ${
                settingsStatus.ok
                  ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
                  : "border-red-500/30 bg-red-950/30 text-red-300"
              }`}
            >
              {settingsStatus.msg}
            </div>
          )}

          <div className="mt-4 relative">
            {settingsLoading ? (
              <div className="h-96 flex items-center justify-center text-xs text-zinc-500">
                加载中...
              </div>
            ) : (
              <textarea
                value={settingsContent}
                onChange={(e) => setSettingsContent(e.target.value)}
                spellCheck={false}
                className="h-[500px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500 focus:outline-none"
              />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {isSettingsDirty ? (
                <span className="text-amber-400">● 存在未保存修改</span>
              ) : (
                "与磁盘配置一致"
              )}
            </span>
            <span>保存时将自动进行 JSON 格式语法校验</span>
          </div>
        </section>
      )}

      {/* Tab 5: System & Diagnostic Info */}
      {activeTab === "system" && (
        <section className="mt-6 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold text-zinc-200">系统环境与硬件规格</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-zinc-500">处理器 (CPUs):</span>
                <p className="mt-1 font-mono text-zinc-200">{detail?.systemInfo?.cpus || "—"}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-zinc-500">系统内存 (Memory):</span>
                <p className="mt-1 font-mono text-zinc-200">{detail?.systemInfo?.memorySystem || "—"}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-zinc-500">系统负载 (Load Average):</span>
                <p className="mt-1 font-mono text-zinc-200">{detail?.systemInfo?.loadAvg || "—"}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-zinc-500">系统版本 (OS):</span>
                <p className="mt-1 font-mono text-zinc-200">{detail?.systemInfo?.osVersion || "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold text-zinc-200">code --status 原始诊断报告</h2>
            <pre className="mt-3 max-h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
              {detail?.statusRaw || "暂无诊断输出"}
            </pre>
          </div>
        </section>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
