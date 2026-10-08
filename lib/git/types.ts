export interface GitConfig {
  version: string | null;
  binPath: string | null;
  userName: string | null;
  userEmail: string | null;
  defaultBranch: string | null;
  pullRebase: string | null;
  ignoreCase: string | null;
  globalIgnorePath: string | null;
  httpProxy: string | null;
  httpsProxy: string | null;
  lfsVersion: string | null;
}

export interface SshKeyInfo {
  id: string;
  filename: string;
  keyType: string;
  bits: string | null;
  fingerprint: string;
  comment: string | null;
  publicKey: string;
  isLoadedInAgent: boolean;
}

export interface LocalRepoInfo {
  id: string;
  name: string;
  path: string;
  displayPath: string;
  branch: string;
  isDirty: boolean;
  modifiedCount: number;
  untrackedCount: number;
  aheadCount: number;
  behindCount: number;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    relativeTime: string;
  } | null;
  remoteUrl: string | null;
  remoteProvider: "github" | "gitlab" | "gitee" | "other" | null;
}

export interface GitOverviewResult {
  scannedAt: string;
  durationMs: number;
  config: GitConfig;
  sshKeys: SshKeyInfo[];
  sshAgentRunning: boolean;
  repos: LocalRepoInfo[];
  totalRepos: number;
  dirtyReposCount: number;
  unpushedReposCount: number;
}
