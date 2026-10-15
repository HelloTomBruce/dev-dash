import type { ActionExecutor } from "./types";
import { databaseExecutors } from "./executors/database";
import { packageExecutors } from "./executors/packages";
import { serviceExecutors } from "./executors/service";
import { systemExecutors } from "./executors/system";
import { workspaceExecutors } from "./executors/workspace";

/**
 * 动作白名单注册表 —— 只允许执行此处注册的固定命令模板，
 * 参数经过严格校验（lib/actions/validators.ts），不接受任意命令字符串。
 *
 * 具体执行器按领域拆分在 lib/actions/executors/*：
 *   - service：服务启停（brew services / container / nginx）
 *   - packages：包管理与升级（brew / node / npm / pnpm / pip / uv / rust / gem）
 *   - database：PostgreSQL / Redis
 *   - workspace：目录、Git 配置、Python 虚拟环境与镜像源
 *   - system：端口进程释放、磁盘清理
 * 新增动作请在对应领域文件注册（键名不得重复）。
 */
export const actionExecutors: Record<string, ActionExecutor> = {
  ...serviceExecutors,
  ...packageExecutors,
  ...databaseExecutors,
  ...workspaceExecutors,
  ...systemExecutors,
};
