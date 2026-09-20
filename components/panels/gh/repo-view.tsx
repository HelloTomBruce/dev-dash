"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionResultModal } from "@/components/action-result-modal";
import type {
  GhChecksState,
  GhIssue,
  GhPr,
  GhRepoDetail,
  GhRepoRef,
  GhRun,
} from "@/lib/gh/types";
import { PanelButton } from "../shared";
import { useGhActionRunner } from "./action-runner";

type SubTab = "prs" | "issues" | "runs";

function ChecksBadge({ state }: { state: GhChecksState }) {
  if (!state) return null;
  const map = {
    success: { dot: "🟢", text: "text-emerald-400" },
    failure: { dot: "🔴", text: "text-red-400" },
    pending: { dot: "🟡", text: "text-amber-400" },
  } as const;
  return (
    <span className={`shrink-0 text-[11px] ${map[state].text}`} title={`checks: ${state}`}>
      {map[state].dot}
    </span>
  );
}

function PrRow({ pr, repo, busy, onAction }: {
  pr: GhPr;
  repo: string;
  busy: boolean;
  onAction: (opts: { actionId: string; label: string; params: Record<string, string>; targetText?: string; level?: "careful" | "dangerous" }) => void;
}) {
  const [method, setMethod] = useState<"squash" | "merge" | "rebase">("squash");
  const base = { repo, number: String(pr.number) };
  return (
    <div className="border-b border-zinc-800/60 px-4 py-2.5 last:border-0">
      <div className="flex items-center gap-2">
        <ChecksBadge state={pr.checksState} />
        {pr.isDraft && (
          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">draft</span>
        )}
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-emerald-400"
          title={pr.title}
        >
          <span className="mr-2 font-mono text-xs text-zinc-500">#{pr.number}</span>
          {pr.title}
        </a>
        <span className="shrink-0 text-[11px] text-zinc-600">{pr.author}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
        <span className={`text-[11px] ${pr.mergeable === "MERGEABLE" ? "text-emerald-500" : pr.mergeable === "CONFLICTING" ? "text-red-400" : "text-zinc-600"}`}>
          {pr.mergeable}
        </span>
        {pr.reviewDecision && (
          <span className="text-[11px] text-zinc-600">{pr.reviewDecision}</span>
        )}
        <span className="flex-1" />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-400"
        >
          <option value="squash">squash</option>
          <option value="merge">merge</option>
          <option value="rebase">rebase</option>
        </select>
        <PanelButton
          label="合并"
          disabled={busy || pr.isDraft || pr.mergeable !== "MERGEABLE"}
          onClick={() =>
            onAction({ actionId: "gh.pr.merge", label: "合并 PR", params: { ...base, method }, targetText: `#${pr.number}` })
          }
        />
        <PanelButton
          label="Approve"
          disabled={busy}
          onClick={() =>
            onAction({ actionId: "gh.pr.review", label: "Approve", params: { ...base, event: "approve" }, targetText: `#${pr.number}` })
          }
        />
        <PanelButton
          label="Request changes"
          disabled={busy}
          onClick={() => {
            const body = window.prompt("Request changes 需要说明理由：");
            if (!body?.trim()) return;
            onAction({ actionId: "gh.pr.review", label: "Request changes", params: { ...base, event: "request-changes", body: body.trim() }, targetText: `#${pr.number}` });
          }}
        />
        <PanelButton
          label="评论"
          disabled={busy}
          onClick={() => {
            const body = window.prompt("评论内容：");
            if (!body?.trim()) return;
            onAction({ actionId: "gh.pr.comment", label: "评论 PR", params: { ...base, body: body.trim() }, targetText: `#${pr.number}` });
          }}
        />
        <PanelButton
          label="关闭"
          disabled={busy}
          onClick={() =>
            onAction({ actionId: "gh.pr.close", label: "关闭 PR", params: base, targetText: `#${pr.number}` })
          }
        />
      </div>
    </div>
  );
}

function IssueRow({ issue, repo, busy, onAction }: {
  issue: GhIssue;
  repo: string;
  busy: boolean;
  onAction: (opts: { actionId: string; label: string; params: Record<string, string>; targetText?: string }) => void;
}) {
  const base = { repo, number: String(issue.number) };
  return (
    <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5 last:border-0">
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-emerald-400"
        title={issue.title}
      >
        <span className="mr-2 font-mono text-xs text-zinc-500">#{issue.number}</span>
        {issue.title}
      </a>
      {issue.labels.slice(0, 3).map((l) => (
        <span key={l} className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{l}</span>
      ))}
      <span className="shrink-0 text-[11px] text-zinc-600">{issue.author}</span>
      <PanelButton
        label="评论"
        disabled={busy}
        onClick={() => {
          const body = window.prompt("评论内容：");
          if (!body?.trim()) return;
          onAction({ actionId: "gh.issue.comment", label: "评论 issue", params: { ...base, body: body.trim() }, targetText: `#${issue.number}` });
        }}
      />
      <PanelButton
        label="关闭"
        disabled={busy}
        onClick={() =>
          onAction({ actionId: "gh.issue.close", label: "关闭 issue", params: base, targetText: `#${issue.number}` })
        }
      />
    </div>
  );
}

function RunRow({ run, repo, busy, onAction }: {
  run: GhRun;
  repo: string;
  busy: boolean;
  onAction: (opts: { actionId: string; label: string; params: Record<string, string>; targetText?: string; level?: "careful" | "dangerous" }) => void;
}) {
  const icon =
    run.status !== "completed"
      ? "🟡"
      : run.conclusion === "success"
        ? "🟢"
        : run.conclusion === "cancelled" || run.conclusion === "skipped"
          ? "⚪"
          : "🔴";
  return (
    <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5 last:border-0">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <a href={run.url} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-200 hover:text-emerald-400">
          {run.displayTitle}
        </a>
        <p className="truncate text-[11px] text-zinc-600">
          {run.workflowName} · {run.headBranch} · {new Date(run.createdAt).toLocaleString()}
        </p>
      </div>
      <PanelButton
        label={run.status !== "completed" ? "取消" : "重跑"}
        disabled={busy}
        onClick={() =>
          run.status !== "completed"
            ? onAction({ actionId: "gh.run.cancel", label: "取消 workflow", params: { repo, runId: String(run.databaseId) }, targetText: run.workflowName })
            : onAction({ actionId: "gh.run.rerun", label: "重跑 workflow", params: { repo, runId: String(run.databaseId) }, targetText: run.workflowName })
        }
      />
      {run.status === "completed" && run.conclusion === "failure" && (
        <PanelButton
          label="重跑失败项"
          disabled={busy}
          onClick={() =>
            onAction({ actionId: "gh.run.rerun", label: "重跑失败作业", params: { repo, runId: String(run.databaseId), failedOnly: "1" }, targetText: run.workflowName })
          }
        />
      )}
    </div>
  );
}

export function RepoView() {
  const [repos, setRepos] = useState<GhRepoRef[] | null>(null);
  const [filter, setFilter] = useState("");
  const [repo, setRepo] = useState<string | null>(null);
  const [detail, setDetail] = useState<GhRepoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("prs");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/gh/repos")
      .then((r) => r.json())
      .then((j) => setRepos(j.repos ?? []))
      .catch((e) => setError(String(e)));
  }, []);

  const loadDetail = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/gh/repo?repo=${encodeURIComponent(r)}`);
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setDetail(j);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // Runs tab 15 秒轮询；离开 tab/换仓库/卸载时清除
  useEffect(() => {
    if (!repo || subTab !== "runs") return;
    timerRef.current = setInterval(() => loadDetail(repo), 15_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [repo, subTab, loadDetail]);

  const filtered = useMemo(() => {
    const list = repos ?? [];
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, filter]);

  const { modal, busy, runAction, closeModal } = useGhActionRunner(() => {
    if (repo) loadDetail(repo);
  });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤仓库…"
          className="w-56 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
        />
        <select
          value={repo ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setRepo(v);
            setDetail(null);
            if (v) loadDetail(v);
          }}
          className="max-w-xs flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-200 outline-none focus:border-zinc-600"
        >
          <option value="">选择仓库…</option>
          {filtered.map((r) => (
            <option key={r.fullName} value={r.fullName}>
              {r.fullName}
              {r.isPrivate ? " 🔒" : ""}
              {r.isFork ? " 🍴" : ""}
            </option>
          ))}
        </select>
        {detail?.repo && (
          <span className="text-xs text-zinc-500">
            ★ {detail.repo.stars} · 默认分支 {detail.repo.defaultBranch}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-400">{error}</div>
      )}

      {!repo && (
        <p className="mt-8 text-center text-sm text-zinc-600">选择一个仓库查看 PR / issue / CI</p>
      )}

      {repo && !detail && !error && (
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-zinc-900" />
      )}

      {repo && detail && (
        <>
          <nav className="mt-5 flex gap-1 border-b border-zinc-800">
            {(
              [
                ["prs", `PR（${detail.prs?.length ?? "?"}）`],
                ["issues", `Issues（${detail.issues?.length ?? "?"}）`],
                ["runs", `Actions（${detail.runs?.length ?? "?"}）`],
              ] as Array<[SubTab, string]>
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSubTab(k)}
                className={`px-4 py-2 text-sm font-medium ${
                  subTab === k
                    ? "border-b-2 border-emerald-400 text-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {detail.errors[subTab] && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-400">
              该分区加载失败：{detail.errors[subTab]}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            {subTab === "prs" &&
              (detail.prs?.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-zinc-600">没有 open 的 PR</p>
              ) : (
                detail.prs?.map((pr) => (
                  <PrRow key={pr.number} pr={pr} repo={repo} busy={busy} onAction={runAction} />
                ))
              ))}
            {subTab === "issues" &&
              (detail.issues?.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-zinc-600">没有 open 的 issue</p>
              ) : (
                detail.issues?.map((i) => (
                  <IssueRow key={i.number} issue={i} repo={repo} busy={busy} onAction={runAction} />
                ))
              ))}
            {subTab === "runs" &&
              (detail.runs?.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-zinc-600">没有 workflow 运行记录</p>
              ) : (
                detail.runs?.map((r) => (
                  <RunRow key={r.databaseId} run={r} repo={repo} busy={busy} onAction={runAction} />
                ))
              ))}
          </div>
        </>
      )}

      {modal && <ActionResultModal state={modal} onClose={closeModal} />}
    </div>
  );
}
