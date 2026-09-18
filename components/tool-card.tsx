import type { ToolResult } from "@/lib/detectors/types";
import type { InventoryMeta } from "@/lib/inventories/meta";
import { ActionMenu } from "./action-menu";
import { DETAIL_PAGES, type ToolActionDef } from "@/lib/actions/meta";
import Link from "next/link";

const SOURCE_STYLE: Record<string, string> = {
  nvm: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pyenv: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rustup: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  asdf: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  mise: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "npm-global": "bg-sky-500/15 text-sky-400 border-sky-500/30",
  brew: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  system: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  manual: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
        SOURCE_STYLE[source] ?? "bg-violet-500/15 text-violet-400 border-violet-500/30"
      }`}
    >
      {source}
    </span>
  );
}

export function ToolCard({
  tool,
  inventories,
  health,
  service,
  actions = [],
  actionBusy = false,
  onRunAction,
  onOpenInventory,
  onCopy,
}: {
  tool: ToolResult;
  /** 该工具可查看的已装清单（仅安装成功时由父组件传入） */
  inventories: InventoryMeta[];
  /** 服务健康状态（仅支持健康检查的工具会传入） */
  health?: { status: "running" | "stopped"; detail: string } | null;
  /** 服务启停操作（仅支持管理的工具会传入） */
  service?: {
    busy: boolean;
    onStart: () => void;
    onStop: () => void;
  } | null;
  /** 操作菜单项 */
  actions?: ToolActionDef[];
  actionBusy?: boolean;
  onRunAction?: (def: ToolActionDef) => void;
  onOpenInventory: (entry: InventoryMeta) => void;
  onCopy: (text: string) => void;
}) {
  if (tool.status === "not-found") {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 opacity-40">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">{tool.name}</span>
          <span className="text-[10px] text-zinc-500">未安装</span>
        </div>
        <div className="mt-2 text-xs text-zinc-600">—</div>
      </div>
    );
  }

  const isError = tool.status === "error";

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isError
          ? "border-red-500/40 bg-red-950/20"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {DETAIL_PAGES.includes(tool.id) ? (
          <Link
            href={`/tools/${tool.id}`}
            title="打开详情页"
            className="truncate text-sm font-semibold text-zinc-100 hover:text-emerald-300 hover:underline"
          >
            {tool.name} ↗
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold text-zinc-100">
            {tool.name}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {isError ? (
            <span className="shrink-0 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
              异常
            </span>
          ) : (
            <span className="shrink-0 font-mono text-sm font-medium text-emerald-400">
              {tool.version}
            </span>
          )}
          {onRunAction && (
            <ActionMenu actions={actions} disabled={actionBusy} onRun={onRunAction} />
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SourceBadge source={tool.source} />
        {/* 服务健康状态 + 启停按钮 */}
        {health && !isError && (
          <span
            title={health.detail}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
              health.status === "running"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "border-red-500/30 bg-red-500/15 text-red-400"
            }`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${
                health.status === "running" ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {health.status === "running" ? "运行中" : "已停止"}
          </span>
        )}
        {service && health && !isError && (
          health.status === "stopped" ? (
            <button
              onClick={service.onStart}
              disabled={service.busy}
              className="inline-flex items-center gap-0.5 rounded-md border border-emerald-600/50 bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
            >
              {service.busy ? "…" : "▶ 启动"}
            </button>
          ) : (
            <button
              onClick={service.onStop}
              disabled={service.busy}
              className="inline-flex items-center gap-0.5 rounded-md border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              {service.busy ? "…" : "■ 停止"}
            </button>
          )
        )}
        {isError && (
          <span
            className="truncate text-[10px] text-red-400/80"
            title={tool.error ?? ""}
          >
            {tool.error}
          </span>
        )}
      </div>

      {tool.path && (
        <button
          onClick={() => onCopy(tool.path!)}
          title={`点击复制：${tool.path}`}
          className="mt-2.5 block w-full truncate text-left font-mono text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          {tool.path}
        </button>
      )}

      {/* 已装清单入口 */}
      {inventories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-800/70 pt-2.5">
          {inventories.map((inv) => (
            <button
              key={inv.id}
              onClick={() => onOpenInventory(inv)}
              className="rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              📋 {inv.entryLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
