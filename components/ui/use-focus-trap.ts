"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface ModalA11yOptions {
  /** 按下 Escape 时触发（例如关闭弹层）。不传则不监听 Escape。 */
  onEscape?: () => void;
  /** 是否启用（默认 true）。 */
  active?: boolean;
}

/**
 * 自定义弹层（抽屉 / 模态框）的无障碍辅助：
 * - 打开时把焦点移入容器，并保存原先焦点；关闭时恢复。
 * - Tab / Shift+Tab 在容器内循环（焦点陷阱）。
 * - 可选监听 Escape（通过 ref 读取最新回调，避免频繁重订阅）。
 *
 * 仅在浏览器端 effect 内操作 DOM，兼容 SSR。
 */
export function useModalA11y<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: ModalA11yOptions = {}
) {
  const { active = true } = options;
  const escapeRef = useRef(options.onEscape);
  useEffect(() => {
    escapeRef.current = options.onEscape;
  }, [options.onEscape]);

  // 焦点陷阱 + 焦点恢复
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const first = getFocusable()[0] ?? node;
    first.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // 阻止冒泡，避免嵌套弹层（抽屉内再开弹窗）的两个焦点陷阱相互冲突。
      e.stopPropagation();
      const list = getFocusable();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === firstEl || !node.contains(activeEl)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (activeEl === lastEl || !node.contains(activeEl)) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [ref, active]);

  // Escape 关闭
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escapeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
