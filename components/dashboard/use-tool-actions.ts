"use client";

import { useCallback, useState } from "react";
import { ACTION_META, SERVICE_ACTIONS, type ToolActionDef } from "@/lib/actions/meta";
import type { ResultModalState } from "@/components/action-result-modal";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface ActionableTool {
  id: string;
  name: string;
  version: string | null;
  path: string | null;
}

/**
 * 仪表盘动作执行层：服务启停（轻量 Toast）与工具菜单动作（结果弹窗 / 异步任务轮询）。
 * 从 app/page.tsx 抽离，页面组件只负责把结果渲染出来。
 */
export function useToolActions(
  fetchScan: (force?: boolean) => Promise<void>,
  handleCopy: (text: string) => void
) {
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [resultModal, setResultModal] = useState<ResultModalState | null>(null);
  const confirm = useConfirm();

  /** 执行服务启停动作 */
  const runServiceAction = useCallback(
    async (toolId: string, kind: "start" | "stop") => {
      const svc = SERVICE_ACTIONS[toolId];
      const ref = kind === "start" ? svc?.start : svc?.stop;
      if (!ref) return;
      const meta = ACTION_META[ref.actionId];
      if (meta && meta.level !== "safe") {
        const ok = await confirm({ title: `确认${meta.label}？`, confirmLabel: "执行" });
        if (!ok) return;
      }
      setActionBusy(toolId);
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ref.actionId, params: ref.params }),
        });
        const j = await res.json();
        setToast({
          msg: j.ok
            ? `${j.label ?? ref.actionId}成功（${j.durationMs}ms）`
            : `${j.label ?? ref.actionId}失败：${j.error ?? "未知错误"}`,
          type: j.ok ? "ok" : "err",
        });
        // 刷新扫描 + 健康状态（强制绕过缓存）
        await fetchScan(true);
      } catch (e) {
        setToast({ msg: `请求失败：${String(e)}`, type: "err" });
      } finally {
        setActionBusy(null);
        setTimeout(() => setToast(null), 4000);
      }
    },
    [fetchScan, confirm]
  );

  /** 执行工具操作菜单项（通用复制 + 服务端动作） */
  const runToolAction = useCallback(
    async (tool: ActionableTool, def: ToolActionDef) => {
      // 纯前端操作
      if (def.clientAction === "copy-version" && tool.version) {
        handleCopy(tool.version);
        return;
      }
      if (def.clientAction === "copy-path" && tool.path) {
        handleCopy(tool.path);
        return;
      }
      if (!def.actionId) return;

      // 分级确认
      if (def.level === "careful") {
        const ok = await confirm({
          title: `确认执行「${def.label}」？`,
          description: `目标工具：${tool.name}`,
          confirmLabel: "执行",
        });
        if (!ok) return;
      }
      if (def.level === "dangerous") {
        const ok = await confirm({
          title: `⚠️ 危险操作「${def.label}」`,
          description: `目标工具：${tool.name}\n\n该操作会删除数据，确认继续？`,
          confirmLabel: "仍要执行",
          tone: "danger",
        });
        if (!ok) return;
      }

      // open-dir 的 dir 参数从工具路径推导
      const params =
        def.actionId === "tool.open-dir" && tool.path
          ? { dir: tool.path.split("/").slice(0, -1).join("/") }
          : def.params;

      setActionBusy(`${tool.id}:${def.key}`);
      setResultModal({ title: `${tool.name} · ${def.label}`, loading: true, result: null });
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: def.actionId, params }),
        });
        const j = await res.json();

        // 异步任务：显示轮询弹窗
        if (j.taskId) {
          setResultModal({
            title: `${tool.name} · ${def.label}`,
            loading: true,
            result: null,
            taskId: j.taskId,
          });
          // 轮询完成后刷新扫描
          const checkTask = async () => {
            try {
              while (true) {
                const tr = await fetch(`/api/tasks?taskId=${j.taskId}`);
                const t = await tr.json();
                if (t.status === "done" || t.status === "failed") {
                  setResultModal({
                    title: `${tool.name} · ${def.label}`,
                    loading: false,
                    result: {
                      ok: t.status === "done",
                      actionId: def.actionId!,
                      command: "",
                      output: t.output,
                      error: t.error,
                      durationMs: t.durationMs,
                      label: def.label,
                    },
                  });
                  if (t.status === "done" && def.refreshAfter) {
                    await fetchScan(true);
                  }
                  break;
                }
                await new Promise((r) => setTimeout(r, 2000));
              }
            } catch {
              // ignore
            }
          };
          checkTask();
          return;
        }

        setResultModal({ title: `${tool.name} · ${def.label}`, loading: false, result: j });
        if (j.ok && def.refreshAfter) {
          await fetchScan(true);
        }
      } catch (e) {
        setResultModal({
          title: `${tool.name} · ${def.label}`,
          loading: false,
          result: { ok: false, actionId: def.actionId, command: "", output: "", error: String(e), durationMs: 0 },
        });
      } finally {
        setActionBusy(null);
      }
    },
    [fetchScan, handleCopy, confirm]
  );

  return { actionBusy, toast, resultModal, setResultModal, runServiceAction, runToolAction };
}
