"use client";

import { useEffect, useRef, useState } from "react";
import type { ToolActionDef } from "@/lib/actions/meta";

const LEVEL_DOT: Record<string, string> = {
  safe: "bg-emerald-400",
  careful: "bg-amber-400",
  dangerous: "bg-red-400",
};

export function ActionMenu({
  actions,
  disabled,
  onRun,
}: {
  actions: ToolActionDef[];
  disabled?: boolean;
  onRun: (def: ToolActionDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="操作"
        className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-56 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={() => {
                setOpen(false);
                onRun(a);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[a.level]}`} />
              <span className="flex-1">{a.label}</span>
              {a.level !== "safe" && (
                <span className="text-[9px] text-zinc-600">
                  {a.level === "careful" ? "需确认" : "危险"}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
