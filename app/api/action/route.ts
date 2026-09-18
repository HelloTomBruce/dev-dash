import { NextResponse } from "next/server";
import { ACTION_META } from "@/lib/actions/meta";
import { actionExecutors } from "@/lib/actions/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 受控操作接口。
 * 安全模型：
 *  - 白名单动作（actionExecutors），不执行任意命令
 *  - 仅接受 localhost 来源（本应用只应绑定 localhost）
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
  if (!id || !(id in actionExecutors)) {
    return NextResponse.json(
      { error: `未知的动作 id: ${id}，可用: ${Object.keys(actionExecutors).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await actionExecutors[id](body.params);
    return NextResponse.json(
      { ...result, label: ACTION_META[id]?.label },
      { status: result.ok ? 200 : 200 } // 业务失败也返回 200，由 ok 字段表达
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, actionId: id, error: String(err), output: "", durationMs: 0 },
      { status: 400 }
    );
  }
}
