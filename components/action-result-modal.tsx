"use client";

import { useEffect, useState } from "react";
import type { ActionResult } from "@/lib/actions/registry";
import type { TaskResult } from "@/lib/tasks/types";

export interface ResultModalState {
  title: string;
  loading: boolean;
  result: (ActionResult & { label?: string }) | null;
  /** 异步任务的 taskId（存在时轮询状态） */
  taskId?: string;
}

export function ActionResultModal({
  state,
  onClose,
}: {
  state: ResultModalState;
  onClose: () => void;
}) {
  const [task, setTask] = useState<TaskResult | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);

  // 轮询异步任务状态
  useEffect(() => {
    if (!state.taskId) return;
    const poll = async () => {
      setTaskLoading(true);
      try {
        while (true) {
          const res = await fetch(`/api/tasks?taskId=${state.taskId}`);
          if (!res.ok) { setTaskLoading(false); return; }
          const t: TaskResult = await res.json();
          setTask(t);
          if (t.status === "done" || t.status === "failed") {
            setTaskLoading(false);
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch {
        setTaskLoading(false);
      }
    };
    const id = setTimeout(poll, 0);
    return () => clearTimeout(id);
  }, [state.taskId]);

  // 监听 Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state.loading && !taskLoading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, state.loading, taskLoading]);

  const isLoading = state.loading || taskLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        aria-label="关闭"
        onClick={() => !isLoading && onClose()}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h2 className="text-sm font-semibold">{state.title}</h2>
          <div className="flex items-center gap-2.5">
            {task && (task.status === "done" || task.status === "failed") && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  task.status === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {task.status === "done" ? "完成" : "失败"} · {task.durationMs}ms
              </span>
            )}
            {taskLoading && (
              <span className="text-[11px] text-zinc-500">执行中…</span>
            )}
            <button
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="flex items-center gap-3 py-8 text-sm text-zinc-400">
              <span className="size-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
              {taskLoading ? "异步任务执行中，请稍候…" : "执行中，耗时操作（如升级）可能需要几分钟…"}
            </div>
          )}
          {task && task.status === "failed" && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
              任务失败：{task.error ?? "未知错误"}
            </div>
          )}
          {task && task.status === "done" && (
            <>
              {task.output && (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {task.output}
                </pre>
              )}
              {!task.output && (
                <p className="text-xs text-zinc-500">（任务执行成功）</p>
              )}
            </>
          )}
          {state.result && !state.taskId && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-zinc-500">执行的命令</p>
                <code className="block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-300">
                  $ {state.result.command}
                </code>
              </div>
              {state.result.output && (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-zinc-500">输出</p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {state.result.output}
                  </pre>
                </div>
              )}
              {!state.result.output && state.result.ok && (
                <p className="text-xs text-zinc-500">（无输出，命令执行成功）</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
