"use client";

import { useCallback, useEffect, useState } from "react";
import { BackLink, InfoCard, useActionRunner } from "./shared";
import { ActionResultModal } from "@/components/action-result-modal";
import { ArrowsClockwiseIcon, GitBranchIcon, KeyIcon } from "@phosphor-icons/react";
import type { GitOverviewResult } from "@/lib/git/types";
import { ReposTab } from "./git/repos-tab";
import { SshTab } from "./git/ssh-tab";
import { ConfigTab } from "./git/config-tab";

export function GitPanel() {
  const [data, setData] = useState<GitOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"repos" | "ssh" | "config">("repos");
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // 编辑配置状态
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tools/git");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GitOverviewResult = await res.json();
      setData(json);
      setEditUserName(json.config.userName || "");
      setEditUserEmail(json.config.userEmail || "");
    } catch (e) {
      setToast({ msg: `加载 Git 信息失败: ${e}`, type: "err" });
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
      setToast({ msg: `${label}: ${text.length > 30 ? text.slice(0, 30) + "..." : text}`, type: "ok" });
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      if (editUserName !== data?.config.userName) {
        await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "git.set-config",
            params: { key: "user.name", value: editUserName },
          }),
        });
      }
      if (editUserEmail !== data?.config.userEmail) {
        await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "git.set-config",
            params: { key: "user.email", value: editUserEmail },
          }),
        });
      }
      setToast({ msg: "Git 全局配置已更新", type: "ok" });
      await load();
    } catch (err) {
      setToast({ msg: `保存配置失败: ${err}`, type: "err" });
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <BackLink />
        <button
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
        >
          {loading ? "刷新中…" : <><ArrowsClockwiseIcon size={12} weight="bold" className="inline-block" /> 刷新</>}
        </button>
      </div>

      {/* 顶栏 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
            <GitBranchIcon size={22} className="text-emerald-400" /> Git 仓库与环境配置
            {data?.config.version && (
              <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                v{data.config.version}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 font-mono">
            {data?.config.binPath || "git"} · 全局提交者: {data?.config.userName || "未配置"} &lt;{data?.config.userEmail || "未配置"}&gt;
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              runAction({
                actionId: "git.test-ssh",
                label: "测试 GitHub SSH 连通性",
              })
            }
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            <KeyIcon size={13} /> 测试 GitHub SSH 连通
          </button>
        </div>
      </div>

      {/* 概览指标 */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="本地 Git 仓库" value={`${data.totalRepos} 个`} />
          <InfoCard
            label="有未提交修改"
            value={`${data.dirtyReposCount} 个`}
            warn={data.dirtyReposCount > 0}
          />
          <InfoCard
            label="待推送提交 (Ahead)"
            value={`${data.unpushedReposCount} 个`}
            accent={data.unpushedReposCount > 0}
          />
          <InfoCard
            label="SSH 密钥 / LFS"
            value={`${data.sshKeys.length} 个 Key / ${data.config.lfsVersion ? `LFS v${data.config.lfsVersion}` : "未装 LFS"}`}
          />
        </div>
      )}

      {/* Tab 导航 */}
      <div className="mt-8 flex items-center gap-2 border-b border-zinc-800 pb-3 text-sm">
        <button
          onClick={() => setActiveTab("repos")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
            activeTab === "repos"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
        >
          本地仓库雷达 ({data?.totalRepos ?? 0})
          {data && data.dirtyReposCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[11px] font-bold text-amber-400">
              {data.dirtyReposCount} 待提交
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("ssh")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
            activeTab === "ssh"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
        >
          SSH 密钥与凭据 ({data?.sshKeys.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
            activeTab === "config"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
          }`}
        >
          Git 全局配置
        </button>
      </div>

      {/* Tab 1: 本地仓库雷达 */}
      {activeTab === "repos" && (
        <ReposTab data={data} copied={copied} onCopy={handleCopy} />
      )}

      {/* Tab 2: SSH 密钥与凭据 */}
      {activeTab === "ssh" && (
        <SshTab
          sshAgentRunning={data?.sshAgentRunning ?? false}
          sshKeys={data?.sshKeys ?? []}
          copied={copied}
          onCopy={handleCopy}
          onTestSsh={() =>
            runAction({
              actionId: "git.test-ssh",
              label: "测试 GitHub SSH 连通性",
            })
          }
        />
      )}

      {/* Tab 3: Git 全局配置 */}
      {activeTab === "config" && data && (
        <ConfigTab
          config={data.config}
          userName={editUserName}
          userEmail={editUserEmail}
          saving={savingConfig}
          onChangeUserName={setEditUserName}
          onChangeUserEmail={setEditUserEmail}
          onSubmit={handleSaveConfig}
        />
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
