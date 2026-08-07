"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

import NextAppDirEmotionCacheProvider from "./emotion-cache";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#173f6f" },
    secondary: { main: "#138879" },
    background: { default: "#f5f3ed", paper: "#ffffff" },
  },
  typography: {
    fontFamily: '"Yu Gothic UI", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
  },
  shape: { borderRadius: 10 },
});

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
