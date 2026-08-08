import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { AuthGate } from "@/app/components/AuthGate";
import { ThemeRegistry } from "@/app/theme-registry";

export const metadata: Metadata = {
  title: "Polaris",
  description: "根拠付き自己分析と、確認済みの経験・企業情報だけを使うES推敲を行う就活支援アプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      {/* ブラウザ拡張がbodyへ属性（cz-shortcut-listenなど）を挿し込むため、
          body自身の属性だけhydration差分の警告を抑止する。子要素の差分は従来どおり検出される */}
      <body suppressHydrationWarning>
        <ThemeRegistry>
          {/* 未ログイン時のログイン画面への誘導と、下部ナビの表示制御はAuthGateに集約する */}
          <AuthGate>{children}</AuthGate>
        </ThemeRegistry>
      </body>
    </html>
  );
}
