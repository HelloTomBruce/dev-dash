# GitHub CLI 详情页设计（/tools/gh）

日期：2026-09-20
状态：已获用户批准，待审查规格
方案：B —— 独立 GitHub 子系统（不复用 /api/action 与 useActionRunner）

## 1. 目标与范围

把 gh 从"被检测的基础工具"升级为完整详情页，两大子系统共存于 `/tools/gh`：

- **本机概览**（机器维度）：版本、登录态、扩展、API 配额
- **仓库工作台**（仓库维度）：我的跨仓库状态、单仓库 PR / issue / CI runs、GitHub 搜索

视角为**混合模式**：默认"我的"跨仓库视图；选中仓库后切换到该仓库的 PR / issue / CI / 搜索上下文。

写操作做到**完整操作级**：merge PR、review（approve / request-changes）、评论、close / reopen、CI rerun / cancel。

### 明确不做（YAGNI）

- 新建 issue / PR（需标题正文表单，属另一个功能）
- 编辑标签 / assignee / 仓库设置
- 复用现有 `lib/actions/registry.ts`（gh 子系统自建白名单，见 §3）

## 2. 架构总览

```
lib/gh/
  runner.ts     # runGh(args: string[], timeoutMs) — 参数数组 → zsh 安全转义 → 复用 run()
  parse.ts      # gh auth status / gh status / gh pr status 文本输出解析
  queries.ts    # 4 类只读查询（overview / repos / repo / search）
  actions.ts    # 写操作执行器白名单 + 校验器
app/api/gh/
  overview/route.ts   # GET  本机概览
  repos/route.ts      # GET  仓库选择器（30 秒内存缓存）
  repo/route.ts       # GET  ?repo=o/n → PR + issue + runs 聚合
  search/route.ts     # GET  ?q=&type=repos|issues|prs|code|commits
  action/route.ts     # POST 受控写操作（独立白名单 + localhost 校验）
components/panels/gh/
  gh-panel.tsx        # 容器：登录态守卫 + 视图切换
  overview.tsx        # 版本 / 账号 / 扩展 / 配额
  mine.tsx            # 我的 status + pr status
  repo-view.tsx       # 仓库工作台（PR / Issues / Runs）
  search-view.tsx     # 搜索
  action-runner.ts    # useGhActionRunner（POST /api/gh/action，复用 ActionResultModal）
```

改动既有文件仅 2 处：

- `app/tools/[id]/page.tsx`：加 `if (id === "gh") return <GhPanel />;`
- `lib/actions/meta.ts`：`DETAIL_PAGES` 数组加 `"gh"`

## 3. 服务端核心：参数数组化转义

现有 `run()`（`lib/detectors/utils/shell.ts`）是 zsh 字符串插值执行，既有校验器全部是"字符集白名单"模式。gh 子系统的 `runGh()` 改为**参数数组 + 单引号转义**：

- 每个参数包 zsh 单引号，内部 `'` 替换为 `'"'"'`
- 数组 join 后交给现有 `run()` 执行（沿用其登录 PATH 预取与超时）
- 自由文本参数（评论正文）只需长度上限 4000 字符，不再限字符集

该模式只在 gh 子系统内使用，不改 `lib/actions/registry.ts` 的既有校验器。

## 4. 数据路由（GET）

### 4.1 GET /api/gh/overview

并行执行，返回：

- `gh version` → `version`
- `gh auth status`（parse.ts 解析）→ `auth: { loggedIn, account, source, scopes, tokenExpired }`；未登录时其余命令跳过，返回 `error: "auth"`
- `gh extension list` → `extensions: [{ name, version }]`
- `gh api rate_limit` → `rateLimit: { remaining, limit, resetAt }`

### 4.2 GET /api/gh/repos

`gh api user/repos?sort=pushed&per_page=30&affiliation=owner,collaborator,organization_member`

返回 `repos: [{ fullName, pushedAt, isPrivate, isFork }]`。30 秒进程内缓存。

### 4.3 GET /api/gh/repo?repo=owner/name

校验 repo 参数（同 §5 正则），并行执行 4 条查询，各自失败降级为该项的 `error` 字段：

- `gh repo view` → 仓库信息（默认分支、star 数）
- `gh pr list --state open` → PR 列表（number、title、author、isDraft、mergeable、reviewDecision、checks 汇总、updatedAt、url）
- `gh issue list --state open` → issue 列表（number、title、author、labels、assignees、updatedAt、url）
- `gh run list --limit 20` → runs（databaseId、workflowName、displayTitle、status、conclusion、headBranch、event、createdAt、url）

单命令超时 15 秒。

### 4.4 GET /api/gh/search?q=&type=

`type ∈ {repos, issues, prs, code, commits}`（枚举校验），映射到对应 `gh search` 子命令，`--limit 20`，返回该 type 的 JSON 字段子集。超时 20 秒（code search 较慢）。命中 GitHub 速率限制时返回 `{ error: "rate-limit", resetAt }`。

## 5. 写操作（POST /api/gh/action）

安全模型与 `/api/action` 对齐但独立：仅 localhost Host、白名单 actionId、参数严格校验、业务失败以 `ok` 字段表达。

| actionId | 参数 | 校验 | 级别 |
|---|---|---|---|
| `gh.pr.merge` | repo, number, method, deleteBranch | repo: `^[\w-]+/[\w._-]+$`；number: 正整数 ≤ 10 位；method ∈ {merge, squash, rebase}；deleteBranch ∈ {"", "1"} | dangerous |
| `gh.pr.review` | repo, number, event, body? | event ∈ {approve, request-changes}；request-changes 时 body 必填 | careful |
| `gh.pr.comment` / `gh.issue.comment` | repo, number, body | body ≤ 4000 字符 | careful |
| `gh.pr.close` / `gh.pr.reopen` / `gh.issue.close` / `gh.issue.reopen` | repo, number | 同上 | careful |
| `gh.run.rerun` | repo, runId, failedOnly | runId 正整数；failedOnly ∈ {"", "1"} | careful |
| `gh.run.cancel` | repo, runId | 同上 | careful |

执行通过 `runGh()` 参数数组拼装（如 `["pr", "merge", n, "--repo", repo, "--squash", "--delete-branch"]`），不拼接参数字符串。

确认交互：前端 `useGhActionRunner` 沿用三级确认语义——safe 直接执行，careful `window.confirm`，dangerous 红色警示文案 `window.confirm`；结果复用 `components/action-result-modal.tsx` 的 `ActionResultModal`。

## 6. UI 结构（单页 /tools/gh，max-w-5xl）

- **未登录守卫**：overview 返回 `error: "auth"` 时整页引导（说明 `gh auth login` 需交互式终端，须用户自行执行），不渲染其余视图
- **顶部 header**：← 返回仪表盘、版本、账号 badge、API 配额（remaining/limit）、刷新按钮
- **Tab 视图**：
  - **我的**（默认）：`gh status`（mentions / review requests / assignments）+ `gh pr status`（NeedsAction / InReview 分组），每条显示仓库名 + 跳转 GitHub 链接
  - **仓库**：repo picker（最近 push 30 个，文本过滤）→ 选中后子 tab：
    - **PR**：标题、作者、checks 状态灯、mergeable；行内 approve / merge（选方式）/ close
    - **Issues**：行内 close / reopen / 评论
    - **Actions**：runs 列表（conclusion 图标）、行内 rerun / cancel、**15 秒自动轮询**（离开 tab 停止）
  - **搜索**：type 下拉 + 关键词输入，结果 20 条，带 GitHub 链接
  - **概览**：扩展列表、gh config、配额条
- 写操作成功后局部刷新当前视图

## 7. 错误与边界

- token 过期 / 403 → 路由返回 `{ error: "auth" }`，前端顶部黄条提示
- 搜索命中 GitHub 速率限制 → 显示剩余重置时间
- 聚合路由（§4.3）单项失败降级：该项返回 `error` 字段，其余项正常渲染

## 8. 验证

项目无测试框架，本功能不引入。验证手段：

- `npm run lint`、`npm run build` 逐层把关
- 校验器（repo / number / body / method 枚举）是注入风险集中点，用 `node -e` 跑边界用例（含注入尝试字符串）验证
- 浏览器实测（chrome-devtools）：登录态守卫、我的视图、仓库三栏、merge 完整流程（含 dangerous 确认）、五类搜索

## 9. 分期实现

1. **P1 骨架**：runner + parse + overview 路由 + gh-panel 壳 + 登录守卫 + page.tsx / DETAIL_PAGES 接线
2. **P2 我的视图**：mine 查询（并入 overview 或独立 mine 路由）+ mine.tsx
3. **P3 仓库工作台**：repos / repo 路由 + repo-view（PR / Issues / Runs + 轮询）
4. **P4 搜索**：search 路由 + search-view
5. **P5 写操作**：actions.ts + /api/gh/action + 行内按钮 + 确认流
6. **P6 收尾**：概览 tab、错误条、build + 浏览器实测

P2 说明：`gh status` 与 `gh pr status` 数据挂在 overview 路由返回中（同为"我的"维度），mine.tsx 只读 overview 数据中的对应字段，不新增路由。
