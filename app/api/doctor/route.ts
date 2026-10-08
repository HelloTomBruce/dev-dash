import { NextResponse } from "next/server";
import { runEnvironmentDoctor } from "@/lib/doctor/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  try {
    const result = await runEnvironmentDoctor(force);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
