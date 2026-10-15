"use client";

import { useCallback, useState } from "react";

/** 剪贴板复制 + 1.5s 的「已复制」提示状态 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  return { copied, handleCopy };
}
