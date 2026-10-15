<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# DevDash AI 协同开发规约：代码与 DocMind 产品文档双向维护

本项目已接入 **DocMind 知识工作台**（结构化 PRD 思维导图与文档系统）。
在任何功能迭代、Bug 修复或架构演进过程中，**代码与 DocMind 中的产品文档必须同步维护**。

## 1. DocMind 基础设施信息
- **MCP 服务**：`DocMind`（SSE: `http://127.0.0.1:6001/sse`）
- **项目定位**：完全通过 DocMind MCP 接口操作维护，无需关注或记录本地具体路径；如需确保当前项目上下文，可直接调用 `activate_project(name: "dev-dash")`。
- **核心工具集**：
  - `get_requirements_tree`：获取完整需求模块树与节点 ID
  - `get_requirement_detail`：读取特定节点的 Markdown 详细规格
  - `search_requirements`：按关键词检索已有需求定义
  - `update_requirement_status`：更新节点状态（`draft` / `todo` / `in_progress` / `completed`）
  - `add_node` / `expand_node_outline`：新增需求子节点与骨架
  - `update_node`：更新节点标题、元数据及 Markdown 详细内容

## 2. 迭代协同标准工作流 (AI 必须严格执行)

### 阶段一：任务开始（需求对齐与状态流转）
1. **查看需求规格**：
   - 当接收到功能开发、优化或 Bug 修复任务时，先调用 `search_requirements` 或 `get_requirement_detail` 查阅对应功能在 DocMind 中的设计规范与业务定位。
   - 若用户提出了未在 PRD 中记录的新模块/新面板，在对应父节点下调用 `add_node` 创建需求节点，并写入初始规格草案。
2. **变更状态为进行中**：
   - 确认目标节点后，调用 `update_requirement_status(node_id, "in_progress")`。

### 阶段二：代码实现
- 遵循项目的核心工程设计：
  - 纯净 Shell PATH 隔离（`env -i zsh -ilc`）；
  - 严格命令白名单（`lib/actions/registry.ts`，禁止动态命令拼接）；
  - 操作安全分级（`safe` / `careful` / `dangerous`）；
  - 探测操作非阻塞超时保护（`Promise.allSettled`）。

### 阶段三：交付闭环（文档同步与状态闭环）
1. **同步更新产品文档**：
   - 编码完成后，若涉及**新增操作、接口路由变更、配置项扩展、界面交互逻辑变化或新增依赖**，必须同时调用 `update_node` 将最新实现细节同步更新至 DocMind 对应的 Markdown 文档中。
   - 严禁“只改代码不改 PRD”导致文档漂移。
2. **变更状态为已完成**：
   - 调用 `update_requirement_status(node_id, "completed")`。
3. **交付报告输出**：
   - 在向用户汇报完成情况时，明确列出：
     - 修改的代码文件清单；
     - 同步更新的 DocMind PRD 节点名称与对应修改内容。
