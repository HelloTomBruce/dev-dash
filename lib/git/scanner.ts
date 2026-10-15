import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { run, runArgs, extractVersion } from "@/lib/detectors/utils/shell";
import type { GitConfig, GitOverviewResult, LocalRepoInfo, SshKeyInfo } from "./types";

/** 扫描 Git 全局配置 */
async function scanGitConfig(): Promise<GitConfig> {
  const [verRes, whichRes, lfsRes, configRes] = await Promise.all([
    run("git --version", 3000),
    run("which git", 3000),
    run("git lfs version 2>/dev/null", 3000),
    run("git config --global --list", 3000),
  ]);

  const cfgMap = new Map<string, string>();
  if (configRes.ok && configRes.stdout) {
    for (const line of configRes.stdout.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        cfgMap.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
      }
    }
  }

  return {
    version: extractVersion(verRes.stdout),
    binPath: whichRes.stdout.trim() || null,
    userName: cfgMap.get("user.name") || null,
    userEmail: cfgMap.get("user.email") || null,
    defaultBranch: cfgMap.get("init.defaultBranch") || null,
    pullRebase: cfgMap.get("pull.rebase") || null,
    ignoreCase: cfgMap.get("core.ignorecase") || null,
    globalIgnorePath: cfgMap.get("core.excludesfile") || null,
    httpProxy: cfgMap.get("http.proxy") || null,
    httpsProxy: cfgMap.get("https.proxy") || null,
    lfsVersion: extractVersion(lfsRes.stdout),
  };
}

/** 扫描 SSH 密钥与 Agent 状态 */
async function scanSshKeys(home: string): Promise<{ sshKeys: SshKeyInfo[]; sshAgentRunning: boolean }> {
  const sshDir = path.join(home, ".ssh");
  const sshKeys: SshKeyInfo[] = [];
  let sshAgentRunning = false;

  // 1. 检查已加载到 ssh-agent 的密钥指纹
  const agentKeyFingerprints = new Set<string>();
  try {
    const agentRes = await run("ssh-add -l", 3000);
    if (agentRes.ok && agentRes.stdout) {
      sshAgentRunning = true;
      for (const line of agentRes.stdout.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          agentKeyFingerprints.add(parts[1]); // SHA256:...
        }
      }
    } else if (agentRes.stderr.includes("The agent has no identities")) {
      sshAgentRunning = true;
    }
  } catch {
    // ignore
  }

  // 2. 遍历 ~/.ssh/ 下的所有 .pub 文件
  try {
    const files = await fs.readdir(sshDir);
    const pubFiles = files.filter((f) => f.endsWith(".pub"));

    for (const pubFile of pubFiles) {
      const fullPath = path.join(sshDir, pubFile);
      try {
        const [content, fpRes] = await Promise.all([
          fs.readFile(fullPath, "utf-8"),
          runArgs("ssh-keygen", ["-lf", fullPath], 3000),
        ]);

        let bits: string | null = null;
        let fingerprint = "";
        let comment: string | null = null;
        let keyType = "SSH Key";

        if (fpRes.ok && fpRes.stdout) {
          // Format: 256 SHA256:... comment (ED25519)
          const parts = fpRes.stdout.trim().split(/\s+/);
          if (parts.length >= 4) {
            bits = parts[0];
            fingerprint = parts[1];
            comment = parts.slice(2, parts.length - 1).join(" ");
            keyType = parts[parts.length - 1].replace(/[()]/g, "");
          }
        }

        const trimmedContent = content.trim();
        const isLoadedInAgent = fingerprint ? agentKeyFingerprints.has(fingerprint) : false;

        sshKeys.push({
          id: pubFile,
          filename: pubFile,
          keyType,
          bits,
          fingerprint: fingerprint || "未知指纹",
          comment: comment || null,
          publicKey: trimmedContent,
          isLoadedInAgent,
        });
      } catch {
        // ignore single file error
      }
    }
  } catch {
    // ~/.ssh not found
  }

  return { sshKeys, sshAgentRunning };
}

/** 识别远程仓库服务商 */
function identifyProvider(url: string | null): "github" | "gitlab" | "gitee" | "other" | null {
  if (!url) return null;
  const l = url.toLowerCase();
  if (l.includes("github.com")) return "github";
  if (l.includes("gitlab")) return "gitlab";
  if (l.includes("gitee.com")) return "gitee";
  return "other";
}

/** 扫描单个本地 Git 仓库的状态 */
async function inspectRepo(repoPath: string, home: string): Promise<LocalRepoInfo | null> {
  const repoName = path.basename(repoPath);
  try {
    const [branchRes, statusRes, remoteRes, logRes, countRes] = await Promise.all([
      runArgs("git", ["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"], 2500, { redirections: "2>/dev/null" }),
      runArgs("git", ["-C", repoPath, "status", "--porcelain=v1"], 3000, { redirections: "2>/dev/null" }),
      runArgs("git", ["-C", repoPath, "remote", "get-url", "origin"], 2500, { redirections: "2>/dev/null" }),
      runArgs("git", ["-C", repoPath, "log", "-1", "--format=%h|%s|%an|%cr"], 2500, { redirections: "2>/dev/null" }),
      runArgs("git", ["-C", repoPath, "rev-list", "--left-right", "--count", "@{u}...HEAD"], 2500, { redirections: "2>/dev/null" }),
    ]);

    if (!branchRes.ok) return null; // not a valid git repo

    const branch = branchRes.stdout.trim() || "HEAD";
    let modifiedCount = 0;
    let untrackedCount = 0;

    if (statusRes.stdout) {
      for (const line of statusRes.stdout.split("\n")) {
        if (!line.trim()) continue;
        if (line.startsWith("??")) {
          untrackedCount++;
        } else {
          modifiedCount++;
        }
      }
    }

    let behindCount = 0;
    let aheadCount = 0;
    if (countRes.ok && countRes.stdout) {
      const parts = countRes.stdout.trim().split(/\s+/);
      if (parts.length >= 2) {
        behindCount = parseInt(parts[0], 10) || 0;
        aheadCount = parseInt(parts[1], 10) || 0;
      }
    }

    let lastCommit: LocalRepoInfo["lastCommit"] = null;
    if (logRes.ok && logRes.stdout) {
      const parts = logRes.stdout.trim().split("|");
      if (parts.length >= 4) {
        lastCommit = {
          hash: parts[0],
          message: parts[1],
          author: parts[2],
          relativeTime: parts[3],
        };
      }
    }

    const remoteUrl = remoteRes.ok ? remoteRes.stdout.trim() : null;
    const displayPath = repoPath.startsWith(home) ? `~${repoPath.slice(home.length)}` : repoPath;

    return {
      id: repoPath,
      name: repoName,
      path: repoPath,
      displayPath,
      branch,
      isDirty: modifiedCount > 0 || untrackedCount > 0,
      modifiedCount,
      untrackedCount,
      aheadCount,
      behindCount,
      lastCommit,
      remoteUrl,
      remoteProvider: identifyProvider(remoteUrl),
    };
  } catch {
    return null;
  }
}

/** 扫描多个工作区目录下的本地仓库 */
async function scanLocalRepos(home: string): Promise<LocalRepoInfo[]> {
  const candidateDirs = [
    path.join(home, "code"),
    path.join(home, "Projects"),
    path.join(home, "workspace"),
    path.join(home, "dev"),
  ];

  const repoPaths: string[] = [];

  for (const rootDir of candidateDirs) {
    try {
      const entries = await fs.readdir(/*turbopackIgnore: true*/ rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;
        const subPath = path.join(rootDir, entry.name);
        try {
          const gitStat = await fs.stat(path.join(subPath, ".git"));
          if (gitStat.isDirectory() || gitStat.isFile()) {
            repoPaths.push(subPath);
          }
        } catch {
          // not a git repo
        }
      }
    } catch {
      // rootDir not existing
    }
  }

  // 并行扫描各个仓库状态 (限制批次避免超出并发)
  const results = await Promise.all(repoPaths.map((p) => inspectRepo(p, home)));
  const validRepos = results.filter(Boolean) as LocalRepoInfo[];

  // 排序：有未提交更改(Dirty) > 有未推送提交(Ahead) > 仓库名
  validRepos.sort((a, b) => {
    if (a.isDirty !== b.isDirty) return a.isDirty ? -1 : 1;
    if (a.aheadCount !== b.aheadCount) return b.aheadCount - a.aheadCount;
    return a.name.localeCompare(b.name);
  });

  return validRepos;
}

export async function scanGitOverview(): Promise<GitOverviewResult> {
  const t0 = Date.now();
  const home = os.homedir();

  const [config, sshData, repos] = await Promise.all([
    scanGitConfig(),
    scanSshKeys(home),
    scanLocalRepos(home),
  ]);

  const dirtyReposCount = repos.filter((r) => r.isDirty).length;
  const unpushedReposCount = repos.filter((r) => r.aheadCount > 0).length;

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    config,
    sshKeys: sshData.sshKeys,
    sshAgentRunning: sshData.sshAgentRunning,
    repos,
    totalRepos: repos.length,
    dirtyReposCount,
    unpushedReposCount,
  };
}
