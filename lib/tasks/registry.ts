import type { TaskResult } from "./types";

const TASK_TTL_MS = 30 * 60_000; // 30 分钟过期

/** 进程内任务存储 */
const tasks = new Map<string, TaskResult>();

/** 清理过期任务（定期调用） */
export function gcTasks(): void {
  const now = Date.now();
  for (const [id, t] of tasks) {
    if (t.finishedAt != null && now - t.finishedAt > TASK_TTL_MS) {
      tasks.delete(id);
    }
  }
}

export function createTask(actionId: string): string {
  const taskId = `${actionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  tasks.set(taskId, {
    taskId,
    status: "queued",
    actionId,
    output: "",
    error: null,
    durationMs: 0,
    startedAt: Date.now(),
    finishedAt: null,
  });
  return taskId;
}

export function getTask(taskId: string): TaskResult | undefined {
  return tasks.get(taskId);
}

export function updateTask(taskId: string, patch: Partial<Pick<TaskResult, "status" | "output" | "error" | "durationMs" | "finishedAt">>): void {
  const t = tasks.get(taskId);
  if (t) {
    Object.assign(t, patch);
  }
}
