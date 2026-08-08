"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";

interface TutorialCelebrationProps {
  open: boolean;
  lines: string[];
  durationMs?: number;
  onClose: () => void;
}

const CONFETTI_COLORS = [CHAT_COLORS.orange, "#FFFFFF", "#7FD1FF", "#FFB6E1"];

// 経験カード1枚目完成・自己分析スタート時の軽い成功演出。
// チェックマーク＋小さな紙吹雪程度に留め、演出のために操作を止めない
// （一定時間で自動的に消える。タップでも早く閉じられる）
export function TutorialCelebration({ open, lines, durationMs = 3200, onClose }: TutorialCelebrationProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(0,0,0,0.35)",
        cursor: "pointer",
      }}
    >
      <Box sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              top: "-8%",
              left: `${(i * 37) % 100}%`,
              width: 7,
              height: 7,
              borderRadius: i % 2 === 0 ? "50%" : "2px",
              bgcolor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `tutorial-confetti-fall ${1.6 + (i % 5) * 0.25}s ease-in ${(i % 6) * 0.08}s forwards`,
              "@keyframes tutorial-confetti-fall": {
                from: { transform: "translateY(0) rotate(0deg)", opacity: 1 },
                to: { transform: `translateY(70vh) rotate(${360 + i * 20}deg)`, opacity: 0 },
              },
            }}
          />
        ))}
      </Box>

      <Box
        sx={{
          maxWidth: 320,
          mx: 2,
          px: 3,
          py: 2.5,
          borderRadius: 4,
          textAlign: "center",
          bgcolor: CHAT_COLORS.aiBubble,
          color: CHAT_COLORS.bubbleText,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          animation: "tutorial-celebration-pop .32s cubic-bezier(.34,1.56,.64,1)",
          "@keyframes tutorial-celebration-pop": {
            from: { transform: "scale(0.85)", opacity: 0 },
            to: { transform: "scale(1)", opacity: 1 },
          },
        }}
      >
        {lines.map((line) => (
          <Typography key={line} variant="body1" sx={{ fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.7 }}>
            {line}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
