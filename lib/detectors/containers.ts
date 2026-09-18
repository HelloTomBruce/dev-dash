import { commandDetector } from "./utils/command-detector";
import type { Detector } from "./types";

export const containerDetectors: Detector[] = [
  commandDetector({
    id: "apple-container",
    name: "Apple Container",
    category: "container",
    binaries: ["container"],
    parseVersion: (out) => out.match(/container CLI version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "docker",
    name: "Docker",
    category: "container",
    binaries: ["docker"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/Docker version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "podman",
    name: "Podman",
    category: "container",
    binaries: ["podman"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/podman version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "colima",
    name: "Colima",
    category: "container",
    binaries: ["colima"],
    versionArgs: "version",
    parseVersion: (out) => out.match(/colima version (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "kubectl",
    name: "kubectl",
    category: "container",
    binaries: ["kubectl"],
    versionArgs: "version --client",
    parseVersion: (out) => out.match(/GitVersion:"v?([^"]+)"/)?.[1] ?? null,
  }),
];
