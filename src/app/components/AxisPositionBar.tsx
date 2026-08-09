"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AxisLabel } from "@/shared/self-analysis/axis-labels";

interface AxisPositionBarProps {
  label: AxisLabel;
  // レイアウト専用のパーセント位置。nullなら位置を描かず、代わりにpositionTextをバー上に出す
  // （docs/screen-api-map.md「CONTEXT_DEPENDENTは中央点へ潰さず...INSUFFICIENT_EVIDENCEは位置を描かない」）
  percent: number | null;
  positionText: string;
}

// 軸1本分の左右ラベル＋位置ドットのバー。Home（総合傾向）とセッション単体の
// 自己分析結果の両方で見た目を揃えるために共通化する
export function AxisPositionBar({ label, percent, positionText }: AxisPositionBarProps) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "82px minmax(80px, 1fr) 82px", alignItems: "center", gap: 1 }}>
      <Box>
        <Typography sx={{ fontSize: 16, letterSpacing: "0.12em", lineHeight: 1.25, color: CHAT_COLORS.orange }}>{label.left}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 18, lineHeight: 1.25, color: CHAT_COLORS.orange }}>{label.leftJa}</Typography>
      </Box>
      <Box sx={{ position: "relative", height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ width: "100%", height: 4, borderRadius: 999, bgcolor: "rgba(255,255,255,0.92)" }} />
        {percent !== null ? (
          <Box
            sx={{
              position: "absolute",
              left: `calc(${percent}% - 11px)`,
              width: 22,
              height: 22,
              borderRadius: "50%",
              bgcolor: "#F6C95D",
              boxShadow: "0 1px 5px rgba(0,0,0,.35)",
            }}
          />
        ) : (
          <Typography
            sx={{
              position: "absolute",
              fontSize: 13,
              px: 1,
              borderRadius: 1,
              bgcolor: "rgba(0,0,0,0.45)",
              color: CHAT_COLORS.textOnDark,
            }}
          >
            {positionText}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontSize: 16, letterSpacing: "0.12em", lineHeight: 1.25, color: CHAT_COLORS.orange }}>{label.right}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 18, lineHeight: 1.25, color: CHAT_COLORS.orange }}>{label.rightJa}</Typography>
      </Box>
    </Box>
  );
}
