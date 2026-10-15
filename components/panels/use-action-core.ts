"use client";

import { useCallback, useState } from "react";
import type { ResultModalState } from "@/components/action-result-modal";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type ActionLevel = "safe" | "careful" | "dangerous";

export interface RunActionOptions {
  actionId: string;
  label: string;
  params?: Record<string, string>;
  targetText?: string;
  /** 覆盖级别解析结果（如 gh rerun 强制按 dangerous 确认） */
  level?: ActionLevel;
}

export interface ActionRunnerConfig {
  /** 动作执行接口地址（/api/action 或 /api/gh/action） */
  endpoint: string;
  /** 由动作 id 解析安全级别 */
  levelOf: (actionId: string) => ActionLevel;
  /** dangerous 级别的二次确认提示正文 */
  dangerousHint: string;
}

/**
 * 面板动作执行通用 hook：分级确认 + 结果弹窗状态 + 成功后回调。
 *
 * panels/shared.tsx（通用动作）与 panels/gh/action-runner.ts（gh 写动作）共用此实现，
 * 仅通过 config 注入接口地址、级别来源与危险提示，消除两份近乎复制的代码。
 */
export function useActionRunnerCore(
  config: ActionRunnerConfig,
  onSuccess?: () => void | Promise<void>
) {
  const [modal, setModal] = useState<ResultModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  const runAction = useCallback(
    async (opts: RunActionOptions) => {
      const { actionId, label, params, targetText } = opts;
      const level = opts.level ?? config.levelOf(actionId);
      const t = targetText ? ` ${targetText}` : "";
      if (level === "careful") {
        const ok = await confirm({
          title: `确认执行「${label}${t}」？`,
          confirmLabel: "执行",
        });
        if (!ok) return;
      }
      if (level === "dangerous") {
        const ok = await confirm({
          title: `⚠️ 危险操作「${label}${t}」`,
          description: config.dangerousHint,
          confirmLabel: "仍要执行",
          tone: "danger",
        });
        if (!ok) return;
      }

      setBusy(true);
      setModal({ title: `${label}${t}`, loading: true, result: null });
      try {
        const res = await fetch(config.endpoint, {
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
    [config, onSuccess, confirm]
  );

  return { modal, busy, runAction, closeModal: () => setModal(null) };
}
