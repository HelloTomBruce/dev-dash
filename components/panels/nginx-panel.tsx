"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";

interface NginxLocation {
  path: string;
  target: string;
  type: "proxy" | "root" | "alias" | "return" | "other";
}

interface NginxServerBlock {
  file: string;
  relPath: string;
  listen: string[];
  serverNames: string[];
  root?: string;
  locations: NginxLocation[];
  ssl: boolean;
}

interface ProcessInfo {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  command: string;
}

interface ConfigFileInfo {
  path: string;
  name: string;
  relPath: string;
  size: number;
  updatedAt: string;
}

interface NginxDetail {
  status: "running" | "stopped";
  version: string;
  prefix: string;
  confPath: string;
  confDir: string;
  serversDir: string;
  logDir: string;
  accessLogPath: string;
  errorLogPath: string;
  testResult: {
    ok: boolean;
    output: string;
  };
  processCount: number;
  processes: ProcessInfo[];
  servers: NginxServerBlock[];
  configFiles: ConfigFileInfo[];
  accessLogs: string[];
  errorLogs: string[];
  buildInfo: {
    raw: string;
    configureArgs: string[];
  };
}

export function NginxDetailPanel() {
  const [detail, setDetail] = useState<NginxDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sites" | "editor" | "logs" | "info">("sites");

  // Config editor state
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [fileLoading, setFileLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Logs state
  const [logType, setLogType] = useState<"access" | "error">("access");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/nginx");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setDetail(j);
      if (!selectedFile && j.confPath) {
        setSelectedFile(j.confPath);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [selectedFile]);

  const { modal, busy, runAction, closeModal } = useActionRunner(() => load());

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Load file content when selectedFile changes
  useEffect(() => {
    if (!selectedFile) return;
    let cancel = false;
    const timer = setTimeout(() => {
      setFileLoading(true);
      setSaveStatus(null);
    }, 0);

    fetch(`/api/tools/nginx?file=${encodeURIComponent(selectedFile)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancel) {
          if (data.content !== undefined) {
            setFileContent(data.content);
            setOriginalContent(data.content);
          }
          setFileLoading(false);
        }
      })
      .catch((err) => {
        if (!cancel) {
          setFileLoading(false);
          setSaveStatus({ ok: false, msg: `加载文件失败: ${String(err)}` });
        }
      });
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [selectedFile]);

  const running = detail?.status === "running";

  const allListenPorts = Array.from(
    new Set(
      (detail?.servers ?? []).flatMap((s) =>
        s.listen.map((l) => l.replace(/\s+ssl.*/, "").replace(/.*:/, "").trim())
      )
    )
  ).filter(Boolean);

  const handleSaveConfig = async (andReload = false) => {
    if (!selectedFile) return;
    setSaveStatus(null);
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "nginx.save-conf",
          params: { file: selectedFile, content: fileContent },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSaveStatus({ ok: false, msg: data.error || data.output || "保存失败" });
        return;
      }
      setOriginalContent(fileContent);
      setSaveStatus({ ok: true, msg: "配置保存成功并通过语法校验！" });

      if (andReload) {
        await runAction({
          actionId: "nginx.reload",
          label: "重新加载配置",
        });
      }
      load();
    } catch (e) {
      setSaveStatus({ ok: false, msg: `请求异常: ${String(e)}` });
    }
  };

  const isDirty = fileContent !== originalContent;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <BackLink />

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <span>Nginx</span>
            {detail?.version && (
              <span className="font-mono text-base font-medium text-emerald-400">
                {detail.version}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            高性能 HTTP 和反向代理服务器 · 本地环境管理器
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
              title={detail.testResult?.output ?? ""}
            >
              <span className={`size-2 rounded-full ${running ? "bg-emerald-400" : "bg-red-400"}`} />
              {running ? "运行中" : "已停止"}
            </span>
          )}

          {detail && (
            running ? (
              <>
                <PanelButton
                  label="重载配置"
                  disabled={busy}
                  onClick={() =>
                    runAction({
                      actionId: "nginx.reload",
                      label: "重新加载配置 (nginx -s reload)",
                    })
                  }
                />
                <PanelButton
                  label="重启"
                  disabled={busy}
                  onClick={() =>
                    runAction({
                      actionId: "brew.services.restart",
                      label: "重启服务",
                      params: { formula: "nginx" },
                    })
                  }
                />
                <PanelButton
                  label="停止"
                  danger
                  disabled={busy}
                  onClick={() =>
                    runAction({
                      actionId: "brew.services.stop",
                      label: "停止服务",
                      params: { formula: "nginx" },
                    })
                  }
                />
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  runAction({
                    actionId: "brew.services.start",
                    label: "启动服务",
                    params: { formula: "nginx" },
                  })
                }
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                ▶ 启动
              </button>
            )
          )}

          <PanelButton
            label="测试配置"
            disabled={busy}
            onClick={() =>
              runAction({
                actionId: "nginx.test",
                label: "测试配置语法 (nginx -t)",
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
          value={running ? `${detail?.processCount ?? 0} 个进程活跃` : "服务已停止"}
          accent={running}
          warn={!running}
        />
        <InfoCard
          label="监听端口"
          value={allListenPorts.length ? allListenPorts.join(", ") : "未检测到"}
          mono
        />
        <InfoCard
          label="Server 站点数"
          value={detail ? `${detail.servers.length} 个站点配置` : "—"}
        />
        <InfoCard
          label="主配置文件"
          value={detail?.confPath ? "nginx.conf" : "—"}
          mono
        />
      </section>

      {/* Test Result Banner */}
      {detail?.testResult && (
        <section
          className={`mt-4 rounded-xl border p-3.5 text-xs font-mono transition ${
            detail.testResult.ok
              ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-300/90"
              : "border-red-500/30 bg-red-950/30 text-red-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {detail.testResult.ok ? "✓ Nginx 配置语法测试正常 (nginx -t)" : "✕ Nginx 配置语法错误"}
            </span>
            <span className="text-[10px] text-zinc-500">语法校验状态</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-400">
            {detail.testResult.output}
          </p>
        </section>
      )}

      {/* Navigation Tabs */}
      <div className="mt-6 flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("sites")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "sites"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          🌐 站点与路由 ({detail?.servers.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("editor")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "editor"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          📝 配置文件 ({detail?.configFiles.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "logs"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          📋 运行日志
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "info"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          ⚙️ 进程与编译参数
        </button>
      </div>

      {/* Tab 1: Sites & Server Blocks */}
      {activeTab === "sites" && (
        <section className="mt-6 space-y-4">
          {(!detail?.servers || detail.servers.length === 0) ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500">
              未在配置文件中解析到 server 块。
            </div>
          ) : (
            detail.servers.map((server, idx) => {
              const primaryPort = server.listen[0]?.replace(/\s+ssl.*/, "").replace(/.*:/, "").trim() || "80";
              const openUrl = `http://localhost:${primaryPort}`;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-sm transition hover:border-zinc-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-200">
                        {server.serverNames.join(", ")}
                      </span>
                      {server.listen.map((l, i) => (
                        <span
                          key={i}
                          className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald-400 border border-emerald-500/20"
                        >
                          Port: {l}
                        </span>
                      ))}
                      {server.ssl && (
                        <span className="rounded bg-purple-500/10 px-2 py-0.5 font-mono text-xs font-medium text-purple-400 border border-purple-500/20">
                          SSL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
                      >
                        ↗ 打开 {openUrl}
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                    <div>
                      <span className="text-zinc-500">定义文件: </span>
                      <span className="font-mono text-zinc-300">{server.relPath}</span>
                    </div>
                    {server.root && (
                      <div>
                        <span className="text-zinc-500">默认 Root: </span>
                        <span className="font-mono text-zinc-300">{server.root}</span>
                      </div>
                    )}
                  </div>

                  {server.locations.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-zinc-400 mb-2">路由与代理规则 (Locations):</p>
                      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-800/80 text-[11px] text-zinc-500">
                              <th className="px-3 py-2 font-medium">路径 (Path)</th>
                              <th className="px-3 py-2 font-medium">类型</th>
                              <th className="px-3 py-2 font-medium">目标 / 动作 (Target)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                            {server.locations.map((loc, lIdx) => (
                              <tr key={lIdx} className="hover:bg-zinc-900/40">
                                <td className="px-3 py-2 font-semibold text-emerald-300">
                                  {loc.path}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                                      loc.type === "proxy"
                                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        : loc.type === "alias"
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        : loc.type === "root"
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "bg-zinc-800 text-zinc-400"
                                    }`}
                                  >
                                    {loc.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-zinc-300 truncate max-w-md" title={loc.target}>
                                  {loc.target}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Tab 2: Config Editor */}
      {activeTab === "editor" && (
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">选择文件:</label>
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                {(detail?.configFiles ?? []).map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.relPath} ({Math.round(f.size / 1024 * 10) / 10} KB)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  runAction({
                    actionId: "tool.open-dir",
                    label: "打开配置目录",
                    params: { dir: detail?.confDir ?? "/opt/homebrew/etc/nginx" },
                  })
                }
                className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
              >
                📂 打开所在目录
              </button>
              <button
                disabled={fileLoading || !isDirty}
                onClick={() => handleSaveConfig(false)}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                💾 保存配置
              </button>
              <button
                disabled={fileLoading || !isDirty}
                onClick={() => handleSaveConfig(true)}
                className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
              >
                ⚡ 保存并重载
              </button>
            </div>
          </div>

          {saveStatus && (
            <div
              className={`mt-3 rounded-lg border p-2.5 text-xs font-mono ${
                saveStatus.ok
                  ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
                  : "border-red-500/30 bg-red-950/30 text-red-300"
              }`}
            >
              {saveStatus.msg}
            </div>
          )}

          <div className="mt-4 relative">
            {fileLoading ? (
              <div className="h-96 flex items-center justify-center text-xs text-zinc-500">
                加载中...
              </div>
            ) : (
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                spellCheck={false}
                className="h-[500px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500 focus:outline-none"
              />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              {isDirty ? (
                <span className="text-amber-400">● 存在未保存修改</span>
              ) : (
                "与磁盘文件一致"
              )}
            </span>
            <span>保存时将自动执行 nginx -t 语法校验并具备防炸机回滚机制</span>
          </div>
        </section>
      )}

      {/* Tab 3: Logs */}
      {activeTab === "logs" && (
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLogType("access")}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  logType === "access"
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Access Log ({detail?.accessLogs.length ?? 0} 行)
              </button>
              <button
                onClick={() => setLogType("error")}
                className={`rounded px-3 py-1 text-xs font-medium transition ${
                  logType === "error"
                    ? "bg-red-600/20 text-red-300 border border-red-500/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Error Log ({detail?.errorLogs.length ?? 0} 行)
              </button>
            </div>
            <button
              onClick={load}
              className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              🔄 刷新日志
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[11px] text-zinc-500 font-mono mb-2 truncate">
              文件路径: {logType === "access" ? detail?.accessLogPath : detail?.errorLogPath}
            </p>
            <div className="h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-tight text-zinc-300 space-y-1">
              {logType === "access" ? (
                detail?.accessLogs.length ? (
                  detail.accessLogs.map((l, i) => (
                    <div key={i} className="hover:bg-zinc-900/60 py-0.5 whitespace-pre-wrap">
                      {l}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 text-center py-8">暂无访问日志</div>
                )
              ) : (
                detail?.errorLogs.length ? (
                  detail.errorLogs.map((l, i) => (
                    <div
                      key={i}
                      className={`hover:bg-zinc-900/60 py-0.5 whitespace-pre-wrap ${
                        l.includes("[error]") || l.includes("[crit]")
                          ? "text-red-400"
                          : l.includes("[warn]")
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {l}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 text-center py-8">暂无错误日志</div>
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Processes & Build Info */}
      {activeTab === "info" && (
        <section className="mt-6 space-y-6">
          {/* Processes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold text-zinc-200">当前活跃进程 (Processes)</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/80 text-[11px] text-zinc-500">
                    <th className="px-3 py-2 font-medium">PID</th>
                    <th className="px-3 py-2 font-medium">用户</th>
                    <th className="px-3 py-2 font-medium">CPU</th>
                    <th className="px-3 py-2 font-medium">MEM</th>
                    <th className="px-3 py-2 font-medium">指令</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 font-mono text-[11px]">
                  {(!detail?.processes || detail.processes.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-zinc-600">
                        无正在运行的 Nginx 进程
                      </td>
                    </tr>
                  ) : (
                    detail.processes.map((proc, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-emerald-400">{proc.pid}</td>
                        <td className="px-3 py-2 text-zinc-400">{proc.user}</td>
                        <td className="px-3 py-2 text-zinc-400">{proc.cpu}</td>
                        <td className="px-3 py-2 text-zinc-400">{proc.mem}</td>
                        <td className="px-3 py-2 text-zinc-300 truncate max-w-lg" title={proc.command}>
                          {proc.command}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Build Info */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold text-zinc-200">编译模块与配置参数</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(detail?.buildInfo.configureArgs ?? []).map((arg, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-[11px] text-zinc-300"
                >
                  {arg}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
