"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { NDetailPanel } from "@/components/panels/n-panel";
import { PsqlDetailPanel } from "@/components/panels/psql-panel";
import { RedisDetailPanel } from "@/components/panels/redis-panel";

export default function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (id === "n") return <NDetailPanel />;
  if (id === "psql") return <PsqlDetailPanel />;
  if (id === "redis") return <RedisDetailPanel />;
  return <GenericDetail id={id} />;
}

function GenericDetail({ id }: { id: string }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← 返回仪表盘
      </Link>
      <div className="mt-12 text-center">
        <p className="text-lg font-semibold text-zinc-300">{id}</p>
        <p className="mt-2 text-sm text-zinc-500">
          该工具暂无专属详情页。目前已有：
          <code className="text-emerald-400">/tools/n</code>、
          <code className="text-emerald-400">/tools/psql</code>、
          <code className="text-emerald-400">/tools/redis</code>
        </p>
      </div>
    </main>
  );
}
