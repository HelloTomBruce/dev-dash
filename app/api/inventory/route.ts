import { NextResponse } from "next/server";
import { INVENTORY_META } from "@/lib/inventories/meta";
import { inventoryProviders } from "@/lib/inventories/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

async function withTimeout<T>(
  p: Promise<T>,
  ms: number
): Promise<T | { __timeout: true }> {
  return Promise.race([
    p,
    new Promise<{ __timeout: true }>((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), ms)
    ),
  ]);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const force = url.searchParams.get("force") === "1";

  if (!id || !(id in inventoryProviders)) {
    return NextResponse.json({ error: `未知的清单 id: ${id}` }, { status: 400 });
  }
  const meta = INVENTORY_META.find((m) => m.id === id);

  if (!force) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(hit.payload);
    }
  }

  const start = Date.now();
  try {
    const out = await withTimeout(inventoryProviders[id](), 30_000);
    if (out && typeof out === "object" && "__timeout" in out) {
      throw new Error("获取清单超时");
    }
    const payload = {
      id,
      label: meta?.label ?? id,
      items: out,
      error: null,
      durationMs: Date.now() - start,
    };
    cache.set(id, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        id,
        label: meta?.label ?? id,
        items: [],
        error: String(err).slice(0, 300),
        durationMs: Date.now() - start,
      },
      { status: 200 }
    );
  }
}
