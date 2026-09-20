"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteItem {
  id: string;
  label: string;
  /** 副标题（版本号 / 说明） */
  sub?: string;
  group: string;
  action: () => void;
}

export function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: PaletteItem[];
  onClose: () => void;
}) {
  // 条件挂载：每次打开都是全新状态（query/selected 自动重置）
  if (!open) return null;
  return <PaletteInner items={items} onClose={onClose} />;
}

function PaletteInner({
  items,
  onClose,
}: {
  items: PaletteItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const list = (() => {
      if (!query.trim()) return items.slice(0, 30);
      const q = query.trim().toLowerCase();
      return items
        .map((it) => {
          const l = it.label.toLowerCase();
          const s = (it.sub ?? "").toLowerCase();
          let score = -1;
          if (l.startsWith(q)) score = 0;
          else if (l.includes(q)) score = 1;
          else if (s.includes(q)) score = 2;
          return { it, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 30)
        .map((x) => x.it);
    })();
    // 预计算分组标题显示位置
    return list.map((it, i) => ({
      it,
      showGroup: i === 0 || it.group !== list[i - 1].group,
    }));
  }, [items, query]);

  // 打开时聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 选中项滚入视野
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[selected];
      if (row) {
        onClose();
        row.it.action();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <button aria-label="关闭" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4">
          <span className="text-zinc-500">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKey}
            placeholder="搜索工具、详情页、已装包…"
            className="w-full bg-transparent py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
          />
          <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-600">无匹配结果</p>
          )}
          {filtered.map(({ it, showGroup }, i) => (
            <div key={it.id}>
              {showGroup && (
                <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  {it.group}
                </p>
              )}
              <button
                data-idx={i}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  onClose();
                  it.action();
                }}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                  i === selected ? "bg-zinc-800" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {it.label}
                </span>
                {it.sub && (
                  <span className="shrink-0 font-mono text-[11px] text-zinc-500">{it.sub}</span>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>esc 关闭</span>
          <span className="ml-auto">{filtered.length} 项</span>
        </div>
      </div>
    </div>
  );
}
