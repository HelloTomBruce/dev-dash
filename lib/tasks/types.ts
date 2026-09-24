/** 任务状态 */
export type TaskStatus = "queued" | "running" | "done" | "failed";

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  actionId: string;
  output: string;
  error: string | null;
  durationMs: number;
  startedAt: number;
  finishedAt: number | null;
}
