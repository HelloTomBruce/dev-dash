"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ToolCard } from "@/components/tool-card";
import { InventoryDrawer } from "@/components/inventory-drawer";
import { PortInspectorDrawer } from "@/components/port-inspector-drawer";
import { DevCleanerDrawer } from "@/components/dev-cleaner-drawer";
import { DoctorDrawer } from "@/components/doctor-drawer";
import { CommandPalette } from "@/components/command-palette";
import { CategoryIcon } from "@/components/icons";
import { PlugsIcon, BroomIcon, StethoscopeIcon, MagnifyingGlassIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { CATEGORY_META, type Category } from "@/lib/detectors/types";
import { INVENTORY_META, type InventoryMeta } from "@/lib/inventories/meta";
import { COMMON_ACTIONS, TOOL_ACTIONS, SERVICE_ACTIONS, type ToolActionDef } from "@/lib/actions/meta";
import { ActionResultModal } from "@/components/action-result-modal";
import { StatCard } from "@/components/dashboard/stat-card";
import { useCopy } from "@/components/dashboard/use-copy";
import { useDashboardScan } from "@/components/dashboard/use-dashboard-scan";
import { useToolActions } from "@/components/dashboard/use-tool-actions";
import { usePaletteItems } from "@/components/dashboard/use-palette-items";

const CATEGORY_ORDER: Category[] = [
  "runtime",
  "version-manager",
  "package-manager",
  "container",
  "database",
  "base-tool",
];

export default function Home() {
  const router = useRouter();
  const [drawer, setDrawer] = useState<InventoryMeta | null>(null);
  const [portDrawerOpen, setPortDrawerOpen] = useState(false);
  const [cleanerDrawerOpen, setCleanerDrawerOpen] = useState(false);
  const [doctorDrawerOpen, setDoctorDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const {
    data,
    loading,
    refreshing,
    error,
    health,
    autoRefresh,
    setAutoRefresh,
    packageIndex,
    fetchScan,
  } = useDashboardScan();
  const { copied, handleCopy } = useCopy();
  const { actionBusy, toast, resultModal, setResultModal, runServiceAction, runToolAction } =
    useToolActions(fetchScan, handleCopy);

  // ⌘K / Ctrl+K 打开全局搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback((path: string) => router.push(path), [router]);
  const openDrawer = useCallback((entry: InventoryMeta) => setDrawer(entry), []);
  const openPorts = useCallback(() => setPortDrawerOpen(true), []);
  const openCleaner = useCallback(() => setCleanerDrawerOpen(true), []);
  const openDoctor = useCallback(() => setDoctorDrawerOpen(true), []);

  const paletteItems = usePaletteItems({
    data,
    packageIndex,
    navigate,
    copy: handleCopy,
    openDrawer,
    openPorts,
    openCleaner,
    openDoctor,
  });

  /** 工具的操作菜单 = 通用操作 + 工具专属操作 */
  const actionsFor = useCallback(
    (tool: { id: string; status: string }): ToolActionDef[] => {
      if (tool.status !== "ok") return [];
      return [...COMMON_ACTIONS, ...(TOOL_ACTIONS[tool.id] ?? [])];
    },
    []
  );

  /** toolId → 可用清单（仅工具安装成功时显示入口） */
  const inventoriesByTool = useMemo(() => {
    const map = new Map<string, InventoryMeta[]>();
    for (const inv of INVENTORY_META) {
      const tool = data?.tools.find((t) => t.id === inv.toolId);
      if (tool && tool.status === "ok") {
        map.set(inv.toolId, [...(map.get(inv.toolId) ?? []), inv]);
      }
    }
    return map;
  }, [data]);

  // 统计过期工具数量
  const outdatedCount = data?.tools.filter((t) => t.outdated != null).length ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* 顶栏 */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            DevDash
            <span className="ml-3 text-sm font-normal text-zinc-500">
              本地开发环境仪表盘
            </span>
          </h1>
          {data && (
            <p className="mt-1 text-xs text-zinc-500">
              上次扫描 {new Date(data.scannedAt).toLocaleTimeString("zh-CN")} ·
              耗时 {data.durationMs}ms
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            <MagnifyingGlassIcon size={14} weight="regular" /> 搜索
            <kbd className="rounded border border-zinc-700 px-1 text-[10px]">⌘K</kbd>
          </button>
          <button
            onClick={openPorts}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            <PlugsIcon size={15} weight="regular" /> 端口监控
          </button>
          <button
            onClick={openCleaner}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            <BroomIcon size={15} weight="regular" /> 磁盘清理
          </button>
          <button
            onClick={openDoctor}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            <StethoscopeIcon size={15} weight="regular" /> 环境体检
          </button>
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-emerald-500"
            />
            自动刷新 30s
          </label>
          <button
            onClick={() => fetchScan(true)}
            disabled={refreshing}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-sm text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-50"
          >
            {refreshing ? "扫描中…" : "刷新"}
          </button>
          <a
            href="/api/export/json"
            download
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            <DownloadSimpleIcon size={15} weight="regular" /> 导出
          </a>
        </div>
      </header>

      {/* 概览条 */}
      {data && (
        <div className="mt-6 flex flex-wrap gap-3">
          <StatCard label="已安装" value={data.summary.installed} tone="emerald" />
          <StatCard label="未安装" value={data.summary.notFound} tone="zinc" />
          <StatCard
            label="异常"
            value={data.summary.errors}
            tone={data.summary.errors > 0 ? "red" : "zinc"}
          />
          <StatCard label="检测总数" value={data.summary.total} tone="zinc" />
          {outdatedCount > 0 && (
            <StatCard
              label="有更新"
              value={outdatedCount}
              tone="amber"
            />
          )}
          {Object.keys(health).length > 0 && (
            <StatCard
              label="服务运行中"
              value={
                Object.values(health).filter((h) => h.status === "running").length
              }
              tone="emerald"
            />
          )}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-400">
          加载失败：{error}
        </div>
      )}

      {/* 加载骨架 */}
      {loading && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40"
            />
          ))}
        </div>
      )}

      {/* 分类工具区 */}
      {data &&
        CATEGORY_ORDER.map((cat) => {
          const tools = data.tools.filter((t) => t.category === cat);
          if (tools.length === 0) return null;
          return (
            <section key={cat} className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-400">
                <CategoryIcon name={CATEGORY_META[cat].icon} size={15} className="text-zinc-500" />
                {CATEGORY_META[cat].label}
                <span className="text-xs font-normal text-zinc-600">
                  {tools.filter((t) => t.status === "ok").length}/{tools.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {tools.map((t) => (
                  <ToolCard
                    key={t.id}
                    tool={t}
                    inventories={inventoriesByTool.get(t.id) ?? []}
                    health={health[t.id] ?? null}
                    service={
                      SERVICE_ACTIONS[t.id]
                        ? {
                            busy: actionBusy === t.id,
                            onStart: () => runServiceAction(t.id, "start"),
                            onStop: () => runServiceAction(t.id, "stop"),
                          }
                        : null
                    }
                    actions={actionsFor(t)}
                    actionBusy={actionBusy?.startsWith(`${t.id}:`) ?? false}
                    onRunAction={(def) => runToolAction(t, def)}
                    onOpenInventory={setDrawer}
                    onCopy={handleCopy}
                  />
                ))}
              </div>
            </section>
          );
        })}

      {/* 操作结果 Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            toast.type === "ok"
              ? "border-emerald-500/40 bg-emerald-950 text-emerald-300"
              : "border-red-500/40 bg-red-950 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* 复制提示 */}
      {copied && !drawer && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-200 shadow-lg">
          已复制 {copied}
        </div>
      )}

      {/* 已装清单抽屉 */}
      {drawer && (
        <InventoryDrawer entry={drawer} onClose={() => setDrawer(null)} />
      )}

      {/* 端口占用监控抽屉 */}
      {portDrawerOpen && (
        <PortInspectorDrawer
          onClose={() => setPortDrawerOpen(false)}
          onRefreshParent={() => fetchScan(true)}
        />
      )}

      {/* 磁盘清理助手抽屉 */}
      {cleanerDrawerOpen && (
        <DevCleanerDrawer
          onClose={() => setCleanerDrawerOpen(false)}
          onRefreshParent={() => fetchScan(true)}
        />
      )}

      {/* 环境体检与冲突诊断抽屉 */}
      {doctorDrawerOpen && (
        <DoctorDrawer
          onClose={() => setDoctorDrawerOpen(false)}
        />
      )}

      {/* 操作执行结果弹窗 */}
      {resultModal && (
        <ActionResultModal
          state={resultModal}
          onClose={() => setResultModal(null)}
        />
      )}

      {/* ⌘K 全局搜索 */}
      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        onClose={() => setPaletteOpen(false)}
      />
    </main>
  );
}
