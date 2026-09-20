import { NextResponse } from "next/server";
import { repoQuery } from "@/lib/gh/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ error: "缺少 repo 参数" }, { status: 400 });
  }
  try {
    return NextResponse.json(await repoQuery(repo));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
