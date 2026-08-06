'use client';

import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import type { ReactNode } from 'react';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#173f6f' },
    secondary: { main: '#138879' },
    background: { default: '#f5f3ed', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Yu Gothic UI", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
  },
  shape: { borderRadius: 10 },
});

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}
