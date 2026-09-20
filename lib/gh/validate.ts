/** gh 写操作参数校验器 —— 字符集白名单，杜绝注入（正文类参数由 runner 层转义兜底） */

// \w = [A-Za-z0-9_]；owner 允许字母数字连字符，repo 名额外允许 . _
const REPO_RE = /^[\w-]+\/[\w._-]+$/;
const NUMBER_RE = /^\d{1,10}$/;

export function validateRepo(params?: Record<string, string>): string {
  const r = params?.repo?.trim();
  if (!r || !REPO_RE.test(r)) throw new Error(`非法仓库名: ${r ?? "(空)"}`);
  return r;
}

export function validateNumber(params?: Record<string, string>): string {
  const n = params?.number?.trim();
  if (!n || !NUMBER_RE.test(n)) throw new Error(`非法编号: ${n ?? "(空)"}`);
  return n;
}

export function validateRunId(params?: Record<string, string>): string {
  const n = params?.runId?.trim();
  if (!n || !NUMBER_RE.test(n)) throw new Error(`非法 run id: ${n ?? "(空)"}`);
  return n;
}

const MERGE_METHODS = new Set(["merge", "squash", "rebase"]);

export function validateMergeMethod(params?: Record<string, string>): string {
  const m = params?.method?.trim() ?? "squash";
  if (!MERGE_METHODS.has(m)) throw new Error(`非法 merge 方式: ${m}`);
  return m;
}

const REVIEW_EVENTS = new Set(["approve", "request-changes"]);

export function validateReviewEvent(params?: Record<string, string>): string {
  const e = params?.event?.trim();
  if (!e || !REVIEW_EVENTS.has(e)) throw new Error(`非法 review 事件: ${e ?? "(空)"}`);
  return e;
}

/** 正文参数：长度上限 4000；required 时必填。返回 null 表示未提供（可选场景） */
export function validateBody(
  params?: Record<string, string>,
  required = false
): string | null {
  const b = params?.body?.trim();
  if (!b) {
    if (required) throw new Error("该操作必须填写正文");
    return null;
  }
  if (b.length > 4000) throw new Error("正文超过 4000 字符上限");
  return b;
}

/** 布尔开关参数：仅接受 "" | "1"，用于可选 flag（deleteBranch / failedOnly） */
export function validateFlag(
  params: Record<string, string> | undefined,
  key: string
): boolean {
  const v = params?.[key]?.trim() ?? "";
  if (v !== "" && v !== "1") throw new Error(`非法开关参数 ${key}: ${v}`);
  return v === "1";
}
