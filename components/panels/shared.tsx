"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { ResultModalState } from "@/components/action-result-modal";
import { ACTION_META } from "@/lib/actions/meta";

/** 面板通用：动作执行 hook（确认分级 + 结果弹窗状态 + 成功后回调） */
export function useActionRunner(onSuccess?: () => void | Promise<void>) {
  const [modal, setModal] = useState<ResultModalState | null>(null);
  const [busy, setBusy] = useState(false);

  const runAction = useCallback(
    async (opts: {
      actionId: string;
      label: string;
      params?: Record<string, string>;
      targetText?: string;
    }) => {
      const { actionId, label, params, targetText } = opts;
      const level = ACTION_META[actionId]?.level ?? "safe";
      const t = targetText ? ` ${targetText}` : "";
      if (level === "careful" && !window.confirm(`确认执行「${label}${t}」？`)) return;
      if (
        level === "dangerous" &&
        !window.confirm(`⚠️ 危险操作「${label}${t}」\n\n该操作会删除数据，确认继续？`)
      )
        return;

      setBusy(true);
      setModal({ title: `${label}${t}`, loading: true, result: null });
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: actionId, params }),
        });
        const j = await res.json();
        setModal({ title: `${label}${t}`, loading: false, result: j });
        if (j.ok) await onSuccess?.();
      } catch (e) {
        setModal({
          title: `${label}${t}`,
          loading: false,
          result: {
            ok: false,
            actionId,
            command: "",
            output: "",
            error: String(e),
            durationMs: 0,
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [onSuccess]
  );

  return { modal, busy, runAction, closeModal: () => setModal(null) };
}

export function BackLink() {
  return (
    <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
      ← 返回仪表盘
    </Link>
  );
}

export function InfoCard({
  label,
  value,
  accent,
  warn,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-medium ${
          accent ? "text-emerald-400" : warn ? "text-amber-400" : "text-zinc-200"
        } ${mono ? "font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function PanelButton({
  label,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        danger
          ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
      }`}
    >
      {label}
    </button>
  );
}
