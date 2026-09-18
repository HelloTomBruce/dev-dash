import { commandDetector } from "./utils/command-detector";
import type { Detector } from "./types";

export const runtimeDetectors: Detector[] = [
  commandDetector({
    id: "node",
    name: "Node.js",
    category: "runtime",
    binaries: ["node"],
    versionArgs: "--version",
  }),
  commandDetector({
    id: "python",
    name: "Python",
    category: "runtime",
    binaries: ["python3", "python"],
    versionArgs: "--version",
  }),
  commandDetector({
    id: "go",
    name: "Go",
    category: "runtime",
    binaries: ["go"],
    versionArgs: "version",
    parseVersion: (out) => out.match(/go version go(\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "rust",
    name: "Rust",
    category: "runtime",
    binaries: ["rustc"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/rustc\s+(\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "java",
    name: "Java",
    category: "runtime",
    binaries: ["java"],
    versionArgs: "-version",
    // java -version 输出到 stderr，且可能多行（含运行时信息）
    parseVersion: (out) =>
      out.match(/version "([^"]+)"/)?.[1] ??
      out.match(/(\d+(\.\d+)+)/)?.[1] ??
      null,
  }),
  commandDetector({
    id: "bun",
    name: "Bun",
    category: "runtime",
    binaries: ["bun"],
  }),
  commandDetector({
    id: "deno",
    name: "Deno",
    category: "runtime",
    binaries: ["deno"],
  }),
];
