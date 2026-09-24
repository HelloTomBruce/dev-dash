import { commandDetector } from "./utils/command-detector";
import { run } from "./utils/shell";
import { detectSource } from "./utils/source";
import type { Detector } from "./types";

/**
 * nvm 是 shell 函数而非可执行文件，普通 exec 找不到，
 * 必须通过交互式登录 shell（zsh -ilc）检测。
 */
const nvmDetector: Detector = {
  id: "nvm",
  name: "nvm",
  category: "version-manager",
  async detect() {
    const res = await run(
      `/bin/zsh -ilc 'command -v nvm >/dev/null 2>&1 && echo FOUND && nvm --version'`,
      10000
    );
    const out = res.stdout.trim();
    const m = out.match(/FOUND\n?([\s\S]*)/);
    if (!m) {
      return {
        id: "nvm",
        name: "nvm",
        category: "version-manager" as const,
        status: "not-found" as const,
        version: null,
        path: null,
        source: null,
        raw: null,
        error: null,
        outdated: null,
      };
    }
    const version = m[1].trim().split("\n").pop()?.trim() ?? null;
    return {
      id: "nvm",
      name: "nvm",
      category: "version-manager" as const,
      status: "ok" as const,
      version: version || "unknown",
      path: `${process.env.HOME ?? ""}/.nvm`,
      source: detectSource(`${process.env.HOME ?? ""}/.nvm/nvm.sh`),
      raw: out.slice(0, 500),
      error: null,
      outdated: null,
    };
  },
};

export const versionManagerDetectors: Detector[] = [
  commandDetector({
    id: "n",
    name: "n",
    category: "version-manager",
    binaries: ["n"],
  }),
  nvmDetector,
  commandDetector({
    id: "pyenv",
    name: "pyenv",
    category: "version-manager",
    binaries: ["pyenv"],
  }),
  commandDetector({
    id: "mise",
    name: "mise",
    category: "version-manager",
    binaries: ["mise"],
  }),
  commandDetector({
    id: "asdf",
    name: "asdf",
    category: "version-manager",
    binaries: ["asdf"],
  }),
];
