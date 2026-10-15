"use client";

import { useMemo } from "react";
import { GH_ACTION_META } from "@/lib/gh/action-meta";
import {
  useActionRunnerCore,
  type ActionRunnerConfig,
} from "@/components/panels/use-action-core";

/** gh 写动作执行 hook（共用面板动作核心，仅注入 gh 的接口与文案） */
export function useGhActionRunner(onSuccess?: () => void | Promise<void>) {
  const config = useMemo<ActionRunnerConfig>(
    () => ({
      endpoint: "/api/gh/action",
      levelOf: (id) => GH_ACTION_META[id]?.level ?? "safe",
      dangerousHint: "该操作不可逆，确认继续？",
    }),
    []
  );
  return useActionRunnerCore(config, onSuccess);
}
