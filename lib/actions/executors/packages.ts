import { exec } from "../exec";
import type { ActionExecutor } from "../types";
import {
  validateBrewPackage,
  validateExactVersion,
  validateNpmName,
  validatePypiName,
  validatePythonVersion,
  validateVersion,
} from "../validators";
import { getNpmGlobal, getPnpmGlobal, getUvPythons, getUvTools } from "../caches";

/** 包管理与工具链升级/安装类动作：brew / node / npm / pnpm / pip / uv / rust / gem */
export const packageExecutors: Record<string, ActionExecutor> = {
  // ---- brew ----
  "brew.update": () => exec("brew.update", `brew update`, 120_000),
  "brew.upgrade-all": () => exec("brew.upgrade-all", `brew upgrade`, 600_000, { okIfOutput: true }),
  "brew.upgrade": async (p) =>
    exec("brew.upgrade", `brew upgrade ${await validateBrewPackage(p, "formula")}`, 300_000, { okIfOutput: true }),
  "brew.upgrade-cask": async (p) =>
    exec("brew.upgrade-cask", `brew upgrade --cask ${await validateBrewPackage(p, "cask")}`, 300_000, { okIfOutput: true }),
  "brew.uninstall": async (p) =>
    exec("brew.uninstall", `brew uninstall ${await validateBrewPackage(p, "formula")}`, 120_000),
  "brew.cleanup": () => exec("brew.cleanup", `brew cleanup`, 180_000),
  "brew.doctor": () => exec("brew.doctor", `brew doctor`, 90_000, { okIfOutput: true }),
  "brew.outdated": () => exec("brew.outdated", `brew outdated`, 60_000, { okIfOutput: true }),

  // ---- node / n / npm / pnpm ----
  "npm.outdated": () => exec("npm.outdated", `npm outdated -g --depth=0`, 60_000, { okIfOutput: true }),
  "npm.update-g-all": () => exec("npm.update-g-all", `npm update -g`, 600_000),
  "npm.install-g": (p) =>
    exec("npm.install-g", `npm install -g ${validateNpmName(p)}@latest`, 300_000),
  "npm.update-g": async (p) => {
    const pkg = validateNpmName(p);
    const installed = await getNpmGlobal();
    if (!installed.has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("npm.update-g", `npm install -g ${pkg}@latest`, 300_000);
  },
  "npm.uninstall-g": async (p) => {
    const pkg = validateNpmName(p);
    const installed = await getNpmGlobal();
    if (!installed.has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("npm.uninstall-g", `npm uninstall -g ${pkg}`, 120_000);
  },
  "n.install-lts": () => exec("n.install-lts", `n lts`, 300_000),
  "n.install-latest": () => exec("n.install-latest", `n latest`, 300_000),
  "n.prune": () => exec("n.prune", `n prune`, 60_000),
  "n.install-version": (p) =>
    exec("n.install-version", `n ${validateVersion(p)}`, 300_000),
  "n.use": (p) => exec("n.use", `n ${validateVersion(p)}`, 120_000),
  "n.rm": (p) => exec("n.rm", `n rm ${validateExactVersion(p)}`, 60_000),
  "pnpm.outdated": () => exec("pnpm.outdated", `pnpm outdated -g`, 60_000, { okIfOutput: true }),
  "pnpm.update-g-all": () => exec("pnpm.update-g-all", `pnpm update -g`, 600_000),
  "pnpm.install-g": (p) =>
    exec("pnpm.install-g", `pnpm add -g ${validateNpmName(p)}@latest`, 300_000),
  "pnpm.update-g": async (p) => {
    const pkg = validateNpmName(p);
    if (!(await getPnpmGlobal()).has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("pnpm.update-g", `pnpm update -g ${pkg}@latest`, 300_000);
  },
  "pnpm.uninstall-g": async (p) => {
    const pkg = validateNpmName(p);
    if (!(await getPnpmGlobal()).has(pkg)) throw new Error(`未全局安装的包: ${pkg}`);
    return exec("pnpm.uninstall-g", `pnpm remove -g ${pkg}`, 120_000);
  },
  "pnpm.store-prune": () => exec("pnpm.store-prune", `pnpm store prune`, 300_000, { okIfOutput: true }),

  // ---- pip / uv ----
  "pip.outdated": () =>
    exec("pip.outdated", `pip3 list --outdated --disable-pip-version-check`, 60_000, { okIfOutput: true }),
  "uv.tool-upgrade-all": () => exec("uv.tool-upgrade-all", `uv tool upgrade --all`, 300_000, { okIfOutput: true }),
  "uv.tool-upgrade": async (p) => {
    const name = validatePypiName(p);
    if (!(await getUvTools()).has(name)) throw new Error(`未安装的 uv 工具: ${name}`);
    return exec("uv.tool-upgrade", `uv tool upgrade ${name}`, 300_000, { okIfOutput: true });
  },
  "uv.tool-uninstall": async (p) => {
    const name = validatePypiName(p);
    if (!(await getUvTools()).has(name)) throw new Error(`未安装的 uv 工具: ${name}`);
    return exec("uv.tool-uninstall", `uv tool uninstall ${name}`, 60_000);
  },
  "uv.tool-install": (p) =>
    exec("uv.tool-install", `uv tool install ${validatePypiName(p)}`, 300_000),
  "uv.python-install": (p) =>
    exec("uv.python-install", `uv python install ${validatePythonVersion(p)}`, 600_000),
  "uv.python-uninstall": async (p) => {
    const v = validatePythonVersion(p);
    if (!/^\d+\.\d+\.\d+$/.test(v)) {
      throw new Error(`卸载需要完整版本号（x.y.z）: ${v}`);
    }
    if (!(await getUvPythons()).has(v)) throw new Error(`未安装的 Python: ${v}`);
    return exec("uv.python-uninstall", `uv python uninstall ${v}`, 60_000);
  },

  // ---- rust / rubygems ----
  "rustup.update": () => exec("rustup.update", `rustup update`, 600_000, { okIfOutput: true }),
  "gem.update-system": () => exec("gem.update-system", `gem update --system`, 300_000),
};
