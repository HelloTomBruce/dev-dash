import type { GhActionLevel } from "./types";

/** gh 写动作元数据 —— 纯数据，客户端可安全 import */
export const GH_ACTION_META: Record<string, { label: string; level: GhActionLevel }> = {
  "gh.pr.merge": { label: "合并 PR", level: "dangerous" },
  "gh.pr.review": { label: "提交 review", level: "careful" },
  "gh.pr.comment": { label: "评论 PR", level: "careful" },
  "gh.issue.comment": { label: "评论 issue", level: "careful" },
  "gh.pr.close": { label: "关闭 PR", level: "careful" },
  "gh.pr.reopen": { label: "重新打开 PR", level: "careful" },
  "gh.issue.close": { label: "关闭 issue", level: "careful" },
  "gh.issue.reopen": { label: "重新打开 issue", level: "careful" },
  "gh.run.rerun": { label: "重跑 workflow", level: "careful" },
  "gh.run.cancel": { label: "取消 workflow", level: "careful" },
};
