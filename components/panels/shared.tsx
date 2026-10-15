"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useMemo } from "react";
import Link from "next/link";
import { ACTION_META } from "@/lib/actions/meta";
import { useActionRunnerCore, type ActionRunnerConfig } from "./use-action-core";

/** 面板通用：动作执行 hook（确认分级 + 结果弹窗状态 + 成功后回调） */
export function useActionRunner(onSuccess?: () => void | Promise<void>) {
  const config = useMemo<ActionRunnerConfig>(
    () => ({
      endpoint: "/api/action",
      levelOf: (id) => ACTION_META[id]?.level ?? "safe",
      dangerousHint: "该操作会删除数据，确认继续？",
    }),
    []
  );
  return useActionRunnerCore(config, onSuccess);
}

export function BackLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
    >
      <ArrowLeftIcon size={12} weight="bold" /> 返回仪表盘
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
