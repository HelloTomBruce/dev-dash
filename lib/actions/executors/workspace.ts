import fs from "node:fs/promises";
import path from "node:path";
import { run, shQuote } from "@/lib/detectors/utils/shell";
import { exec } from "../exec";
import type { ActionExecutor } from "../types";
import { validateDir } from "../validators";

/** 工作区类动作：文件/目录、Git 配置、Python 虚拟环境与镜像源 */
export const workspaceExecutors: Record<string, ActionExecutor> = {
  "tool.open-dir": (p) => exec("tool.open-dir", `open "${validateDir(p)}"`, 10_000),

  "git.test-ssh": async () => {
    const start = Date.now();
    const cmd = "ssh -T -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=5 git@github.com";
    const res = await run(cmd, 8000, { okIfOutput: true });
    const output = (res.stdout + (res.stderr ? `\n${res.stderr}` : "")).trim();
    const isAuthenticated = output.includes("successfully authenticated") || output.includes("Hi ");

    return {
      ok: isAuthenticated,
      actionId: "git.test-ssh",
      command: cmd,
      output: output || "无输出",
      error: isAuthenticated ? null : (output || "无法通过 SSH 连接到 GitHub，请检查密钥是否添加至 GitHub 账户"),
      durationMs: Date.now() - start,
    };
  },

  "git.set-config": async (p) => {
    const start = Date.now();
    const key = p?.key;
    const value = p?.value;
    const ALLOWED_KEYS = new Set(["user.name", "user.email", "init.defaultBranch", "pull.rebase"]);

    if (!key || !ALLOWED_KEYS.has(key)) {
      throw new Error(`不允许修改的配置项: ${key}，允许: ${Array.from(ALLOWED_KEYS).join(", ")}`);
    }
    if (value === undefined || value === null) {
      throw new Error("配置值不能为空");
    }

    const cmd = `git config --global ${key} ${shQuote(value)}`;
    const res = await run(cmd, 4000);

    return {
      ok: res.ok,
      actionId: "git.set-config",
      command: cmd,
      output: res.ok ? `已成功设置 Git 全局配置: ${key} = ${value}` : res.stdout,
      error: res.ok ? null : (res.stderr || "配置保存失败"),
      durationMs: Date.now() - start,
    };
  },

  "python.del-venv": async (p) => {
    const start = Date.now();
    const venvPath = p?.path;
    if (!venvPath || !path.isAbsolute(venvPath)) {
      throw new Error("参数错误：必须提供合法的绝对路径");
    }

    const baseName = path.basename(venvPath);
    if (![".venv", "venv", "env"].includes(baseName)) {
      throw new Error(`安全限制：只能删除名为 .venv、venv 或 env 的虚拟环境目录 (${baseName})`);
    }

    // 检查 pyvenv.cfg 是否存在，防止误删普通目录
    try {
      const cfg = await fs.stat(path.join(venvPath, "pyvenv.cfg"));
      if (!cfg.isFile()) {
        throw new Error("安全限制：目标目录未包含 pyvenv.cfg，不是合法的虚拟环境");
      }
    } catch {
      throw new Error("安全限制：未找到 pyvenv.cfg 配置文件，拒绝删除");
    }

    await fs.rm(venvPath, { recursive: true, force: true });

    return {
      ok: true,
      actionId: "python.del-venv",
      command: `rm -rf ${venvPath}`,
      output: `已成功删除虚拟环境: ${venvPath}`,
      error: null,
      durationMs: Date.now() - start,
    };
  },

  "python.set-pip-index": async (p) => {
    const start = Date.now();
    const url = p?.url?.trim();
    if (!url) {
      // 还原默认源
      const res = await run("pip3 config unset global.index-url", 4000);
      return {
        ok: res.ok,
        actionId: "python.set-pip-index",
        command: "pip3 config unset global.index-url",
        output: res.ok ? "已还原 pip 默认官方源 (https://pypi.org/simple)" : res.stdout,
        error: res.ok ? null : res.stderr,
        durationMs: Date.now() - start,
      };
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("镜像源地址必须以 http:// 或 https:// 开头");
    }

    const cmd = `pip3 config set global.index-url ${shQuote(url)}`;
    const res = await run(cmd, 4000);

    return {
      ok: res.ok,
      actionId: "python.set-pip-index",
      command: cmd,
      output: res.ok ? `已成功设置 pip 镜像源为: ${url}` : res.stdout,
      error: res.ok ? null : (res.stderr || "设置 pip 镜像源失败"),
      durationMs: Date.now() - start,
    };
  },
};
