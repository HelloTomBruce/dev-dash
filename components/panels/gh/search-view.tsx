"use client";

import { useState } from "react";
import type { GhSearchType } from "@/lib/gh/types";

const TYPES: Array<{ key: GhSearchType; label: string }> = [
  { key: "repos", label: "仓库" },
  { key: "issues", label: "Issue" },
  { key: "prs", label: "PR" },
  { key: "code", label: "代码" },
  { key: "commits", label: "提交" },
];

interface Row {
  items: Array<Record<string, unknown>>;
  type: GhSearchType;
}

function repoOf(v: unknown): string {
  return (
    (v as { nameWithOwner?: string })?.nameWithOwner ??
    (v as { fullName?: string })?.fullName ??
    "?"
  );
}

function ResultLine({ item, type }: { item: Record<string, unknown>; type: GhSearchType }) {
  if (type === "repos") {
    return (
      <a href={String(item.url)} target="_blank" rel="noreferrer" className="block border-b border-zinc-800/60 px-4 py-2.5 last:border-0 hover:bg-zinc-900/60">
        <span className="font-mono text-sm text-emerald-400">{String(item.fullName)}</span>
        <span className="ml-2 text-[11px] text-amber-400">★ {String(item.stargazersCount ?? 0)}</span>
        {item.description ? (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{String(item.description)}</p>
        ) : null}
      </a>
    );
  }
  if (type === "code") {
    return (
      <div className="border-b border-zinc-800/60 px-4 py-2 font-mono text-xs text-zinc-300 last:border-0">
        <span className="text-zinc-500">{repoOf(item.repository)}</span>
        <span className="mx-2 text-zinc-700">/</span>
        {String(item.path)}
      </div>
    );
  }
  if (type === "commits") {
    return (
      <div className="border-b border-zinc-800/60 px-4 py-2.5 last:border-0">
        <a
          href={`https://github.com/${repoOf(item.repository)}/commit/${String(item.sha)}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-emerald-400"
        >
          {String(item.sha).slice(0, 8)}
        </a>
        <span className="ml-2 text-[11px] text-zinc-600">{repoOf(item.repository)}</span>
        <p className="mt-0.5 truncate text-xs text-zinc-400">{String((item.commit as { message?: string } | undefined)?.message ?? "").split("\n")[0]}</p>
      </div>
    );
  }
  // issues / prs
  return (
    <a href={String(item.url)} target="_blank" rel="noreferrer" className="block border-b border-zinc-800/60 px-4 py-2.5 last:border-0 hover:bg-zinc-900/60">
      <span className="font-mono text-xs text-zinc-500">{repoOf(item.repository)}#{String(item.number)}</span>
      <span className="ml-2 text-sm text-zinc-200">{String(item.title)}</span>
      <span className="ml-2 text-[11px] text-zinc-600">{String(item.state)}</span>
    </a>
  );
}

export function SearchView() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<GhSearchType>("repos");
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gh/search?q=${encodeURIComponent(q.trim())}&type=${type}`
      );
      const j = await res.json();
      if (j.error) throw new Error(j.message ?? j.error);
      setResult({ items: j.items, type: j.type });
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as GhSearchType)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
        >
          {TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="搜索 GitHub…"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
        />
        <button
          onClick={search}
          disabled={loading || !q.trim()}
          className="rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
        >
          {loading ? "搜索中…" : "搜索"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-sm text-amber-400">{error}</div>
      )}

      {result && (
        <p className="mt-4 text-xs text-zinc-600">
          {result.items.length} 条结果（前 20 条）
        </p>
      )}
      {result && (
        <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800">
          {result.items.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-zinc-600">无结果</p>
          )}
          {result.items.map((item, i) => (
            <ResultLine key={i} item={item} type={result.type} />
          ))}
        </div>
      )}
    </div>
  );
}
