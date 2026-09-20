import { NextResponse } from "next/server";
import { overviewQuery } from "@/lib/gh/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await overviewQuery());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
