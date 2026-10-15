/** 仪表盘概览统计卡片 */
export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "red" | "zinc" | "amber";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "red"
        ? "text-red-400"
        : tone === "amber"
          ? "text-amber-400"
          : "text-zinc-300";
  return (
    <div className="flex items-baseline gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <span className={`text-2xl font-bold tabular-nums ${toneCls}`}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
