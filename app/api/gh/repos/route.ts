import { NextResponse } from "next/server";
import { reposQuery } from "@/lib/gh/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ repos: await reposQuery() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
