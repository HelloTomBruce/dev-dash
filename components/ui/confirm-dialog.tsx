"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { useModalA11y } from "@/components/ui/use-focus-trap";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger 时确认按钮使用破坏性配色 */
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * 全局确认弹层：把命令式的 `window.confirm` 替换为可访问的原生弹窗
 * （role="alertdialog" + aria-modal + 焦点陷阱 + Escape 取消）。
 *
 * 用法：在根布局包裹 `<ConfirmProvider>`，业务侧 `const confirm = useConfirm()`，
 * 然后 `if (!(await confirm({ title: "确认删除？" }))) return;`。
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && options && <ConfirmDialog options={options} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (value: boolean) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, { onEscape: () => onSettle(false) });

  // 打开期间锁定背景滚动
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const isDanger = options.tone === "danger";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        aria-hidden="true"
        onClick={() => onSettle(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={options.description ? "confirm-dialog-desc" : undefined}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl outline-none"
      >
        <h2 id="confirm-dialog-title" className="text-sm font-semibold text-zinc-100">
          {options.title}
        </h2>
        {options.description && (
          <p
            id="confirm-dialog-desc"
            className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400"
          >
            {options.description}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onSettle(false)}>
            {options.cancelLabel ?? "取消"}
          </Button>
          <Button
            variant={isDanger ? "destructive" : "default"}
            size="sm"
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel ?? "确认"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm 必须在 <ConfirmProvider> 内使用");
  }
  return ctx;
}
