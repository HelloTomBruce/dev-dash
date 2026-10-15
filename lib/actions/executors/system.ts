import { run } from "@/lib/detectors/utils/shell";
import type { ActionExecutor } from "../types";

/** 系统维护类动作：端口进程释放、磁盘清理 */
export const systemExecutors: Record<string, ActionExecutor> = {
  "port.kill": async (p) => {
    const start = Date.now();
    const pidStr = p?.pid;
    if (!pidStr || !/^\d+$/.test(pidStr)) {
      throw new Error("参数错误：必须提供有效的数字 PID");
    }
    const pid = parseInt(pidStr, 10);
    if (pid <= 1) {
      throw new Error("安全限制：禁止终止系统核心进程 (PID <= 1)");
    }
    if (pid === process.pid) {
      throw new Error("安全限制：禁止终止 DevDash 自身的进程");
    }

    const signal = p?.force === "true" || p?.signal === "9" ? "-9" : "-15";
    const cmd = `kill ${signal} ${pid}`;
    const res = await run(cmd, 5000);

    return {
      ok: res.ok,
      actionId: "port.kill",
      command: cmd,
      output: res.ok ? `已向进程 PID ${pid} 发送 ${signal === "-9" ? "SIGKILL (强制终止)" : "SIGTERM (优雅退出)"} 信号` : res.stdout,
      error: res.ok ? null : (res.stderr || "终止进程失败，可能进程已退出或缺少权限"),
      durationMs: Date.now() - start,
    };
  },

  "cleaner.clean": async (p) => {
    const start = Date.now();
    const target = p?.target;
    const CLEAN_COMMANDS: Record<string, string> = {
      uv: "uv cache clean",
      npm: "npm cache clean --force",
      pnpm: "pnpm store prune",
      pip: "pip3 cache purge",
      brew: "brew cleanup --prune=all",
      yarn: "yarn cache clean --all",
      cargo: "rm -rf ~/.cargo/registry/cache ~/.cargo/git/db",
      "node-gyp": "rm -rf ~/.cache/node-gyp",
      "xcode-derived": "rm -rf ~/Library/Developer/Xcode/DerivedData",
    };

    if (!target || !CLEAN_COMMANDS[target]) {
      throw new Error(`无效的清理目标: ${target}，允许: ${Object.keys(CLEAN_COMMANDS).join(", ")}`);
    }

    const cmd = CLEAN_COMMANDS[target];
    const res = await run(cmd, 60_000, { okIfOutput: true });
    const output = (res.stdout + (res.stderr ? `\n${res.stderr}` : "")).trim() || "清理完成！";

    return {
      ok: res.ok,
      actionId: "cleaner.clean",
      command: cmd,
      output,
      error: res.ok ? null : (res.stderr || "清理命令执行失败"),
      durationMs: Date.now() - start,
    };
  },

  "cleaner.clean-all": async (p) => {
    const start = Date.now();
    const targetList = p?.targets
      ? p.targets.split(",").map((s) => s.trim()).filter(Boolean)
      : ["uv", "npm", "pnpm", "pip", "brew", "cargo", "node-gyp"];

    const CLEAN_COMMANDS: Record<string, { name: string; cmd: string }> = {
      uv: { name: "uv 缓存", cmd: "uv cache clean" },
      npm: { name: "npm 缓存", cmd: "npm cache clean --force" },
      pnpm: { name: "pnpm Store", cmd: "pnpm store prune" },
      pip: { name: "pip 缓存", cmd: "pip3 cache purge" },
      brew: { name: "Homebrew 缓存", cmd: "brew cleanup --prune=all" },
      yarn: { name: "Yarn 缓存", cmd: "yarn cache clean --all" },
      cargo: { name: "Cargo 缓存", cmd: "rm -rf ~/.cargo/registry/cache ~/.cargo/git/db" },
      "node-gyp": { name: "node-gyp 缓存", cmd: "rm -rf ~/.cache/node-gyp" },
      "xcode-derived": { name: "Xcode 派生数据", cmd: "rm -rf ~/Library/Developer/Xcode/DerivedData" },
    };

    const logs: string[] = [];
    let hasFail = false;

    for (const t of targetList) {
      const conf = CLEAN_COMMANDS[t];
      if (!conf) continue;
      logs.push(`=== 清理 ${conf.name} (${conf.cmd}) ===`);
      try {
        const res = await run(conf.cmd, 60_000, { okIfOutput: true });
        const out = (res.stdout + (res.stderr ? `\n${res.stderr}` : "")).trim();
        logs.push(out || "✓ 完成");
        if (!res.ok) hasFail = true;
      } catch (err) {
        logs.push(`✗ 失败: ${err}`);
        hasFail = true;
      }
      logs.push("");
    }

    return {
      ok: !hasFail,
      actionId: "cleaner.clean-all",
      command: `clean-all [${targetList.join(", ")}]`,
      output: logs.join("\n"),
      error: hasFail ? "部分清理任务执行时遇到警告或错误，详见输出" : null,
      durationMs: Date.now() - start,
    };
  },
};
