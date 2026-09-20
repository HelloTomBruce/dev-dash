import { NextResponse } from "next/server";
import { searchQuery } from "@/lib/gh/queries";
import type { GhSearchType } from "@/lib/gh/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["repos", "issues", "prs", "code", "commits"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") ?? "repos";
  if (!q) {
    return NextResponse.json({ error: "缺少 q 参数" }, { status: 400 });
  }
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: `非法 type: ${type}` }, { status: 400 });
  }
  try {
    return NextResponse.json(await searchQuery(q, type as GhSearchType));
  } catch (err) {
    const msg = String(err);
    if (/rate limit/i.test(msg)) {
      return NextResponse.json(
        { error: "rate-limit", message: "GitHub 搜索限额已用尽，请稍后再试" },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
