import fs from "node:fs/promises";
import path from "node:path";
import { run } from "@/lib/detectors/utils/shell";
import { exec } from "../exec";
import type { ActionExecutor } from "../types";
import {
  BREW_SERVICES_ALLOWED,
  requireParam,
  validateContainerId,
  validateImageRef,
} from "../validators";

/** 服务启停类动作：brew services / container / nginx */
export const serviceExecutors: Record<string, ActionExecutor> = {
  "brew.services.start": (p) =>
    exec("brew.services.start", `brew services start ${requireParam(p, "formula", BREW_SERVICES_ALLOWED)}`),
  "brew.services.stop": (p) =>
    exec("brew.services.stop", `brew services stop ${requireParam(p, "formula", BREW_SERVICES_ALLOWED)}`),
  "brew.services.restart": (p) =>
    exec("brew.services.restart", `brew services restart ${requireParam(p, "formula", BREW_SERVICES_ALLOWED)}`),

  "container.system.start": () =>
    exec("container.system.start", `container system start`, 90_000),
  "container.system.stop": () =>
    exec("container.system.stop", `container system stop`, 60_000),
  "container.prune": () =>
    exec("container.prune", `container prune -a 2>&1 || container prune`, 120_000, { okIfOutput: true }),
  "container.start-one": (p) =>
    exec("container.start-one", `container start ${validateContainerId(p)}`, 120_000),
  "container.stop-one": (p) =>
    exec("container.stop-one", `container stop ${validateContainerId(p)}`, 60_000),
  "container.rm": (p) =>
    exec("container.rm", `container delete ${validateContainerId(p)}`, 60_000),
  "container.image-rm": (p) =>
    exec("container.image-rm", `container image rm ${validateImageRef(p)}`, 60_000),

  "nginx.test": () => exec("nginx.test", `nginx -t`, 15_000, { okIfOutput: true }),
  "nginx.reload": async () => {
    const pgrep = await run("pgrep nginx", 5000);
    const isRunning = pgrep.ok && pgrep.stdout.trim().length > 0;
    if (!isRunning) {
      const startRes = await run("brew services start nginx 2>&1 || nginx", 15_000);
      const out = (startRes.stdout + (startRes.stderr ? `\n${startRes.stderr}` : "")).trim();
      return {
        ok: startRes.ok,
        actionId: "nginx.reload",
        command: "brew services start nginx",
        output: "Nginx 之前处于未运行状态，已自动为您启动服务:\n" + out,
        error: startRes.ok ? null : "Nginx 未运行且启动失败",
        durationMs: 0,
      };
    }
    return exec("nginx.reload", `nginx -s reload`, 20_000, { okIfOutput: true });
  },
  "nginx.save-conf": async (p) => {
    const start = Date.now();
    const file = p?.file?.trim();
    if (!file) throw new Error("未指定配置文件路径");
    const normalized = path.normalize(file);
    if (!normalized.startsWith("/opt/homebrew/etc/nginx") && !normalized.startsWith("/etc/nginx")) {
      throw new Error(`只能编辑 nginx 配置目录内的文件: ${file}`);
    }
    if (normalized.includes("..")) {
      throw new Error("非法路径");
    }
    const content = p?.content;
    if (typeof content !== "string") {
      throw new Error("缺少配置文件内容");
    }

    let originalContent: string | null = null;
    try {
      originalContent = await fs.readFile(normalized, "utf-8");
    } catch {
      // file might be newly created
    }

    try {
      await fs.writeFile(normalized, content, "utf-8");
      const testRes = await run("nginx -t", 15_000);
      const output = (testRes.stdout + (testRes.stderr ? `\n${testRes.stderr}` : "")).trim();
      if (!testRes.ok) {
        // Syntax test failed: rollback
        if (originalContent !== null) {
          await fs.writeFile(normalized, originalContent, "utf-8");
        } else {
          await fs.unlink(normalized).catch(() => {});
        }
        return {
          ok: false,
          actionId: "nginx.save-conf",
          command: `save ${normalized} && nginx -t`,
          output,
          error: `配置语法测试失败，已自动回滚:\n${output}`,
          durationMs: Date.now() - start,
        };
      }

      return {
        ok: true,
        actionId: "nginx.save-conf",
        command: `save ${normalized} && nginx -t`,
        output: `保存成功！语法校验通过:\n${output}`,
        error: null,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      if (originalContent !== null) {
        await fs.writeFile(normalized, originalContent, "utf-8").catch(() => {});
      }
      throw e;
    }
  },
};
