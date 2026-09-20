import { runGh, runGhJson } from "./runner";
import {
  parseAuthStatus,
  parseConfig,
  parseExtensions,
  parseRateLimit,
} from "./parse";
import type { GhItem, GhMine, GhOverview, GhRepoRef } from "./types";
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

// ---- reposQuery / repoQuery / searchQuery 在后续任务中追加到本文件 ----

export type { GhRepoRef };
