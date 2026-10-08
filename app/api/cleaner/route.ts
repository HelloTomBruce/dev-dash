import { NextResponse } from "next/server";
import { scanCleanerTargets } from "@/lib/cleaner/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await scanCleanerTargets();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
