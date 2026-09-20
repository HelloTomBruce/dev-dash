# DevDash - 本地开发环境仪表盘

打开一个网页，一眼看清本机所有开发工具、版本、安装来源，以及各包管理器已装了什么。

## 快速开始

```bash
npm install
npm run dev                # 默认端口 3100
# 打开 http://localhost:3100
```

## 功能

### 工具探测（35 项）
- **运行时**：Node / Python / Go / Rust / Java / Bun / Deno
- **版本管理器**：n / nvm / pyenv / mise / asdf
- **包管理器**：npm / pnpm / yarn / pip / uv / pipx / cargo / gem / composer
- **容器**：Apple Container / Docker / Podman / Colima / kubectl
- **数据库**：PostgreSQL / MySQL / SQLite / Redis / MongoDB Shell
- **基础工具**：Git / Homebrew / gh / FFmpeg / Nginx

### 已装清单（点卡片上的 📋 按钮查看，支持搜索）
| 入口 | 命令 |
|------|------|
| npm 全局包 | `npm ls -g --depth=0 --json` |
| pnpm / yarn 全局包 | `pnpm ls -g` / `yarn global list` |
| pip 已装 Python 包 | `pip3 list --format=json` |
| uv 工具（含二进制名） | `uv tool list` |
| uv 管理的 Python | `uv python list --only-installed` |
| Homebrew 已装（formula + cask） | `brew list --versions` |
| cargo 已装 crate | `cargo install --list` |
| n 管理的 Node 版本 | `n ls` |
| nvm / pyenv 版本列表 | `nvm ls` / `pyenv versions` |

### 服务健康检查（P3）
对已安装的服务型工具自动检测运行状态，卡片显示 🟢运行中 / 🔴已停止 徽章，概览条统计“服务运行中”数量：

| 工具 | 检查方式 |
|------|---------|
| PostgreSQL | `pg_isready` |
| Redis | `redis-cli ping` |
| MySQL / MongoDB | 端口探测（3306 / 27017） |
| Docker | `docker info` |
| Apple Container | `container system status` |

新增健康检查 = `lib/health/providers.ts` 里加一条 `toolId: () => cmdCheck(...)` 或 `portCheck(...)`。

### 管理操作（P3+）
每张已安装工具的卡片右上角有 **⋯ 操作菜单**，包含：

**通用操作**（所有工具）：复制版本号 / 复制路径 / 打开所在目录

**工具专属操作**：

| 工具 | 操作 |
|------|------|
| Node.js | 检查全局过期包 · 安装 LTS/latest（n）· 清理旧版本（dangerous） |
| npm / pnpm | 检查全局过期包 · 升级所有全局包 |
| pip | 检查过期包 |
| uv | 升级所有 uv 工具 · brew 升级 |
| Rust | rustup update |
| Homebrew | 过期列表 · doctor 体检 · update · 全量升级 · 清理缓存 |
| brew 安装的工具 | brew upgrade 升级自身（go/python@3.14/postgresql@17/redis/git/gh/ffmpeg/uv/container） |
| RubyGems | gem update --system |
| PostgreSQL / Redis / MySQL / Apple Container | 卡片上的 ▶启动/■停止 按钮 |

**信息类操作**（safe）在弹窗中展示命令与完整输出；**变更类**（careful）需确认，执行后自动强制刷新。

安全模型：
- **白名单动作**：`POST /api/action` 只执行 `lib/actions/registry.ts` 注册的固定命令模板，参数严格校验（白名单/路径校验），不接受任意命令字符串
- **来源限制**：只允许 localhost 调用
- **动作分级**：safe（直接执行）→ careful（弹确认）→ dangerous（加强确认）
- **退出码容错**：`npm outdated`/`brew doctor` 等发现问题时 exit≠0 但有有效输出，按 ok 处理

新增操作 = `meta.ts` 注册元数据（+ 挂到 `TOOL_ACTIONS`）+ `registry.ts` 实现执行器。

### 工具详情页（P5 进行中）
卡片上带 ↗ 的工具名可点击进入专属详情页：

| 路由 | 内容 |
|------|------|
| `/tools/n` | Node 版本管理：当前激活版本、已装版本列表（含磁盘占用）、设为默认 / 删除 / 安装新版本（快捷版本来自 nodejs.org，带 LTS 标记 + 自定义输入）、目录可写性检测（sudo 提示） |
| `/tools/psql` | PostgreSQL：服务状态 + 启停/重启、端口 / 数据目录 / 活动连接、数据库列表（大小/属主/连接数）+ 新建/删除（系统库保护）+ 复制连接串、角色列表（过滤内置 pg_* 角色） |
| `/tools/redis` | Redis：服务状态 + 启停/重启、端口/模式/运行时长/内存峰值/连接数、Keyspace 分 db 展示（key 数/过期数）+ key 样例（类型/TTL）+ 删除 key + FLUSHDB（dangerous） |
| `/tools/brew` | Homebrew：formula/cask 清单（主装/依赖标记）、过期包专区（当前→最新 + 单包/全量升级）、Cellar/缓存占用（懒加载）、brew update/cleanup、单包卸载（dangerous） |

其他工具访问 `/tools/<id>` 显示通用兜底页。新增详情页 = `app/api/tools/<id>/route.ts`（数据接口）+ `components/panels/<id>-panel.tsx`（面板组件）+ `DETAIL_PAGES` 注册 id。面板通用件在 `components/panels/shared.tsx`（useActionRunner / InfoCard / PanelButton）。

### 其他
- 来源识别：brew / nvm / pyenv / rustup / npm-global / system / manual…
- 版本展示 + 一键复制路径，清单列表点击复制 `name@version`
- 扫描缓存 60s（缓存命中 < 5ms），清单按需加载 + 60s 缓存，支持手动强制刷新

## 架构

```
浏览器 (app/page.tsx)
  ├─ GET /api/scan?force=1        全量工具扫描（并行 + 60s 缓存）
  │    └─ lib/scan.ts → lib/detectors/registry.ts
  │         └─ 每个工具一个 Detector（commandDetector 工厂 / 自定义）
  └─ GET /api/inventory?id=npm-global   已装清单（按需 + 60s 缓存）
       └─ lib/inventories/providers.ts
```

### 添加新工具

`lib/detectors/` 对应分类文件里加一个 `commandDetector({...})`：

```ts
commandDetector({
  id: "docker",
  name: "Docker",
  category: "container",
  binaries: ["docker"],
  parseVersion: (out) => out.match(/Docker version (\S+)/)?.[1] ?? null,
}),
```

### 添加新清单

1. `lib/inventories/meta.ts` 注册 `{ id, label, toolId, entryLabel }`
2. `lib/inventories/providers.ts` 实现 `list()` 并挂到 `inventoryProviders[id]`

### 关键设计

- **登录 shell PATH 预取**（`lib/detectors/utils/shell.ts`）：Node 服务端 exec 默认 PATH 找不到 nvm/pyenv 装的工具，启动时通过 `zsh -ilc` 预取用户 PATH 并缓存
- **nvm 是 shell 函数**：需 `zsh -ilc` 交互式登录 shell 检测（`lib/detectors/version-managers.ts`）
- **未安装 ≠ 错误**：`command -v` 失败返回 `not-found`（灰显），命令存在但解析失败才是 `error`（红显）
- **永不阻塞**：所有命令带超时 + `Promise.allSettled`，单个工具卡死不影响全局

## Roadmap

- [x] P2a：版本管理器多版本列表（n / nvm / pyenv / uv python）
- [x] P2b：包管理器已装清单（npm / pnpm / yarn / pip / uv / brew / cargo）
- [x] P3：服务健康检查 + 启停管理（brew services / container system）
- [x] P4：每工具操作菜单（通用 + 专属操作、结果弹窗、分级确认）
- [x] P5a：n 专属详情页（版本管理 / 安装 / 切换 / 删除 / 磁盘占用）
- [x] P5b：PostgreSQL 专属详情页（服务管理 / 数据库列表 / 建删库 / 角色）
- [x] P5c：Redis 专属详情页（Keyspace 浏览 / 删除 key / FLUSHDB / 内存与连接统计）
- [x] P5d：brew 专属详情页（清单 / 过期高亮 / 单包升级卸载 / 动态白名单）
- [ ] P6：更多工具详情页（npm / container…）、长任务异步化、⌘K 搜索、版本过期徽章、JSON 导出
