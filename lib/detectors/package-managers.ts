import { commandDetector } from "./utils/command-detector";
import type { Detector } from "./types";

export const packageManagerDetectors: Detector[] = [
  commandDetector({
    id: "npm",
    name: "npm",
    category: "package-manager",
    binaries: ["npm"],
  }),
  commandDetector({
    id: "pnpm",
    name: "pnpm",
    category: "package-manager",
    binaries: ["pnpm"],
  }),
  commandDetector({
    id: "yarn",
    name: "Yarn",
    category: "package-manager",
    binaries: ["yarn"],
    parseVersion: (out) => out.match(/(\d+(\.\d+)+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "pip",
    name: "pip",
    category: "package-manager",
    binaries: ["pip3", "pip"],
    parseVersion: (out) => out.match(/pip\s+(\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "uv",
    name: "uv",
    category: "package-manager",
    binaries: ["uv"],
    parseVersion: (out) => out.match(/uv\s+(\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "pipx",
    name: "pipx",
    category: "package-manager",
    binaries: ["pipx"],
  }),
  commandDetector({
    id: "cargo",
    name: "Cargo",
    category: "package-manager",
    binaries: ["cargo"],
    parseVersion: (out) => out.match(/cargo\s+(\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "gem",
    name: "RubyGems",
    category: "package-manager",
    binaries: ["gem"],
  }),
  commandDetector({
    id: "composer",
    name: "Composer",
    category: "package-manager",
    binaries: ["composer"],
  }),
];
