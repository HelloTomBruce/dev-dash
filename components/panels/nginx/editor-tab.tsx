"use client";

import {
  FolderOpenIcon,
  FloppyDiskIcon,
  ArrowsClockwiseIcon,
  CircleIcon,
} from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConfigFileInfo } from "@/lib/nginx/types";

/** 「配置文件」标签页：文件选择 + 编辑器 + 保存（保存逻辑由父级持有） */
export function EditorTab({
  configFiles,
  selectedFile,
  onChangeFile,
  fileContent,
  onChangeFileContent,
  fileLoading,
  saveStatus,
  isDirty,
  onSave,
  onOpenDir,
}: {
  configFiles: ConfigFileInfo[];
  selectedFile: string;
  onChangeFile: (path: string) => void;
  fileContent: string;
  onChangeFileContent: (content: string) => void;
  fileLoading: boolean;
  saveStatus: { ok: boolean; msg: string } | null;
  isDirty: boolean;
  onSave: (andReload: boolean) => void;
  onOpenDir: () => void;
}) {
  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">选择文件:</label>
          <Select value={selectedFile} onValueChange={(val) => onChangeFile(val ?? "")}>
            <SelectTrigger className="h-8 min-w-[220px] border-zinc-700 bg-zinc-950 text-xs text-zinc-200">
              <SelectValue placeholder="选择文件…" />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-zinc-800 bg-zinc-950 text-xs text-zinc-200">
              {configFiles.map((f) => (
                <SelectItem key={f.path} value={f.path}>
                  {f.relPath} ({Math.round((f.size / 1024) * 10) / 10} KB)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDir}
            className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            <FolderOpenIcon size={13} /> 打开所在目录
          </button>
          <button
            disabled={fileLoading || !isDirty}
            onClick={() => onSave(false)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            <FloppyDiskIcon size={13} /> 保存配置
          </button>
          <button
            disabled={fileLoading || !isDirty}
            onClick={() => onSave(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            <ArrowsClockwiseIcon size={13} weight="bold" /> 保存并重载
          </button>
        </div>
      </div>

      {saveStatus && (
        <div
          className={`mt-3 rounded-lg border p-2.5 text-xs font-mono ${
            saveStatus.ok
              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
              : "border-red-500/30 bg-red-950/30 text-red-300"
          }`}
        >
          {saveStatus.msg}
        </div>
      )}

      <div className="mt-4 relative">
        {fileLoading ? (
          <div className="h-96 flex items-center justify-center text-xs text-zinc-500">
            加载中...
          </div>
        ) : (
          <textarea
            value={fileContent}
            onChange={(e) => onChangeFileContent(e.target.value)}
            spellCheck={false}
            className="h-[500px] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500 focus:outline-none"
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          {isDirty ? (
            <span className="flex items-center gap-1 text-amber-400">
              <CircleIcon size={8} weight="fill" /> 存在未保存修改
            </span>
          ) : (
            "与磁盘文件一致"
          )}
        </span>
        <span>保存时将自动执行 nginx -t 语法校验并具备防炸机回滚机制</span>
      </div>
    </section>
  );
}
