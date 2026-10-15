/**
 * 通用超时竞速工具。
 *
 * 多处 API 路由与扫描器需要「给一个 Promise 加超时且不抛异常」，
 * 原先各自实现了一份 withTimeout，这里统一收敛，避免逻辑漂移。
 */

/** 超时哨兵对象：区分「超时」与「正常返回 undefined/null」 */
export interface TimeoutSentinel {
  __timeout: true;
}

const TIMEOUT: TimeoutSentinel = { __timeout: true };

/** 对 Promise 施加超时；超时返回哨兵对象而非抛异常 */
export async function withTimeout<T>(
  p: Promise<T>,
  ms: number
): Promise<T | TimeoutSentinel> {
  return Promise.race([
    p,
    new Promise<TimeoutSentinel>((resolve) =>
      setTimeout(() => resolve(TIMEOUT), ms)
    ),
  ]);
}

/** 判断 withTimeout 的返回值是否为超时哨兵 */
export function isTimeout<T>(value: T | TimeoutSentinel): value is TimeoutSentinel {
  return (
    typeof value === "object" &&
    value !== null &&
    "__timeout" in (value as Record<string, unknown>)
  );
}
