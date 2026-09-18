import { run } from "@/lib/detectors/utils/shell";
import type { InventoryItem } from "./meta";

export type InventoryListFn = () => Promise<InventoryItem[]>;

function lines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** npm 全局包 */
const npmGlobal: InventoryListFn = async () => {
  const res = await run(`npm ls -g --depth=0 --json`, 20000);
  const json = JSON.parse(res.stdout.trim());
  return Object.entries(json.dependencies ?? {}).map(([name, info]) => ({
    name,
    version: (info as { version?: string }).version ?? null,
  }));
};

/** pnpm 全局包（树形输出：├── name 1.2.3） */
const pnpmGlobal: InventoryListFn = async () => {
  const res = await run(`pnpm ls -g --depth=0`, 20000);
  return lines(res.stdout)
    .map((l) => l.replace(/^[├└│─\s]+/, ""))
    .map((l) => l.match(/^([@\w./-]+)\s+(\d+\.\d+\.\d+)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1], version: m[2] }));
};

/** yarn 1.x 全局包（info "name@version"） */
const yarnGlobal: InventoryListFn = async () => {
  const res = await run(`yarn global list --depth=0`, 20000);
  return lines(res.stdout)
    .map((l) => l.match(/"(.+)@([^"]+)"/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1], version: m[2] }));
};

/** pip 已装的 Python 包 */
const pipList: InventoryListFn = async () => {
  const res = await run(
    `pip3 list --format=json --disable-pip-version-check 2>/dev/null || pip list --format=json --disable-pip-version-check`,
    30000
  );
  const arr = JSON.parse(res.stdout.trim()) as Array<{
    name: string;
    version: string;
  }>;
  return arr.map((p) => ({ name: p.name, version: p.version }));
};

/** uv tool install 的工具（含二进制名） */
const uvTools: InventoryListFn = async () => {
  const res = await run(`uv tool list`, 20000);
  const items: InventoryItem[] = [];
  let bins: string[] = [];
  for (const l of lines(res.stdout)) {
    const m = l.match(/^(\S+)\s+v(\S+)$/);
    if (m) {
      if (items.length > 0) items[items.length - 1].note = bins.join(", ");
      bins = [];
      items.push({ name: m[1], version: m[2] });
    } else if (l.startsWith("- ") && items.length > 0) {
      bins.push(l.slice(2));
    }
  }
  if (items.length > 0) items[items.length - 1].note = bins.join(", ");
  return items;
};

/** uv 管理的 Python 解释器（去重） */
const uvPython: InventoryListFn = async () => {
  const res = await run(`uv python list --only-installed`, 20000);
  const seen = new Set<string>();
  const items: InventoryItem[] = [];
  for (const l of lines(res.stdout)) {
    const [name, ...rest] = l.split(/\s+/);
    const m = name.match(/^(cpython|pypy)-(\d+\.\d+\.\d+)/);
    if (!m || seen.has(name)) continue;
    seen.add(name);
    items.push({ name: m[2], version: m[2], note: rest[0] ?? null });
  }
  return items;
};

/** Homebrew 已装（formula + cask） */
const brewList: InventoryListFn = async () => {
  const [f, c] = await Promise.all([
    run(`brew list --versions`, 30000),
    run(`brew list --cask --versions`, 30000),
  ]);
  const parse = (s: string, kind: string) =>
    lines(s)
      .map((l) => l.match(/^(\S+)\s+(\S+)/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ name: m[1], version: m[2], note: kind }));
  return [...parse(f.stdout, "formula"), ...parse(c.stdout, "cask")];
};

/** cargo install 的 crate */
const cargoList: InventoryListFn = async () => {
  const res = await run(`cargo install --list`, 30000);
  return lines(res.stdout)
    .map((l) => l.match(/^(\S+)\s+v(\S+):$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1], version: m[2] }));
};

/** n 管理的 Node 版本 */
const nVersions: InventoryListFn = async () => {
  const res = await run(`n ls`, 15000);
  return lines(res.stdout)
    .map((l) => l.match(/node\/(\S+)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: `Node ${m[1]}`, version: m[1] }));
};

/** nvm 管理的版本（shell 函数，需要交互式登录 shell） */
const nvmVersions: InventoryListFn = async () => {
  const res = await run(`/bin/zsh -ilc 'nvm ls --no-colors'`, 20000);
  return lines(res.stdout)
    .map((l): InventoryItem | null => {
      const current = l.trim().startsWith("->");
      const m = l.match(/v(\d+\.\d+\.\d+)/);
      return m ? { name: m[1], version: m[1], note: current ? "当前" : null } : null;
    })
    .filter((x): x is InventoryItem => x !== null);
};

/** pyenv 管理的 Python 版本 */
const pyenvVersions: InventoryListFn = async () => {
  const res = await run(`pyenv versions`, 15000);
  return lines(res.stdout)
    .map((l): InventoryItem | null => {
      const current = l.startsWith("*");
      const m = l.replace(/^\*/, "").trim().match(/^(\S+)/);
      return m
        ? { name: m[1], version: m[1], note: current ? "当前" : null }
        : null;
    })
    .filter((x): x is InventoryItem => x !== null);
};

export const inventoryProviders: Record<string, InventoryListFn> = {
  "npm-global": npmGlobal,
  "pnpm-global": pnpmGlobal,
  "yarn-global": yarnGlobal,
  pip: pipList,
  "uv-tools": uvTools,
  "uv-python": uvPython,
  brew: brewList,
  cargo: cargoList,
  "n-versions": nVersions,
  "nvm-versions": nvmVersions,
  "pyenv-versions": pyenvVersions,
};
