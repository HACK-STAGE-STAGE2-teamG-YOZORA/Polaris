import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeRegistry } from "@/app/theme-registry";

export const metadata: Metadata = {
  title: "Polaris",
  description: "根拠付き自己分析と、確認済みの経験・企業情報だけを使うES推敲を行う就活支援アプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
