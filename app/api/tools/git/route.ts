import { NextResponse } from "next/server";
import { scanGitOverview } from "@/lib/git/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await scanGitOverview();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
