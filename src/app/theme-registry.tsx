"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

// 現時点ではFigmaデザイン未確定のため既定テーマをそのまま使う。
// デザイン確定後はここでブランドカラー・タイポグラフィを差し替えれば、
// 各画面のコンポーネントを個別に直さずに反映できる。
const theme = createTheme();

export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
