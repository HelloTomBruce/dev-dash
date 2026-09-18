import type { Detector } from "./types";
import { runtimeDetectors } from "./runtimes";
import { versionManagerDetectors } from "./version-managers";
import { packageManagerDetectors } from "./package-managers";
import { containerDetectors } from "./containers";
import { databaseDetectors } from "./databases";
import { baseToolDetectors } from "./base-tools";

export const detectors: Detector[] = [
  ...runtimeDetectors,
  ...versionManagerDetectors,
  ...packageManagerDetectors,
  ...containerDetectors,
  ...databaseDetectors,
  ...baseToolDetectors,
];
