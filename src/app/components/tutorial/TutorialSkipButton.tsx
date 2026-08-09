"use client";

import Button from "@mui/material/Button";

interface TutorialSkipButtonProps {
  onSkip: () => void;
}

// チュートリアル表示中だけ右上に出す小さな「スキップ」。誤操作しても実害が小さいよう
// 目立たせすぎない見た目にする。押すと以後は自動表示しなくなる
export function TutorialSkipButton({ onSkip }: TutorialSkipButtonProps) {
  return (
    <Button
      onClick={onSkip}
      size="small"
      sx={{
        position: "fixed",
        top: "max(10px, env(safe-area-inset-top))",
        right: 10,
        zIndex: 1400,
        minWidth: 0,
        px: 1.25,
        py: 0.5,
        fontSize: 12,
        color: "rgba(255,255,255,0.75)",
        bgcolor: "rgba(0,0,0,0.35)",
        borderRadius: "999px",
        textTransform: "none",
        "&:hover": { bgcolor: "rgba(0,0,0,0.55)" },
      }}
    >
      スキップ
    </Button>
  );
}
