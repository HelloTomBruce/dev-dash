import { runGh, runGhJson } from "./runner";
import {
  parseAuthStatus,
  parseConfig,
  parseExtensions,
  parseRateLimit,
  rollupState,
} from "./parse";
import type { GhItem, GhMine, GhOverview, GhRepoDetail, GhRepoRef } from "./types";
import { validateRepo } from "./validate";

const SEARCH_FIELDS = "number,title,repository,url,updatedAt";

interface SearchRow {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  repository?: { nameWithOwner?: string };
  isPullRequest?: boolean;
}

function toItem(row: SearchRow): GhItem {
  return {
    repo: row.repository?.nameWithOwner ?? "?",
    number: row.number,
    title: row.title,
    url: row.url,
    updatedAt: row.updatedAt,
    kind: row.isPullRequest ? "pr" : "issue",
  };
}

export async function overviewQuery(): Promise<GhOverview> {
  const start = Date.now();
  const authRes = await runGh(["auth", "status"], 10000);
  const auth = parseAuthStatus(authRes.stdout + "\n" + authRes.stderr);
  if (!auth.loggedIn) {
    return {
      version: null,
      auth,
      extensions: [],
      config: [],
      rateLimit: null,
      mine: null,
      durationMs: Date.now() - start,
    };
  }
  const [
    versionRes,
    extRes,
    configRes,
    rateRes,
    reviewReq,
    myPrs,
    assigned,
    mentions,
  ] = await Promise.all([
    runGh(["--version"], 10000),
    runGh(["extension", "list"], 10000),
    runGh(["config", "list"], 10000),
    runGh(["api", "rate_limit"], 15000),
    runGhJson<SearchRow[]>(
      ["search", "prs", "--review-requested=@me", "--state=open", "--limit", "20", "--json", SEARCH_FIELDS],
      20000
    ),
    runGhJson<SearchRow[]>(
      ["search", "prs", "--author=@me", "--state=open", "--limit", "20", "--json", SEARCH_FIELDS],
      20000
    ),
    runGhJson<SearchRow[]>(
      ["search", "issues", "--assignee=@me", "--state=open", "--limit", "20", "--json", SEARCH_FIELDS + ",isPullRequest"],
      20000
    ),
    runGhJson<SearchRow[]>(
      ["search", "issues", "--mentions=@me", "--state=open", "--limit", "20", "--json", SEARCH_FIELDS + ",isPullRequest"],
      20000
    ),
  ]);
  const mine: GhMine = {
    reviewRequested: reviewReq.map(toItem),
    myPrs: myPrs.map(toItem),
    assignedIssues: assigned.filter((r) => !r.isPullRequest).map(toItem),
    mentions: mentions.map(toItem),
  };
  return {
    version: versionRes.stdout.match(/gh version (\S+)/)?.[1] ?? null,
    auth,
    extensions: parseExtensions(extRes.stdout),
    config: parseConfig(configRes.stdout),
    rateLimit: parseRateLimit(rateRes.stdout),
    mine,
    durationMs: Date.now() - start,
  };
}

let reposCache: { at: number; repos: GhRepoRef[] } | null = null;

/** 我最近 push 的仓库（30 秒缓存） */
export async function reposQuery(): Promise<GhRepoRef[]> {
  if (reposCache && Date.now() - reposCache.at < 30_000) return reposCache.repos;
  const rows = await runGhJson<
    Array<{ full_name: string; pushed_at: string; private: boolean; fork: boolean }>
  >(
    ["api", "user/repos?sort=pushed&per_page=30&affiliation=owner,collaborator,organization_member"],
    20000
  );
  const repos: GhRepoRef[] = rows.map((r) => ({
    fullName: r.full_name,
    pushedAt: r.pushed_at,
    isPrivate: r.private,
    isFork: r.fork,
  }));
  reposCache = { at: Date.now(), repos };
  return repos;
}

interface PrRow {
  number: number;
  title: string;
  author?: { login: string };
  isDraft: boolean;
  mergeable: string;
  reviewDecision: string;
  statusCheckRollup?: unknown;
  updatedAt: string;
  url: string;
}

interface IssueRow {
  number: number;
  title: string;
  author?: { login: string };
  labels?: Array<{ name: string }>;
  assignees?: Array<{ login: string }>;
  updatedAt: string;
  url: string;
}

interface RunRow {
  databaseId: number;
  workflowName: string;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  headBranch: string;
  event: string;
  createdAt: string;
  url: string;
}

/** 单仓库聚合：仓库信息 + open PR + open issue + 最近 runs；单项失败降级为 errors[key] */
export async function repoQuery(repoParam: string): Promise<GhRepoDetail> {
  const start = Date.now();
  const repo = validateRepo({ repo: repoParam });
  const errors: Record<string, string> = {};
  const [repoView, prs, issues, runs] = await Promise.allSettled([
    runGhJson<{
      nameWithOwner: string;
      defaultBranchRef?: { name: string };
      stargazerCount: number;
      url: string;
    }>(["repo", "view", repo, "--json", "nameWithOwner,defaultBranchRef,stargazerCount,url"], 15000),
    runGhJson<PrRow[]>(
      ["pr", "list", "--repo", repo, "--state", "open", "--limit", "50", "--json",
        "number,title,author,isDraft,mergeable,reviewDecision,statusCheckRollup,updatedAt,url"],
      20000
    ),
    runGhJson<IssueRow[]>(
      ["issue", "list", "--repo", repo, "--state", "open", "--limit", "50", "--json",
        "number,title,author,labels,assignees,updatedAt,url"],
      20000
    ),
    runGhJson<RunRow[]>(
      ["run", "list", "--repo", repo, "--limit", "20", "--json",
        "databaseId,workflowName,displayTitle,status,conclusion,headBranch,event,createdAt,url"],
      20000
    ),
  ]);
  const pick = <T,>(r: PromiseSettledResult<T>, key: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    errors[key] = String(r.reason).slice(0, 300);
    return null;
  };
  const rv = pick(repoView, "repo");
  return {
    repo: rv
      ? {
          fullName: rv.nameWithOwner,
          defaultBranch: rv.defaultBranchRef?.name ?? "",
          stars: rv.stargazerCount,
          url: rv.url,
        }
      : null,
    prs:
      pick(prs, "prs")?.map((p) => ({
        number: p.number,
        title: p.title,
        author: p.author?.login ?? "?",
        isDraft: p.isDraft,
        mergeable: p.mergeable,
        reviewDecision: p.reviewDecision,
        checksState: rollupState(p.statusCheckRollup),
        updatedAt: p.updatedAt,
        url: p.url,
      })) ?? null,
    issues:
      pick(issues, "issues")?.map((i) => ({
        number: i.number,
        title: i.title,
        author: i.author?.login ?? "?",
        labels: (i.labels ?? []).map((l) => l.name),
        assignees: (i.assignees ?? []).map((a) => a.login),
        updatedAt: i.updatedAt,
        url: i.url,
      })) ?? null,
    runs: pick(runs, "runs") ?? null,
    errors,
    durationMs: Date.now() - start,
  };
}
