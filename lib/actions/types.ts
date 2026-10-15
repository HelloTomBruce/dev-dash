/** 动作执行结果的统一结构（时间轴/审计与结果弹窗共用） */
export interface ActionResult {
  ok: boolean;
  actionId: string;
  /** 实际执行的命令（便于审计） */
  command: string;
  output: string;
  error: string | null;
  durationMs: number;
}

/** 白名单动作执行器签名：只接收已校验的字符串参数 */
export type ActionExecutor = (
  params: Record<string, string> | undefined
) => Promise<ActionResult>;
