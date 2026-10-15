import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export const metadata: Metadata = {
  title: "DevDash - 本地开发环境仪表盘",
  description: "一眼看清本机所有开发工具、版本与健康状态",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={cn("h-full", "antialiased", GeistSans.variable, GeistMono.variable, "font-sans")}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
