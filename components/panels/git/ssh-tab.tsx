"use client";

import { CheckIcon, CircleIcon, ClipboardTextIcon, LockKeyIcon } from "@phosphor-icons/react";
import type { SshKeyInfo } from "@/lib/git/types";

/** 「SSH 密钥与凭据」标签页 */
export function SshTab({
  sshAgentRunning,
  sshKeys,
  copied,
  onCopy,
  onTestSsh,
}: {
  sshAgentRunning: boolean;
  sshKeys: SshKeyInfo[];
  copied: string | null;
  onCopy: (text: string, label?: string) => void;
  onTestSsh: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <h3 className="font-semibold text-sm text-zinc-200 flex items-center gap-2">
            <LockKeyIcon size={16} className="text-zinc-400" /> SSH Agent 状态:{" "}
            {sshAgentRunning ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CircleIcon size={8} weight="fill" /> 运行中
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-400">
                <CircleIcon size={8} weight="fill" className="text-zinc-600" /> 未运行
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            扫描目录: ~/.ssh/ 下的所有公钥文件，可直接复制公钥快速配置到 GitHub / GitLab
          </p>
        </div>
        <button
          onClick={onTestSsh}
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
        >
          测试 GitHub 连接
        </button>
      </div>

      <div className="space-y-3">
        {sshKeys.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">
            未在 ~/.ssh 目录下检测到 .pub 公钥文件
          </div>
        ) : (
          sshKeys.map((k: SshKeyInfo) => (
            <div
              key={k.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-100">
                      {k.filename}
                    </span>
                    <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 text-[10px] text-emerald-400 font-mono">
                      {k.keyType} {k.bits ? `(${k.bits} bits)` : ""}
                    </span>
                    {k.isLoadedInAgent && (
                      <span className="rounded bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 text-[10px]">
                        Agent 已加载
                      </span>
                    )}
                  </div>
                  {k.comment && (
                    <p className="text-xs text-zinc-400">
                      备注 / 关联邮箱: <span className="font-mono text-zinc-300">{k.comment}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-500 font-mono">
                    指纹: {k.fingerprint}
                  </p>
                </div>

                <button
                  onClick={() => onCopy(k.publicKey, "已复制公钥内容")}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors shrink-0"
                >
                  {copied === k.publicKey ? (
                    <>
                      <CheckIcon size={12} weight="bold" /> 已复制
                    </>
                  ) : (
                    <>
                      <ClipboardTextIcon size={12} /> 复制公钥
                    </>
                  )}
                </button>
              </div>

              {/* 公钥预览 */}
              <div className="rounded bg-zinc-950/80 border border-zinc-800/60 p-2.5 text-[11px] font-mono text-zinc-400 break-all select-all">
                {k.publicKey}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
