"use client";

import type { GhItem, GhMine } from "@/lib/gh/types";

function ItemRow({ item }: { item: GhItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-0 hover:bg-zinc-900/60"
    >
      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
        {item.kind === "pr" ? "PR" : "ISS"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200" title={item.title}>
        <span className="mr-2 font-mono text-xs text-zinc-500">{item.repo}#{item.number}</span>
        {item.title}
      </span>
      <span className="shrink-0 text-[11px] text-zinc-600">
        {new Date(item.updatedAt).toLocaleDateString()}
      </span>
    </a>
  );
}

function Group({ title, items, empty }: { title: string; items: GhItem[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-400">
        {title}（{items.length}）
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
          {empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {items.map((it) => (
            <ItemRow key={`${it.repo}#${it.number}`} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}

export function MineView({ mine }: { mine: GhMine | null }) {
  if (!mine) {
    return <p className="mt-8 text-sm text-zinc-500">数据加载失败，请刷新重试</p>;
  }
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Group title="待我 review 的 PR" items={mine.reviewRequested} empty="没有待 review 的 PR ^_^" />
      <Group title="我发起的 PR" items={mine.myPrs} empty="没有进行中的 PR" />
      <Group title="指派给我的 issue" items={mine.assignedIssues} empty="没有指派给我的 issue" />
      <Group title="提及我的" items={mine.mentions} empty="没有新的提及" />
    </div>
  );
}
