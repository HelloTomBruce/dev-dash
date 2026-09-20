"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GhOverview } from "@/lib/gh/types";
import { MineView } from "./mine";
import { RepoView } from "./repo-view";
import { SearchView } from "./search-view";
import { OverviewTab } from "./overview-tab";

type Tab = "mine" | "repo" | "search" | "overview";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "mine", label: "我的" },
  { key: "repo", label: "仓库" },
  { key: "search", label: "搜索" },
  { key: "overview", label: "概览" },
];

export function GhPanel() {
  const [overview, setOverview] = useState<GhOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/gh/overview");
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setOverview(j);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← 返回仪表盘
        </Link>
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-900" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-zinc-900" />
      </main>
    );
  }

  if (!overview.auth.loggedIn) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← 返回仪表盘
        </Link>
        <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-950/20 p-6">
          <h1 className="text-lg font-semibold text-amber-400">gh 未登录</h1>
          <p className="mt-2 text-sm text-zinc-400">
            请在终端执行交互式登录后刷新本页：
          </p>
          <pre className="mt-3 rounded-lg bg-zinc-900 p-3 font-mono text-xs text-emerald-400">
            gh auth login
          </pre>
          <button
            onClick={load}
            className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
          >
            刷新
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← 返回仪表盘
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          GitHub CLI
          {overview.version && (
            <span className="ml-2 font-mono text-base font-medium text-emerald-400">
              {overview.version}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-400"
            title={`${overview.auth.host} · ${overview.auth.scopes.join(", ")}`}
          >
            {overview.auth.account}@{overview.auth.host}
            {overview.auth.tokenExpired && " · token 已过期"}
          </span>
          {overview.rateLimit && (
            <span
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
                overview.rateLimit.remaining < 500
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
              }`}
              title={`配额重置 ${new Date(overview.rateLimit.resetAt * 1000).toLocaleTimeString()}`}
            >
              API {overview.rateLimit.remaining}/{overview.rateLimit.limit}
            </span>
          )}
          <button
            onClick={load}
            disabled={refreshing}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {refreshing ? "刷新中…" : "刷新"}
          </button>
        </div>
      </header>

      {overview.auth.tokenExpired && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-400">
          token 已过期，请在终端执行 gh auth refresh 后刷新
        </div>
      )}

      <nav className="mt-6 flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "mine" && <MineView />}
      {tab === "repo" && <RepoView />}
      {tab === "search" && <SearchView />}
      {tab === "overview" && <OverviewTab overview={overview} />}
    </main>
  );
}