"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import {
  PlayIcon,
  CheckIcon,
  XIcon,
  GlobeIcon,
  NotePencilIcon,
  ClipboardTextIcon,
  GearIcon,
} from "@phosphor-icons/react";
import { BackLink, InfoCard, PanelButton, useActionRunner } from "./shared";
import type { NginxDetail } from "@/lib/nginx/types";
import { SitesTab } from "./nginx/sites-tab";
import { EditorTab } from "./nginx/editor-tab";
import { LogsTab } from "./nginx/logs-tab";
import { InfoTab } from "./nginx/info-tab";

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
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                <PlayIcon size={12} weight="fill" /> 启动
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
          value={detail ? `${detail.servers.length} 个站点配置` : "-"}
        />
        <InfoCard
          label="主配置文件"
          value={detail?.confPath ? "nginx.conf" : "-"}
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
            <span className="flex items-center gap-1.5 font-semibold">
              {detail.testResult.ok ? (
                <>
                  <CheckIcon size={13} weight="bold" /> Nginx 配置语法测试正常 (nginx -t)
                </>
              ) : (
                <>
                  <XIcon size={13} weight="bold" /> Nginx 配置语法错误
                </>
              )}
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
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "sites"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <GlobeIcon size={14} /> 站点与路由 ({detail?.servers.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("editor")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "editor"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <NotePencilIcon size={14} /> 配置文件 ({detail?.configFiles.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "logs"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ClipboardTextIcon size={14} /> 运行日志
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "info"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <GearIcon size={14} /> 进程与编译参数
        </button>
      </div>

      {/* Tab 1: Sites & Server Blocks */}
      {activeTab === "sites" && <SitesTab servers={detail?.servers ?? []} />}

      {/* Tab 2: Config Editor */}
      {activeTab === "editor" && (
        <EditorTab
          configFiles={detail?.configFiles ?? []}
          selectedFile={selectedFile}
          onChangeFile={setSelectedFile}
          fileContent={fileContent}
          onChangeFileContent={setFileContent}
          fileLoading={fileLoading}
          saveStatus={saveStatus}
          isDirty={isDirty}
          onSave={handleSaveConfig}
          onOpenDir={() =>
            runAction({
              actionId: "tool.open-dir",
              label: "打开配置目录",
              params: { dir: detail?.confDir ?? "/opt/homebrew/etc/nginx" },
            })
          }
        />
      )}

      {/* Tab 3: Logs */}
      {activeTab === "logs" && (
        <LogsTab
          logType={logType}
          onChangeLogType={setLogType}
          accessLogs={detail?.accessLogs ?? []}
          errorLogs={detail?.errorLogs ?? []}
          accessLogPath={detail?.accessLogPath ?? ""}
          errorLogPath={detail?.errorLogPath ?? ""}
          onRefresh={load}
        />
      )}

      {/* Tab 4: Processes & Build Info */}
      {activeTab === "info" && (
        <InfoTab
          processes={detail?.processes ?? []}
          configureArgs={detail?.buildInfo.configureArgs ?? []}
        />
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </main>
  );
}
