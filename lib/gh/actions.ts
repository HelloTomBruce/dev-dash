import { runGh, zshQuote } from "./runner";
import {
  validateBody,
  validateFlag,
  validateMergeMethod,
  validateNumber,
  validateRepo,
  validateReviewEvent,
  validateRunId,
} from "./validate";
import type { GhActionResult } from "./types";

type Params = Record<string, string> | undefined;
type Executor = (params: Params) => Promise<GhActionResult>;

async function exec(actionId: string, args: string[], timeoutMs = 60000): Promise<GhActionResult> {
  const start = Date.now();
  const res = await runGh(args, timeoutMs);
  const output = (res.stdout + (res.stderr ? `\n${res.stderr}` : "")).trim().slice(0, 8000);
  return {
    ok: res.ok,
    actionId,
    // 审计用命令还原转义后的实际执行内容
    command: ["gh", ...args.map(zshQuote)].join(" "),
    output,
    error: res.ok ? null : output || "执行失败",
    durationMs: Date.now() - start,
  };
}

/** gh 写动作执行器白名单 —— 只允许此处注册的固定动作，参数经 validate.ts 校验 */
export const ghActionExecutors: Record<string, Executor> = {
  "gh.pr.merge": (p) => {
    const repo = validateRepo(p);
    const n = validateNumber(p);
    const method = validateMergeMethod(p);
    const args = ["pr", "merge", n, "--repo", repo, `--${method}`];
    if (validateFlag(p, "deleteBranch")) args.push("--delete-branch");
    return exec("gh.pr.merge", args, 120_000);
  },
  "gh.pr.review": (p) => {
    const repo = validateRepo(p);
    const n = validateNumber(p);
    const event = validateReviewEvent(p);
    const body = validateBody(p, event === "request-changes");
    const args = ["pr", "review", n, "--repo", repo,
      event === "approve" ? "--approve" : "--request-changes"];
    if (body) args.push("--body", body);
    return exec("gh.pr.review", args);
  },
  "gh.pr.comment": (p) => {
    const body = validateBody(p, true)!;
    return exec("gh.pr.comment", [
      "pr", "comment", validateNumber(p), "--repo", validateRepo(p), "--body", body,
    ]);
  },
  "gh.issue.comment": (p) => {
    const body = validateBody(p, true)!;
    return exec("gh.issue.comment", [
      "issue", "comment", validateNumber(p), "--repo", validateRepo(p), "--body", body,
    ]);
  },
  "gh.pr.close": (p) =>
    exec("gh.pr.close", ["pr", "close", validateNumber(p), "--repo", validateRepo(p)]),
  "gh.pr.reopen": (p) =>
    exec("gh.pr.reopen", ["pr", "reopen", validateNumber(p), "--repo", validateRepo(p)]),
  "gh.issue.close": (p) =>
    exec("gh.issue.close", ["issue", "close", validateNumber(p), "--repo", validateRepo(p)]),
  "gh.issue.reopen": (p) =>
    exec("gh.issue.reopen", ["issue", "reopen", validateNumber(p), "--repo", validateRepo(p)]),
  "gh.run.rerun": (p) => {
    const args = ["run", "rerun", validateRunId(p), "--repo", validateRepo(p)];
    if (validateFlag(p, "failedOnly")) args.push("--failed");
    return exec("gh.run.rerun", args, 120_000);
  },
  "gh.run.cancel": (p) =>
    exec("gh.run.cancel", ["run", "cancel", validateRunId(p), "--repo", validateRepo(p)]),
};
