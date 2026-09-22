import { commandDetector } from "./utils/command-detector";
import type { Detector } from "./types";

export const baseToolDetectors: Detector[] = [
  commandDetector({
    id: "git",
    name: "Git",
    category: "base-tool",
    binaries: ["git"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/git version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "brew",
    name: "Homebrew",
    category: "base-tool",
    binaries: ["brew"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/Homebrew (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "gh",
    name: "GitHub CLI",
    category: "base-tool",
    binaries: ["gh"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/gh version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "ffmpeg",
    name: "FFmpeg",
    category: "base-tool",
    binaries: ["ffmpeg"],
    versionArgs: "-version",
    parseVersion: (out) => out.match(/ffmpeg version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "nginx",
    name: "Nginx",
    category: "base-tool",
    binaries: ["nginx"],
    versionArgs: "-v",
    parseVersion: (out) => out.match(/nginx\/(\S+)/)?.[1] ?? null,
  }),
];
