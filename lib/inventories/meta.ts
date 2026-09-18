/**
 * 已装清单元数据 —— 纯数据，客户端可直接导入。
 * 实际执行逻辑在 providers.ts（仅服务端）。
 */
export interface InventoryMeta {
  id: string;
  /** 显示名称 */
  label: string;
  /** 关联的工具 id（tool.status === "ok" 时才显示入口） */
  toolId: string;
  /** 卡片上的入口按钮文字 */
  entryLabel: string;
}

export interface InventoryItem {
  name: string;
  version: string | null;
  /** 附加说明（二进制名 / 路径 / 当前标记等） */
  note?: string | null;
}

export interface InventoryResult {
  id: string;
  label: string;
  items: InventoryItem[];
  error: string | null;
  durationMs: number;
}

export const INVENTORY_META: InventoryMeta[] = [
  { id: "npm-global", label: "npm 全局包", toolId: "npm", entryLabel: "全局包" },
  { id: "pnpm-global", label: "pnpm 全局包", toolId: "pnpm", entryLabel: "全局包" },
  { id: "yarn-global", label: "yarn 全局包", toolId: "yarn", entryLabel: "全局包" },
  { id: "pip", label: "pip 已装的 Python 包", toolId: "pip", entryLabel: "Python 包" },
  { id: "uv-tools", label: "uv 工具", toolId: "uv", entryLabel: "uv 工具" },
  { id: "uv-python", label: "uv 管理的 Python", toolId: "uv", entryLabel: "Python 版本" },
  { id: "brew", label: "Homebrew 已装", toolId: "brew", entryLabel: "brew 清单" },
  { id: "cargo", label: "cargo install 的 crate", toolId: "cargo", entryLabel: "crate" },
  { id: "n-versions", label: "n 管理的 Node 版本", toolId: "n", entryLabel: "Node 版本" },
  { id: "nvm-versions", label: "nvm 管理的版本", toolId: "nvm", entryLabel: "版本列表" },
  { id: "pyenv-versions", label: "pyenv 管理的 Python", toolId: "pyenv", entryLabel: "Python 版本" },
];
