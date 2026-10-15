"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult } from "@/lib/detectors/types";
import type { HealthCheckResult } from "@/lib/health/providers";

const AUTO_REFRESH_MS = 30_000;

/** 扫描完成后后台预取清单内容以构建包索引的规格（服务端有 60s 缓存，开销可控） */
const PACKAGE_INDEX_SPECS = [
  { id: "npm-global", toolId: "npm", group: "npm 全局包" },
  { id: "brew", toolId: "brew", group: "brew 软件包" },
  { id: "uv-tools", toolId: "uv", group: "uv 工具" },
  { id: "n-versions", toolId: "n", group: "Node 版本" },
];

export interface PackageIndexEntry {
  name: string;
  version: string | null;
  toolId: string;
  group: string;
}

/**
 * 仪表盘数据层：环境扫描 + 健康状态 + 自动刷新 + 包索引预取。
 * 从 app/page.tsx 抽离，使页面组件只负责布局与交互。
 */
export function useDashboardScan() {
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, HealthCheckResult>>({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [packageIndex, setPackageIndex] = useState<PackageIndexEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScan = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const [scanRes, healthRes] = await Promise.all([
        fetch(`/api/scan${force ? "?force=1" : ""}`),
        fetch(`/api/health${force ? "?force=1" : ""}`),
      ]);
      if (!scanRes.ok) throw new Error(`HTTP ${scanRes.status}`);
      const json: ScanResult = await scanRes.json();
      setData(json);
      if (healthRes.ok) {
        const hj: { results: HealthCheckResult[] } = await healthRes.json();
        setHealth(Object.fromEntries(hj.results.map((h) => [h.toolId, h])));
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // setTimeout 避免在 effect 体内同步 setState（react-hooks/set-state-in-effect）
    const t = setTimeout(() => fetchScan(true), 0);
    return () => clearTimeout(t);
  }, [fetchScan]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => fetchScan(false), AUTO_REFRESH_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchScan]);

  // 扫描完成后后台预取清单内容，构建包索引
  useEffect(() => {
    if (!data) return;
    const specs = PACKAGE_INDEX_SPECS.filter(
      (s) => data.tools.find((t) => t.id === s.toolId)?.status === "ok"
    );
    let cancelled = false;
    Promise.all(
      specs.map((s) =>
        fetch(`/api/inventory?id=${s.id}`)
          .then((r) => r.json())
          .then((j) =>
            ((j.items ?? []) as Array<{ name: string; version: string | null }>).map(
              (it): PackageIndexEntry => ({
                name: it.name,
                version: it.version,
                toolId: s.toolId,
                group: s.group,
              })
            )
          )
          .catch((): PackageIndexEntry[] => [])
      )
    ).then((all) => {
      if (!cancelled) setPackageIndex(all.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  return {
    data,
    loading,
    refreshing,
    error,
    health,
    autoRefresh,
    setAutoRefresh,
    packageIndex,
    fetchScan,
  };
}
