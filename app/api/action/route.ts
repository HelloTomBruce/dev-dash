import { NextResponse } from "next/server";
import { ACTION_META } from "@/lib/actions/meta";
import { actionExecutors } from "@/lib/actions/registry";
import { createTask, updateTask } from "@/lib/tasks/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 受控操作接口。
 * 安全模型：
 *   - 白名单动作（actionExecutors），不执行任意命令
 *   - 仅接受 localhost 来源（本应用只应绑定 localhost）
 *
 * 异步任务：标记 async: true 的动作立即返回 taskId，后台执行。
 * 前端通过 /api/tasks/[taskId] 轮询状态。
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

  const meta = ACTION_META[id];

  // 异步任务：创建 taskId，后台执行
  if (meta?.async) {
    const taskId = createTask(id);
    // 后台执行（微任务，不阻塞 HTTP 响应）
    Promise.resolve().then(async () => {
      updateTask(taskId, { status: "running" });
      try {
        const result = await actionExecutors[id](body.params);
        updateTask(taskId, {
          status: result.ok ? "done" : "failed",
          output: result.output,
          error: result.error,
          durationMs: result.durationMs,
          finishedAt: Date.now(),
        });
      } catch (err) {
        updateTask(taskId, {
          status: "failed",
          error: String(err),
          durationMs: 0,
          finishedAt: Date.now(),
        });
      }
    });
    return NextResponse.json({ taskId, label: meta.label, actionId: id });
  }

  // 同步任务：直接执行并返回结果
  try {
    const result = await actionExecutors[id](body.params);
    return NextResponse.json(
      { ...result, label: ACTION_META[id]?.label },
      { status: result.ok ? 200 : 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, actionId: id, error: String(err), output: "", durationMs: 0 },
      { status: 400 }
    );
  }
}
