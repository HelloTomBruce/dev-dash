export type Category =
  | "runtime"
  | "version-manager"
  | "package-manager"
  | "container"
  | "database"
  | "base-tool";

export const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; order: number }
> = {
  runtime: { label: "语言运行时", icon: "⚡", order: 1 },
  "version-manager": { label: "版本管理器", icon: "🧭", order: 2 },
  "package-manager": { label: "包管理器", icon: "📦", order: 3 },
  container: { label: "容器", icon: "🐳", order: 4 },
  database: { label: "数据库", icon: "🗄️", order: 5 },
  "base-tool": { label: "基础工具", icon: "🔧", order: 6 },
};

export type ToolStatus = "ok" | "not-found" | "error";

export interface OutdatedInfo {
  current: string;
  latest: string;
}

export interface ToolResult {
  id: string;
  name: string;
  category: Category;
  status: ToolStatus;
  /** 解析后的版本号，如 "22.11.0"；未安装为 null */
  version: string | null;
  /** 可执行文件路径 */
  path: string | null;
  /** 安装来源：nvm / pyenv / rustup / brew / system / manual 等 */
  source: string | null;
  /** 原始版本输出（调试用） */
  raw: string | null;
  /** status === "error" 时的错误信息 */
  error: string | null;
  durationMs: number;
  /** 过期检查结果（仅对支持的工具有值） */
  outdated: OutdatedInfo | null;
}

export interface ScanSummary {
  installed: number;
  notFound: number;
  errors: number;
  total: number;
}

export interface ScanResult {
  scannedAt: string;
  durationMs: number;
  summary: ScanSummary;
  tools: ToolResult[];
}

export interface Detector {
  id: string;
  name: string;
  category: Category;
  /** 执行探测，返回结果（未安装也要正常返回，不抛异常） */
  detect(): Promise<Omit<ToolResult, "durationMs">>;
}
