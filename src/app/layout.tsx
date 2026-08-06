import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Polaris",
  description: "根拠付き自己分析と、確認済みの経験・企業情報だけを使うES推敲を行う就活支援アプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
