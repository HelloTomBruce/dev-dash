"use client";

import { useMemo } from "react";
import type { PaletteItem } from "@/components/command-palette";
import { DETAIL_PAGES } from "@/lib/actions/meta";
import type { ScanResult } from "@/lib/detectors/types";
import { INVENTORY_META, type InventoryMeta } from "@/lib/inventories/meta";
import type { PackageIndexEntry } from "./use-dashboard-scan";

interface PaletteArgs {
  data: ScanResult | null;
  packageIndex: PackageIndexEntry[];
  /** 跳转到工具详情页 */
  navigate: (path: string) => void;
  copy: (text: string) => void;
  openDrawer: (entry: InventoryMeta) => void;
  openPorts: () => void;
  openCleaner: () => void;
  openDoctor: () => void;
}

/** 构建 ⌘K 全局搜索面板条目（详情页 / 工具 / 清单 / 包索引 / 系统诊断） */
export function usePaletteItems({
  data,
  packageIndex,
  navigate,
  copy,
  openDrawer,
  openPorts,
  openCleaner,
  openDoctor,
}: PaletteArgs): PaletteItem[] {
  return useMemo<PaletteItem[]>(() => {
    if (!data) return [];
    const items: PaletteItem[] = [];
    const toolById = new Map(data.tools.map((t) => [t.id, t]));

    // 详情页
    for (const id of DETAIL_PAGES) {
      const t = toolById.get(id);
      if (t?.status === "ok") {
        items.push({
          id: `page:${id}`,
          label: `${t.name} 详情页`,
          sub: t.version ?? undefined,
          group: "详情页",
          action: () => navigate(`/tools/${id}`),
        });
      }
    }
    // 工具
    for (const t of data.tools) {
      if (t.status !== "ok") continue;
      const hasDetail = DETAIL_PAGES.includes(t.id);
      const invs = INVENTORY_META.filter((m) => m.toolId === t.id);
      items.push({
        id: `tool:${t.id}`,
        label: t.name,
        sub: t.version ?? undefined,
        group: "工具",
        action: () => {
          if (hasDetail) navigate(`/tools/${t.id}`);
          else if (invs.length > 0) openDrawer(invs[0]);
          else if (t.path) copy(t.path);
        },
      });
    }
    // 清单
    for (const inv of INVENTORY_META) {
      if (toolById.get(inv.toolId)?.status === "ok") {
        items.push({
          id: `inv:${inv.id}`,
          label: inv.label,
          group: "已装清单",
          action: () => openDrawer(inv),
        });
      }
    }
    // 包索引（预取的清单内容）
    for (const p of packageIndex) {
      items.push({
        id: `pkg:${p.toolId}:${p.name}`,
        label: p.name,
        sub: p.version ?? undefined,
        group: p.group,
        action: () => navigate(`/tools/${p.toolId}`),
      });
    }

    // 常用系统与诊断
    items.push({
      id: "sys:ports",
      label: "端口占用监控 (Port Inspector)",
      sub: "实时查看监听端口、开发服务与进程释放",
      group: "系统与诊断",
      action: openPorts,
    });
    items.push({
      id: "sys:cleaner",
      label: "开发磁盘清理助手 (Dev Cleaner)",
      sub: "扫描并一键清理包管理器临时下载与构建缓存",
      group: "系统与诊断",
      action: openCleaner,
    });
    items.push({
      id: "sys:doctor",
      label: "开发环境体检与冲突诊断 (Environment Doctor)",
      sub: "检测 PATH 优先级、多版本覆盖遮蔽与失效环境变量",
      group: "系统与诊断",
      action: openDoctor,
    });

    return items;
  }, [data, packageIndex, navigate, copy, openDrawer, openPorts, openCleaner, openDoctor]);
}
