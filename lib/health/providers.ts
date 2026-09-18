import { run } from "@/lib/detectors/utils/shell";

export type HealthStatus = "running" | "stopped";

export interface HealthCheckResult {
  toolId: string;
  status: HealthStatus;
  /** 简短描述，如 "accepting connections" / "端口 3306 无响应" */
  detail: string;
  durationMs: number;
}

type HealthFn = () => Promise<{ status: HealthStatus; detail: string }>;

/** 通用：执行命令，成功且（可选）输出匹配 → running */
async function cmdCheck(
  cmd: string,
  runningMatch?: string,
  timeoutMs = 8000
): Promise<{ status: HealthStatus; detail: string }> {
  const res = await run(cmd, timeoutMs);
  const out = (res.stdout || res.stderr).trim();
  const firstLine = out.split("\n")[0]?.slice(0, 120) ?? "";
  const ok = res.ok && (!runningMatch || out.includes(runningMatch));
  return {
    status: ok ? "running" : "stopped",
    detail: ok ? firstLine || "运行中" : firstLine || "未响应",
  };
}

/** 端口探测专用（nc 成功时无输出，自定义提示语） */
async function portCheck(
  port: number,
  name: string
): Promise<{ status: HealthStatus; detail: string }> {
  const res = await run(`nc -z -G 2 127.0.0.1 ${port}`, 6000);
  return {
    status: res.ok ? "running" : "stopped",
    detail: res.ok ? `端口 ${port} 开放` : `端口 ${port} 无响应（${name} 未运行）`,
  };
}

/**
 * 健康检查表，key 为工具 id。
 * 只对扫描结果为 ok 的工具执行（health API 负责过滤）。
 */
export const healthProviders: Record<string, HealthFn> = {
  psql: () => cmdCheck(`pg_isready`),
  redis: () => cmdCheck(`redis-cli ping`, "PONG"),
  mysql: () => portCheck(3306, "MySQL"),
  mongo: () => portCheck(27017, "MongoDB"),
  docker: () => cmdCheck(`docker info --format 'Server {{.ServerVersion}}'`, "Server"),
  "apple-container": () => cmdCheck(`container system status`),
};
