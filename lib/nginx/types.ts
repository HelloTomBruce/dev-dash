/**
 * Nginx 面板与 API 路由共享的类型定义。
 *
 * 原先 components/panels/nginx-panel.tsx 与 app/api/tools/nginx/route.ts
 * 各自维护了一份完全相同的接口，改字段时极易漂移；这里统一收敛。
 */

export interface NginxLocation {
  path: string;
  target: string;
  type: "proxy" | "root" | "alias" | "return" | "other";
}

export interface NginxServerBlock {
  file: string;
  relPath: string;
  listen: string[];
  serverNames: string[];
  root?: string;
  locations: NginxLocation[];
  ssl: boolean;
}

export interface ProcessInfo {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  command: string;
}

export interface ConfigFileInfo {
  path: string;
  name: string;
  relPath: string;
  size: number;
  updatedAt: string;
}

/** GET /api/tools/nginx 的完整返回体 */
export interface NginxDetail {
  status: "running" | "stopped";
  version: string;
  prefix: string;
  confPath: string;
  confDir: string;
  serversDir: string;
  logDir: string;
  accessLogPath: string;
  errorLogPath: string;
  testResult: {
    ok: boolean;
    output: string;
  };
  processCount: number;
  processes: ProcessInfo[];
  servers: NginxServerBlock[];
  configFiles: ConfigFileInfo[];
  accessLogs: string[];
  errorLogs: string[];
  buildInfo: {
    raw: string;
    configureArgs: string[];
  };
}
