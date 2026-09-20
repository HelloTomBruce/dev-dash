"use client";

import { useCallback, useState } from "react";
import type { ResultModalState } from "@/components/action-result-modal";
import { GH_ACTION_META } from "@/lib/gh/action-meta";
import type { GhActionLevel } from "@/lib/gh/types";

/** gh 写动作执行 hook（仿 panels/shared.tsx 的 useActionRunner，但 POST /api/gh/action） */
export function useGhActionRunner(onSuccess?: () => void | Promise<void>) {
  const [modal, setModal] = useState<ResultModalState | null>(null);
  const [busy, setBusy] = useState(false);

  const runAction = useCallback(
    async (opts: {
      actionId: string;
      label: string;
      params?: Record<string, string>;
      targetText?: string;
      /** 覆盖 meta 里的级别（如 rerun 传 dangerous） */
      level?: GhActionLevel;
    }) => {
      const { actionId, label, params, targetText } = opts;
      const level = opts.level ?? GH_ACTION_META[actionId]?.level ?? "safe";
      const t = targetText ? ` ${targetText}` : "";
      if (level === "careful" && !window.confirm(`确认执行「${label}${t}」？`)) return;
      if (
        level === "dangerous" &&
        !window.confirm(`⚠️ 危险操作「${label}${t}」\n\n该操作不可逆，确认继续？`)
      )
        return;

      setBusy(true);
      setModal({ title: `${label}${t}`, loading: true, result: null });
      try {
        const res = await fetch("/api/gh/action", {
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
