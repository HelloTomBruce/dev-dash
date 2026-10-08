export interface PythonRuntimeInfo {
  path: string;
  version: string | null;
  source: "brew" | "uv" | "system" | "pyenv" | "other";
  isDefault: boolean;
}

export interface VirtualEnvInfo {
  id: string;
  projectName: string;
  projectPath: string;
  venvPath: string;
  displayPath: string;
  sizeBytes: number;
  humanSize: string;
  pythonVersion: string | null;
  uvManaged: boolean;
  packageCount: number;
}

export interface PipConfigInfo {
  indexUrl: string | null;
  trustedHost: string | null;
  extraIndexUrl: string | null;
}

export interface PythonOverviewResult {
  scannedAt: string;
  durationMs: number;
  runtimes: PythonRuntimeInfo[];
  virtualEnvs: VirtualEnvInfo[];
  totalVenvSizeBytes: number;
  totalVenvHumanSize: string;
  pipConfig: PipConfigInfo;
}
