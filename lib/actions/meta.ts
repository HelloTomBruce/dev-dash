/**
 * 动作元数据 —— 纯数据，客户端可直接导入。
 * 执行实现在 registry.ts（仅服务端）。
 */
export type ActionLevel = "safe" | "careful" | "dangerous";

export interface ActionMeta {
  id: string;
  label: string;
  level: ActionLevel;
}

export const ACTION_META: Record<string, ActionMeta> = {
  // 服务启停
  "brew.services.start": { id: "brew.services.start", label: "启动服务", level: "safe" },
  "brew.services.stop": { id: "brew.services.stop", label: "停止服务", level: "safe" },
  "brew.services.restart": { id: "brew.services.restart", label: "重启服务", level: "safe" },
  "container.system.start": { id: "container.system.start", label: "启动容器系统", level: "safe" },
  "container.system.stop": { id: "container.system.stop", label: "停止容器系统", level: "safe" },
  "container.prune": { id: "container.prune", label: "清理已停止容器", level: "careful" },
  "container.start-one": { id: "container.start-one", label: "启动容器", level: "careful" },
  "container.stop-one": { id: "container.stop-one", label: "停止容器", level: "careful" },
  "container.rm": { id: "container.rm", label: "删除容器", level: "dangerous" },
  "container.image-rm": { id: "container.image-rm", label: "删除镜像", level: "dangerous" },
  // 通用
  "tool.open-dir": { id: "tool.open-dir", label: "打开所在目录", level: "safe" },
  // brew
  "brew.update": { id: "brew.update", label: "brew update", level: "careful" },
  "brew.upgrade-all": { id: "brew.upgrade-all", label: "升级所有 formula", level: "careful" },
  "brew.upgrade": { id: "brew.upgrade", label: "brew upgrade", level: "careful" },
  "brew.upgrade-cask": { id: "brew.upgrade-cask", label: "brew upgrade --cask", level: "careful" },
  "brew.uninstall": { id: "brew.uninstall", label: "卸载软件包", level: "dangerous" },
  "brew.cleanup": { id: "brew.cleanup", label: "清理旧版本缓存", level: "careful" },
  "brew.doctor": { id: "brew.doctor", label: "brew doctor 体检", level: "safe" },
  "brew.outdated": { id: "brew.outdated", label: "查看过期包", level: "safe" },
  // node / n
  "npm.outdated": { id: "npm.outdated", label: "检查全局过期包", level: "safe" },
  "npm.update-g-all": { id: "npm.update-g-all", label: "升级所有全局包", level: "careful" },
  "npm.install-g": { id: "npm.install-g", label: "安装全局包", level: "careful" },
  "npm.update-g": { id: "npm.update-g", label: "升级全局包", level: "careful" },
  "npm.uninstall-g": { id: "npm.uninstall-g", label: "卸载全局包", level: "dangerous" },
  "n.install-lts": { id: "n.install-lts", label: "安装 Node LTS", level: "careful" },
  "n.install-latest": { id: "n.install-latest", label: "安装 Node latest", level: "careful" },
  "n.prune": { id: "n.prune", label: "清理旧 Node 版本", level: "dangerous" },
  "n.install-version": { id: "n.install-version", label: "安装指定版本", level: "careful" },
  "n.use": { id: "n.use", label: "设为默认版本", level: "careful" },
  "n.rm": { id: "n.rm", label: "删除版本", level: "dangerous" },
  // postgres
  "pg.createdb": { id: "pg.createdb", label: "新建数据库", level: "careful" },
  "pg.dropdb": { id: "pg.dropdb", label: "删除数据库", level: "dangerous" },
  // redis
  "redis.del-key": { id: "redis.del-key", label: "删除 key", level: "careful" },
  "redis.flushdb": { id: "redis.flushdb", label: "清空数据库（FLUSHDB）", level: "dangerous" },
  // pnpm
  "pnpm.outdated": { id: "pnpm.outdated", label: "检查全局过期包", level: "safe" },
  "pnpm.update-g-all": { id: "pnpm.update-g-all", label: "升级所有全局包", level: "careful" },
  "pnpm.install-g": { id: "pnpm.install-g", label: "安装全局包", level: "careful" },
  "pnpm.update-g": { id: "pnpm.update-g", label: "升级全局包", level: "careful" },
  "pnpm.uninstall-g": { id: "pnpm.uninstall-g", label: "卸载全局包", level: "dangerous" },
  "pnpm.store-prune": { id: "pnpm.store-prune", label: "清理 store 无引用内容", level: "careful" },
  // pip
  "pip.outdated": { id: "pip.outdated", label: "检查过期包", level: "safe" },
  // uv
  "uv.tool-upgrade-all": { id: "uv.tool-upgrade-all", label: "升级所有 uv 工具", level: "careful" },
  "uv.tool-upgrade": { id: "uv.tool-upgrade", label: "升级 uv 工具", level: "careful" },
  "uv.tool-uninstall": { id: "uv.tool-uninstall", label: "卸载 uv 工具", level: "dangerous" },
  "uv.tool-install": { id: "uv.tool-install", label: "安装 uv 工具", level: "careful" },
  "uv.python-install": { id: "uv.python-install", label: "安装 Python", level: "careful" },
  "uv.python-uninstall": { id: "uv.python-uninstall", label: "卸载 Python", level: "dangerous" },
  // rust
  "rustup.update": { id: "rustup.update", label: "rustup update", level: "careful" },
  // rubygems
  "gem.update-system": { id: "gem.update-system", label: "gem update --system", level: "careful" },
  // nginx
  "nginx.test": { id: "nginx.test", label: "测试配置语法 (nginx -t)", level: "safe" },
  "nginx.reload": { id: "nginx.reload", label: "重新加载配置 (nginx -s reload)", level: "careful" },
  "nginx.save-conf": { id: "nginx.save-conf", label: "保存配置文件", level: "careful" },
  // vscode
  "vscode.open": { id: "vscode.open", label: "启动 VS Code", level: "safe" },
  "vscode.quit": { id: "vscode.quit", label: "退出 VS Code", level: "careful" },
  "vscode.restart": { id: "vscode.restart", label: "重启 VS Code", level: "careful" },
  "vscode.status": { id: "vscode.status", label: "进程状态与诊断 (code --status)", level: "safe" },
  "vscode.install-extension": { id: "vscode.install-extension", label: "安装扩展插件", level: "careful" },
  "vscode.uninstall-extension": { id: "vscode.uninstall-extension", label: "卸载扩展插件", level: "dangerous" },
  "vscode.save-settings": { id: "vscode.save-settings", label: "保存 settings.json", level: "careful" },
};

export interface ServiceActionRef {
  actionId: string;
  params?: Record<string, string>;
}

/** 工具 id → 启停动作映射（卡片上显示按钮用） */
export const SERVICE_ACTIONS: Record<
  string,
  { start: ServiceActionRef; stop: ServiceActionRef }
> = {
  psql: {
    start: { actionId: "brew.services.start", params: { formula: "postgresql@17" } },
    stop: { actionId: "brew.services.stop", params: { formula: "postgresql@17" } },
  },
  redis: {
    start: { actionId: "brew.services.start", params: { formula: "redis" } },
    stop: { actionId: "brew.services.stop", params: { formula: "redis" } },
  },
  mysql: {
    start: { actionId: "brew.services.start", params: { formula: "mysql" } },
    stop: { actionId: "brew.services.stop", params: { formula: "mysql" } },
  },
  nginx: {
    start: { actionId: "brew.services.start", params: { formula: "nginx" } },
    stop: { actionId: "brew.services.stop", params: { formula: "nginx" } },
  },
  vscode: {
    start: { actionId: "vscode.open" },
    stop: { actionId: "vscode.quit" },
  },
  "apple-container": {
    start: { actionId: "container.system.start" },
    stop: { actionId: "container.system.stop" },
  },
};

/** 拥有专属详情页的工具 */
export const DETAIL_PAGES: string[] = ["n", "psql", "redis", "brew", "npm", "uv", "pnpm", "apple-container", "gh", "nginx", "vscode"];

/** 卡片操作菜单中的一项 */
export interface ToolActionDef {
  key: string;
  label: string;
  level: ActionLevel;
  /** 服务端动作 id；clientAction 存在时走纯前端逻辑 */
  actionId?: string;
  params?: Record<string, string>;
  /** 纯前端操作 */
  clientAction?: "copy-version" | "copy-path";
  /** 执行后在弹窗中展示完整输出（信息查询类） */
  showOutput?: boolean;
  /** 变更类操作：成功后强制刷新扫描 */
  refreshAfter?: boolean;
}

/** brew formula 名（用于生成「升级」操作） */
const BREW_FORMULA: Record<string, string> = {
  python: "python@3.14",
  go: "go",
  psql: "postgresql@17",
  redis: "redis",
  git: "git",
  gh: "gh",
  ffmpeg: "ffmpeg",
  uv: "uv",
  "apple-container": "container",
  nginx: "nginx",
};

function brewUpgradeDef(toolId: string): ToolActionDef {
  return {
    key: `${toolId}.brew-upgrade`,
    label: `升级（brew upgrade ${BREW_FORMULA[toolId]}）`,
    level: "careful",
    actionId: "brew.upgrade",
    params: { formula: BREW_FORMULA[toolId] },
    refreshAfter: true,
  };
}

/** 每个工具的操作菜单 */
export const TOOL_ACTIONS: Record<string, ToolActionDef[]> = {
  node: [
    { key: "node.npm-outdated", label: "检查 npm 全局过期包", level: "safe", actionId: "npm.outdated", showOutput: true },
    { key: "node.install-lts", label: "安装 Node LTS（n）", level: "careful", actionId: "n.install-lts", refreshAfter: true },
    { key: "node.install-latest", label: "安装 Node latest（n）", level: "careful", actionId: "n.install-latest", refreshAfter: true },
    { key: "node.n-prune", label: "清理旧 Node 版本（n prune）", level: "dangerous", actionId: "n.prune", refreshAfter: true },
  ],
  npm: [
    { key: "npm.outdated", label: "检查全局过期包", level: "safe", actionId: "npm.outdated", showOutput: true },
    { key: "npm.update-g-all", label: "升级所有全局包", level: "careful", actionId: "npm.update-g-all", refreshAfter: true },
  ],
  pnpm: [
    { key: "pnpm.outdated", label: "检查全局过期包", level: "safe", actionId: "pnpm.outdated", showOutput: true },
    { key: "pnpm.update-g-all", label: "升级所有全局包", level: "careful", actionId: "pnpm.update-g-all", refreshAfter: true },
  ],
  pip: [
    { key: "pip.outdated", label: "检查过期包", level: "safe", actionId: "pip.outdated", showOutput: true },
  ],
  uv: [
    { key: "uv.tool-upgrade-all", label: "升级所有 uv 工具", level: "careful", actionId: "uv.tool-upgrade-all", refreshAfter: true },
    brewUpgradeDef("uv"),
  ],
  cargo: [],
  rust: [
    { key: "rust.rustup-update", label: "rustup update", level: "careful", actionId: "rustup.update", refreshAfter: true },
  ],
  gem: [
    { key: "gem.update-system", label: "gem update --system", level: "careful", actionId: "gem.update-system", refreshAfter: true },
  ],
  brew: [
    { key: "brew.outdated", label: "查看过期包", level: "safe", actionId: "brew.outdated", showOutput: true },
    { key: "brew.doctor", label: "brew doctor 体检", level: "safe", actionId: "brew.doctor", showOutput: true },
    { key: "brew.update", label: "brew update", level: "careful", actionId: "brew.update", refreshAfter: true },
    { key: "brew.upgrade-all", label: "升级所有 formula", level: "careful", actionId: "brew.upgrade-all", refreshAfter: true },
    { key: "brew.cleanup", label: "清理旧版本缓存", level: "careful", actionId: "brew.cleanup" },
  ],
  nginx: [
    { key: "nginx.test", label: "测试配置 (nginx -t)", level: "safe", actionId: "nginx.test", showOutput: true },
    { key: "nginx.reload", label: "重载配置 (nginx -s reload)", level: "careful", actionId: "nginx.reload", refreshAfter: true },
    brewUpgradeDef("nginx"),
  ],
  vscode: [
    { key: "vscode.open", label: "启动 VS Code", level: "safe", actionId: "vscode.open", refreshAfter: true },
    { key: "vscode.status", label: "进程诊断 (code --status)", level: "safe", actionId: "vscode.status", showOutput: true },
    { key: "vscode.restart", label: "重启 VS Code", level: "careful", actionId: "vscode.restart", refreshAfter: true },
  ],
  python: [brewUpgradeDef("python")],
  go: [brewUpgradeDef("go")],
  psql: [brewUpgradeDef("psql")],
  redis: [brewUpgradeDef("redis")],
  git: [brewUpgradeDef("git")],
  gh: [brewUpgradeDef("gh")],
  ffmpeg: [brewUpgradeDef("ffmpeg")],
  "apple-container": [brewUpgradeDef("apple-container")],
};

/** 所有已安装工具都有的通用操作 */
export const COMMON_ACTIONS: ToolActionDef[] = [
  { key: "common.copy-version", label: "复制版本号", level: "safe", clientAction: "copy-version" },
  { key: "common.copy-path", label: "复制路径", level: "safe", clientAction: "copy-path" },
  { key: "common.open-dir", label: "打开所在目录", level: "safe", actionId: "tool.open-dir" },
];
