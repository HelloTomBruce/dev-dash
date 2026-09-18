import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevDash - 本地开发环境仪表盘",
  description: "一眼看清本机所有开发工具、版本与健康状态",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
