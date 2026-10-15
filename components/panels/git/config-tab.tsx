"use client";

import type { GitOverviewResult } from "@/lib/git/types";

/** 「Git 全局配置」标签页：身份表单 + 环境设置一览（受控组件，状态由父级持有） */
export function ConfigTab({
  config,
  userName,
  userEmail,
  saving,
  onChangeUserName,
  onChangeUserEmail,
  onSubmit,
}: {
  config: GitOverviewResult["config"];
  userName: string;
  userEmail: string;
  saving: boolean;
  onChangeUserName: (v: string) => void;
  onChangeUserEmail: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      {/* 用户信息修改表单 */}
      <form
        onSubmit={onSubmit}
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
              value={userName}
              onChange={(e) => onChangeUserName(e.target.value)}
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
              value={userEmail}
              onChange={(e) => onChangeUserEmail(e.target.value)}
              placeholder="例如: dev@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存全局配置"}
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
              {config.defaultBranch || "默认 (master/main)"}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
            <span className="text-zinc-500 block">Pull 行为 (pull.rebase)</span>
            <span className="font-mono text-zinc-200 mt-1 block">
              {config.pullRebase ?? "默认 (false/merge)"}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
            <span className="text-zinc-500 block">全局忽略规则文件 (core.excludesfile)</span>
            <span className="font-mono text-zinc-200 mt-1 block break-all">
              {config.globalIgnorePath || "未设置"}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/80 p-3">
            <span className="text-zinc-500 block">Git 代理 (http.proxy)</span>
            <span className="font-mono text-zinc-200 mt-1 block">
              {config.httpProxy || "未配置 (直连)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
