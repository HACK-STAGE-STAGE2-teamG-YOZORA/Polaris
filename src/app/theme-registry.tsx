"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

import NextAppDirEmotionCacheProvider from "./emotion-cache";

// 現時点ではFigmaデザイン未確定のため既定テーマをそのまま使う。
// デザイン確定後はここでブランドカラー・タイポグラフィを差し替えれば、
// 各画面のコンポーネントを個別に直さずに反映できる。
const theme = createTheme();

export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    // App RouterでのSSR時、Emotionが挿入するスタイルのdata-emotion属性が
    // サーバー/クライアント間でずれてHydration mismatchが起きるのを防ぐため、
    // MUI公式手順に沿ってEmotionキャッシュをuseServerInsertedHTML経由で共有する
    <NextAppDirEmotionCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </NextAppDirEmotionCacheProvider>
  );
}
