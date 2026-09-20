import { NextResponse } from "next/server";
import { ghActionExecutors } from "@/lib/gh/actions";
import { GH_ACTION_META } from "@/lib/gh/action-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * gh 受控写操作接口。
 * 安全模型（与 /api/action 对齐但白名单独立）：
 *  - 仅 localhost 来源
 *  - 只允许 ghActionExecutors 注册的固定动作
 *  - 参数校验失败返回 400（validate.ts 抛错）
 */
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  if (
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1") &&
    !host.startsWith("[::1]")
  ) {
    return NextResponse.json({ error: "仅允许 localhost 调用" }, { status: 403 });
  }

  let body: { id?: string; params?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const id = body.id;
  if (!id || !(id in ghActionExecutors)) {
    return NextResponse.json({ error: `未知的动作 id: ${id ?? "(空)"}` }, { status: 400 });
  }

  try {
    const result = await ghActionExecutors[id](body.params);
    return NextResponse.json({ ...result, label: GH_ACTION_META[id]?.label });
  } catch (err) {
    return NextResponse.json(
      { ok: false, actionId: id, error: String(err), output: "", durationMs: 0 },
      { status: 400 }
    );
  }
}
