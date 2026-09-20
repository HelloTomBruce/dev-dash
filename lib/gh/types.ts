/** gh 子系统共享类型 —— 仅类型导出，客户端可安全 import type */

export interface GhAuthInfo {
  loggedIn: boolean;
  account: string | null;
  host: string;
  protocol: string | null;
  scopes: string[];
  tokenExpired: boolean;
}

export interface GhExtension {
  name: string;
  version: string;
}

export interface GhConfigEntry {
  key: string;
  value: string;
}

export interface GhRateLimit {
  remaining: number;
  limit: number;
  resetAt: number; // epoch 秒
}

export interface GhItem {
  repo: string; // owner/name
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  kind: "pr" | "issue";
}

export interface GhMine {
  reviewRequested: GhItem[];
  myPrs: GhItem[];
  assignedIssues: GhItem[];
  mentions: GhItem[];
}

export interface GhOverview {
  version: string | null;
  auth: GhAuthInfo;
  extensions: GhExtension[];
  config: GhConfigEntry[];
  rateLimit: GhRateLimit | null;
  mine: GhMine | null;
  durationMs: number;
}

export interface GhRepoRef {
  fullName: string;
  pushedAt: string;
  isPrivate: boolean;
  isFork: boolean;
}

export type GhChecksState = "success" | "failure" | "pending" | null;

export interface GhPr {
  number: number;
  title: string;
  author: string;
  isDraft: boolean;
  mergeable: string; // MERGEABLE / CONFLICTING / UNKNOWN
  reviewDecision: string; // APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED / ""
  checksState: GhChecksState;
  updatedAt: string;
  url: string;
}

export interface GhIssue {
  number: number;
  title: string;
  author: string;
  labels: string[];
  assignees: string[];
  updatedAt: string;
  url: string;
}

export interface GhRun {
  databaseId: number;
  workflowName: string;
  displayTitle: string;
  status: string; // queued / in_progress / completed / waiting
  conclusion: string | null; // success / failure / cancelled / skipped / null
  headBranch: string;
  event: string;
  createdAt: string;
  url: string;
}

export interface GhRepoDetail {
  repo: {
    fullName: string;
    defaultBranch: string;
    stars: number;
    url: string;
  } | null;
  prs: GhPr[] | null;
  issues: GhIssue[] | null;
  runs: GhRun[] | null;
  /** 各分区加载失败信息（key ∈ repo/prs/issues/runs） */
  errors: Record<string, string>;
  durationMs: number;
}

export type GhSearchType = "repos" | "issues" | "prs" | "code" | "commits";

export type GhActionLevel = "safe" | "careful" | "dangerous";

export interface GhActionResult {
  ok: boolean;
  actionId: string;
  command: string;
  output: string;
  error: string | null;
  durationMs: number;
}
