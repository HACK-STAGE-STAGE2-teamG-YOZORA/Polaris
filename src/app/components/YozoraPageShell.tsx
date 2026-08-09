import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { Constellation } from "@/app/components/Constellation";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

interface YozoraPageShellProps {
  section: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

// Homeの夜空と560pxカラムを、認証後の各機能画面へ引き継ぐ共通シェル。
// YOZORAはプロダクト名polarisより控えめなチーム署名として扱い、
// 既存のConstellationを画面ごとの道標として再利用する。
export function YozoraPageShell({
  section,
  title,
  description,
  children,
}: YozoraPageShellProps) {
  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100dvh",
        // overflow: hidden はChat内のsticky操作を無効化するため、スクロールコンテナを作らないclipを使う
        overflow: "clip",
        pb: "calc(88px + env(safe-area-inset-bottom))",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, ${CHAT_COLORS.gradientMid} 46%, ${CHAT_COLORS.gradientBottom} 100%)`,
        "&::before": {
          content: '""',
          position: "absolute",
          zIndex: -1,
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle at 14% 9%, rgba(255,255,255,.6) 0 1px, transparent 1.5px), radial-gradient(circle at 82% 24%, rgba(255,255,255,.45) 0 1px, transparent 1.5px), radial-gradient(circle at 72% 53%, rgba(255,247,0,.34) 0 1px, transparent 1.5px)",
          backgroundSize: "170px 170px, 230px 230px, 290px 290px",
        },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: { xs: 2.5, sm: 3 } }}>
        <Box component="header" sx={{ mb: 3 }}>
          <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ pt: 0.5 }}>
              <Typography
                sx={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 30,
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                polaris
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 1,
                  color: CHAT_COLORS.orange,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                }}
              >
                ✦ YOZORA / {section}
              </Typography>
            </Box>
            <Constellation size={76} />
          </Stack>

          <Typography
            component="h1"
            sx={{ mt: 2, mb: 0.75, fontSize: { xs: 28, sm: 30 }, fontWeight: 400, letterSpacing: "0.08em" }}
          >
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" component="div" sx={{ maxWidth: 480, color: CHAT_COLORS.textOnDarkMuted, lineHeight: 1.8 }}>
              {description}
            </Typography>
          )}
        </Box>

        {children}
      </Box>
    </Box>
  );
}
