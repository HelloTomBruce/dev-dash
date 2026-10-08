"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink, InfoCard, useActionRunner } from "./shared";
import { ActionResultModal } from "@/components/action-result-modal";
import type { GitOverviewResult, LocalRepoInfo, SshKeyInfo } from "@/lib/git/types";

export function GitPanel() {
  const [data, setData] = useState<GitOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"repos" | "ssh" | "config">("repos");
  const [search, setSearch] = useState("");
  const [repoFilter, setRepoFilter] = useState<"all" | "dirty" | "unpushed">("all");
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

  const filteredRepos = useMemo(() => {
    if (!data) return [];
    return data.repos.filter((r) => {
      if (repoFilter === "dirty" && !r.isDirty) return false;
      if (repoFilter === "unpushed" && r.aheadCount === 0) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q) ||
        (r.remoteUrl && r.remoteUrl.toLowerCase().includes(q)) ||
        (r.lastCommit && r.lastCommit.message.toLowerCase().includes(q))
      );
    });
  }, [data, repoFilter, search]);

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
            <span>🌿</span> Git 仓库与环境配置
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
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            🔑 测试 GitHub SSH 连通
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
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索仓库名、分支名、最新提交..."
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

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setRepoFilter("all")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  repoFilter === "all"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                全部 ({data?.totalRepos ?? 0})
              </button>
              <button
                onClick={() => setRepoFilter("dirty")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  repoFilter === "dirty"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                有修改 ({data?.dirtyReposCount ?? 0})
              </button>
              <button
                onClick={() => setRepoFilter("unpushed")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  repoFilter === "unpushed"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                待推送 ({data?.unpushedReposCount ?? 0})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredRepos.map((repo: LocalRepoInfo) => (
              <div
                key={repo.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  repo.isDirty
                    ? "border-amber-900/60 bg-amber-950/10 shadow-xs"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">
                          {repo.name}
                        </span>
                        {repo.remoteProvider && (
                          <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 text-[10px] text-zinc-300 uppercase">
                            {repo.remoteProvider}
                          </span>
                        )}
                      </div>
                      <p
                        onClick={() => handleCopy(repo.path, "已复制路径")}
                        className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer truncate max-w-xs"
                        title={repo.path}
                      >
                        {repo.displayPath}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-zinc-800/90 border border-zinc-700 px-2 py-0.5 text-xs font-mono font-medium text-emerald-300">
                        🌿 {repo.branch}
                      </span>
                    </div>
                  </div>

                  {/* 状态徽章 */}
                  <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                    {repo.isDirty ? (
                      <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium">
                        ⚠️ {repo.modifiedCount} 个文件修改 {repo.untrackedCount > 0 ? `+ ${repo.untrackedCount} 未追踪` : ""}
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 text-[11px]">
                        ✓ 工作区干净
                      </span>
                    )}

                    {repo.aheadCount > 0 && (
                      <span className="rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 px-2 py-0.5 text-[11px] font-medium">
                        ↑ {repo.aheadCount} 个 commit 待推送
                      </span>
                    )}
                    {repo.behindCount > 0 && (
                      <span className="rounded bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2 py-0.5 text-[11px]">
                        ↓ 落后远程 {repo.behindCount} 个 commit
                      </span>
                    )}
                  </div>

                  {/* 最新 Commit */}
                  {repo.lastCommit && (
                    <div className="rounded bg-zinc-950/60 border border-zinc-800/50 p-2 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-zinc-400 font-mono">
                        <span className="text-emerald-400 font-bold">{repo.lastCommit.hash}</span>
                        <span className="text-[10px] text-zinc-500">{repo.lastCommit.relativeTime}</span>
                      </div>
                      <p className="text-zinc-300 truncate" title={repo.lastCommit.message}>
                        {repo.lastCommit.message}
                      </p>
                      <p className="text-[10px] text-zinc-500">by {repo.lastCommit.author}</p>
                    </div>
                  )}
                </div>

                {/* 底部操作 */}
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                  <span className="text-[11px] text-zinc-500 truncate max-w-[200px]" title={repo.remoteUrl || "无远程仓库"}>
                    {repo.remoteUrl ? repo.remoteUrl.replace(/^https?:\/\//, "").replace(/^git@/, "") : "本地仓库"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(repo.path, "已复制路径")}
                      className="rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-700"
                    >
                      {copied === repo.path ? "✓ 已复制" : "复制路径"}
                    </button>
                    {repo.remoteUrl && repo.remoteUrl.startsWith("http") && (
                      <a
                        href={repo.remoteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 hover:text-white"
                      >
                        ↗ 远程
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: SSH 密钥与凭据 */}
      {activeTab === "ssh" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div>
              <h3 className="font-semibold text-sm text-zinc-200 flex items-center gap-2">
                <span>🔐</span> SSH Agent 状态: {data?.sshAgentRunning ? (
                  <span className="text-emerald-400 font-medium">🟢 运行中</span>
                ) : (
                  <span className="text-zinc-400">⚪️ 未运行</span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                扫描目录: ~/.ssh/ 下的所有公钥文件，可直接复制公钥快速配置到 GitHub / GitLab
              </p>
            </div>
            <button
              onClick={() =>
                runAction({
                  actionId: "git.test-ssh",
                  label: "测试 GitHub SSH 连通性",
                })
              }
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
            >
              测试 GitHub 连接
            </button>
          </div>

          <div className="space-y-3">
            {data?.sshKeys.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                未在 ~/.ssh 目录下检测到 .pub 公钥文件
              </div>
            ) : (
              data?.sshKeys.map((k: SshKeyInfo) => (
                <div
                  key={k.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100">
                          {k.filename}
                        </span>
                        <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 text-[10px] text-emerald-400 font-mono">
                          {k.keyType} {k.bits ? `(${k.bits} bits)` : ""}
                        </span>
                        {k.isLoadedInAgent && (
                          <span className="rounded bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 text-[10px]">
                            Agent 已加载
                          </span>
                        )}
                      </div>
                      {k.comment && (
                        <p className="text-xs text-zinc-400">
                          备注 / 关联邮箱: <span className="font-mono text-zinc-300">{k.comment}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-zinc-500 font-mono">
                        指纹: {k.fingerprint}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopy(k.publicKey, "已复制公钥内容")}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors shrink-0"
                    >
                      {copied === k.publicKey ? "✓ 已复制" : "📋 复制公钥"}
                    </button>
                  </div>

                  {/* 公钥预览 */}
                  <div className="rounded bg-zinc-950/80 border border-zinc-800/60 p-2.5 text-[11px] font-mono text-zinc-400 break-all select-all">
                    {k.publicKey}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Git 全局配置 */}
      {activeTab === "config" && data && (
        <div className="mt-4 space-y-4">
          {/* 用户信息修改表单 */}
          <form
            onSubmit={handleSaveConfig}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4"
          >
            <div>
              <h3 className="font-semibold text-sm text-zinc-200">全局提交者身份配置 (Global Identity)</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                修改后将保存至 ~/.gitconfig，新提交的代码将使用此身份
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">
                  user.name (用户名)
                </label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  placeholder="例如: zhangbei"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">
                  user.email (邮箱)
                </label>
                <input
                  type="text"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  placeholder="例如: dev@example.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {savingConfig ? "保存中…" : "保存全局配置"}
              </button>
            </div>
          </form>

          {/* 全局常用设置一览 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
            <h3 className="font-semibold text-sm text-zinc-200">环境与网络设置</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
                <span className="text-zinc-500 block">默认初始化分支 (init.defaultBranch)</span>
                <span className="font-mono text-zinc-200 mt-1 block">
                  {data.config.defaultBranch || "默认 (master/main)"}
                </span>
              </div>
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
                <span className="text-zinc-500 block">Pull 行为 (pull.rebase)</span>
                <span className="font-mono text-zinc-200 mt-1 block">
                  {data.config.pullRebase ?? "默认 (false/merge)"}
                </span>
              </div>
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
                <span className="text-zinc-500 block">全局忽略规则文件 (core.excludesfile)</span>
                <span className="font-mono text-zinc-200 mt-1 block break-all">
                  {data.config.globalIgnorePath || "未设置"}
                </span>
              </div>
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
                <span className="text-zinc-500 block">Git 代理 (http.proxy)</span>
                <span className="font-mono text-zinc-200 mt-1 block">
                  {data.config.httpProxy || "未配置 (直连)"}
                </span>
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
