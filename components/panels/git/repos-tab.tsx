"use client";

import { useMemo, useState } from "react";
import {
  GitBranchIcon,
  XIcon,
  WarningIcon,
  CheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react";
import type { GitOverviewResult, LocalRepoInfo } from "@/lib/git/types";

/** 「本地仓库雷达」标签页：搜索 + 过滤 + 仓库卡片 */
export function ReposTab({
  data,
  copied,
  onCopy,
}: {
  data: GitOverviewResult | null;
  copied: string | null;
  onCopy: (text: string, label?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [repoFilter, setRepoFilter] = useState<"all" | "dirty" | "unpushed">("all");

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
              aria-label="清除搜索"
              className="absolute right-2.5 top-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <XIcon size={12} weight="bold" />
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
                    onClick={() => onCopy(repo.path, "已复制路径")}
                    className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer truncate max-w-xs"
                    title={repo.path}
                  >
                    {repo.displayPath}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="flex items-center gap-1 rounded bg-zinc-800/90 border border-zinc-700 px-2 py-0.5 text-xs font-mono font-medium text-emerald-300">
                    <GitBranchIcon size={11} /> {repo.branch}
                  </span>
                </div>
              </div>

              {/* 状态徽章 */}
              <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                {repo.isDirty ? (
                  <span className="flex items-center gap-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium">
                    <WarningIcon size={11} weight="fill" />
                    {repo.modifiedCount} 个文件修改 {repo.untrackedCount > 0 ? `+ ${repo.untrackedCount} 未追踪` : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 text-[11px]">
                    <CheckIcon size={11} weight="bold" /> 工作区干净
                  </span>
                )}

                {repo.aheadCount > 0 && (
                  <span className="flex items-center gap-1 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 px-2 py-0.5 text-[11px] font-medium">
                    <ArrowUpIcon size={11} weight="bold" /> {repo.aheadCount} 个 commit 待推送
                  </span>
                )}
                {repo.behindCount > 0 && (
                  <span className="flex items-center gap-1 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2 py-0.5 text-[11px]">
                    <ArrowDownIcon size={11} weight="bold" /> 落后远程 {repo.behindCount} 个 commit
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
                  onClick={() => onCopy(repo.path, "已复制路径")}
                  className="rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-700"
                >
                  {copied === repo.path ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckIcon size={12} weight="bold" /> 已复制
                    </span>
                  ) : (
                    "复制路径"
                  )}
                </button>
                {repo.remoteUrl && repo.remoteUrl.startsWith("http") && (
                  <a
                    href={repo.remoteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 hover:text-white"
                  >
                    <ArrowUpRightIcon size={11} /> 远程
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
