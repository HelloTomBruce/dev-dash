import { commandDetector } from "./utils/command-detector";
import type { Detector } from "./types";

export const databaseDetectors: Detector[] = [
  commandDetector({
    id: "psql",
    name: "PostgreSQL",
    category: "database",
    binaries: ["psql"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/psql \(PostgreSQL\) (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "mysql",
    name: "MySQL",
    category: "database",
    binaries: ["mysql"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/Ver (\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "sqlite",
    name: "SQLite",
    category: "database",
    binaries: ["sqlite3"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/(\d+(\.\d+)+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "redis",
    name: "Redis",
    category: "database",
    binaries: ["redis-server"],
    versionArgs: "--version",
    parseVersion: (out) => out.match(/v=(\S+)/)?.[1] ?? null,
  }),
  commandDetector({
    id: "mongo",
    name: "MongoDB Shell",
    category: "database",
    binaries: ["mongosh"],
    versionArgs: "--version",
  }),
];
