"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";

type AdvanceMode = "click" | "auto" | "none";

interface TutorialHintProps {
  // このヒントを今出してよいか。falseの間は何もマウントしない
  open: boolean;
  // 強調したい要素のCSSセレクタ。省略時はスポットライトなしで吹き出しだけ画面上部に出す
  selector?: string;
  message: string;
  advanceOn?: AdvanceMode;
  // advanceOn="auto"のときの表示時間(ms)
  autoAdvanceMs?: number;
  onAdvance?: () => void;
  // selector指定があるのに要素が見つからないまま一定時間経過したときに呼ぶ
  // （そのステップの対象UIが今回は表示されない＝スキップしてよい合図として使う）
  onTargetMissing?: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TARGET_SEARCH_TIMEOUT_MS = 2500;
const TARGET_POLL_INTERVAL_MS = 150;
const SPOTLIGHT_PADDING = 8;

// スポットライト＋小さい吹き出し方式のチュートリアル表示。
// 既存DOMの外側から`selector`で対象を探すだけなので、対象コンポーネント側は
// data-tutorial属性を1つ足すだけで組み込める。
//
// 通常操作を妨げないよう、オーバーレイ自体はpointer-events:noneにして、
// 対象要素へのクリックはそのまま素通りさせる。advanceOn="click"は
// document側でクリックを監視して次のstepへ進めるためだけに使う
export function TutorialHint({
  open,
  selector,
  message,
  advanceOn = "none",
  autoAdvanceMs = 3200,
  onAdvance,
  onTargetMissing,
}: TutorialHintProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const advancedRef = useRef(false);

  // 対象要素を探し、見つかったらスクロール・リサイズに追従して位置を更新し続ける
  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    advancedRef.current = false;

    if (!selector) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let found = false;
    const startedAt = Date.now();

    const updateRect = () => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return false;
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
      return true;
    };

    const poll = window.setInterval(() => {
      if (cancelled) return;
      if (!found) {
        found = updateRect();
        if (!found && Date.now() - startedAt > TARGET_SEARCH_TIMEOUT_MS) {
          window.clearInterval(poll);
          onTargetMissing?.();
        }
        return;
      }
      updateRect();
    }, TARGET_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTargetMissingは毎回同一の意味で使う
  }, [open, selector]);

  // advanceOn="click": 対象要素（selectorなしなら画面全体）をクリックしたら次へ進める
  useEffect(() => {
    if (!open || advanceOn !== "click") return;

    const handleClick = (event: MouseEvent) => {
      if (advancedRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (selector && !target.closest(selector)) return;
      advancedRef.current = true;
      onAdvance?.();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open, advanceOn, selector, onAdvance]);

  // advanceOn="auto": 一定時間表示したら自動で次へ進める
  useEffect(() => {
    if (!open || advanceOn !== "auto") return;
    const timer = window.setTimeout(() => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      onAdvance?.();
    }, autoAdvanceMs);
    return () => window.clearTimeout(timer);
  }, [open, advanceOn, autoAdvanceMs, onAdvance]);

  if (!open) return null;
  // セレクタ指定があるのに未発見のあいだは何も描画しない（見つかり次第自然に出る）
  if (selector && !rect) return null;

  const bubble = <TutorialBubble message={message} rect={rect} />;

  return (
    <Box aria-hidden sx={{ position: "fixed", inset: 0, zIndex: 1300, pointerEvents: "none" }}>
      {rect ? (
        <Box
          sx={{
            position: "fixed",
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            borderRadius: 3,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
            outline: `2px solid ${CHAT_COLORS.orange}`,
            outlineOffset: 2,
            transition: "top .18s ease, left .18s ease, width .18s ease, height .18s ease",
            animation: "tutorial-pulse 1.6s ease-in-out infinite",
            "@keyframes tutorial-pulse": {
              "0%, 100%": { outlineColor: CHAT_COLORS.orange },
              "50%": { outlineColor: "rgba(255,247,0,0.45)" },
            },
          }}
        />
      ) : (
        <Box sx={{ position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.5)" }} />
      )}
      {bubble}
    </Box>
  );
}

// AIが話しかけているような小さい吹き出し。対象の近くに出し、
// 画面外へはみ出さないようクランプする
function TutorialBubble({ message, rect }: { message: string; rect: Rect | null }) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const bubbleWidth = Math.min(300, (viewport.width || 320) - 32);

  let top: number;
  let placement: "above" | "below" | "center";
  if (!rect) {
    top = 88;
    placement = "center";
  } else {
    const spaceAbove = rect.top;
    const spaceBelow = viewport.height - (rect.top + rect.height);
    if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
      top = rect.top + rect.height + SPOTLIGHT_PADDING + 14;
      placement = "below";
    } else {
      top = Math.max(12, rect.top - SPOTLIGHT_PADDING - 14);
      placement = "above";
    }
  }

  let left: number;
  if (!rect) {
    left = ((viewport.width || 320) - bubbleWidth) / 2;
  } else {
    const centerX = rect.left + rect.width / 2;
    left = Math.min(
      Math.max(16, centerX - bubbleWidth / 2),
      (viewport.width || 320) - bubbleWidth - 16,
    );
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top,
        left,
        width: bubbleWidth,
        maxWidth: "calc(100vw - 32px)",
        transform: placement === "above" ? "translateY(-100%)" : undefined,
        bgcolor: CHAT_COLORS.aiBubble,
        color: CHAT_COLORS.bubbleText,
        borderRadius: "18px",
        px: 2,
        py: 1.5,
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        animation: "tutorial-bubble-in .22s ease-out",
        "@keyframes tutorial-bubble-in": {
          from: { opacity: 0, transform: `translateY(${placement === "above" ? "-100%" : "0%"}) scale(0.96)` },
          to: { opacity: 1 },
        },
      }}
    >
      <Typography variant="body2" sx={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
        {message}
      </Typography>
    </Box>
  );
}
