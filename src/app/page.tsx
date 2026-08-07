"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";

type Axis = {
  left: string;
  leftJa: string;
  right: string;
  rightJa: string;
  position: number;
};

type AnalysisResult = {
  axes: Axis[];
  strength: string;
  weakness: string;
};

// 後でAPIから取得する自己分析結果を、この配列に入れる構成にする。
// ページを切り替えると、軸・強み・弱みが常に同じ分析結果の内容へそろって変わる。
const RESULTS: AnalysisResult[] = [
  {
    axes: [
      { left: "focus", leftJa: "集中派", right: "connect", rightJa: "共創派", position: 70 },
      { left: "plan", leftJa: "設計派", right: "experiment", rightJa: "実験派", position: 59 },
      { left: "mastery", leftJa: "習熟", right: "impact", rightJa: "貢献", position: 74 },
      { left: "stable", leftJa: "安定", right: "dynamic", rightJa: "変化", position: 48 },
    ],
    strength: "課題を見つけたら、自分から調べて行動に移すことが得意です。わからないことがあっても、まずは挑戦してみる姿勢を大切にしています。新しいことにも前向きに取り組めます。",
    weakness: "一人で抱え込んでしまうことがあります。そのため、困ったときは早めに相談することを意識しています。周囲と協力することの大切さを学んでいます。",
  },
  {
    axes: [
      { left: "focus", leftJa: "集中派", right: "connect", rightJa: "共創派", position: 55 },
      { left: "plan", leftJa: "設計派", right: "experiment", rightJa: "実験派", position: 70 },
      { left: "mastery", leftJa: "習熟", right: "impact", rightJa: "貢献", position: 61 },
      { left: "stable", leftJa: "安定", right: "dynamic", rightJa: "変化", position: 66 },
    ],
    strength: "新しい方法を試し、そこから得た気づきを次の行動へ生かせます。変化がある状況でも、周囲と話しながら前に進める力があります。",
    weakness: "可能性を広く考える分、最初の一歩を決めるまでに時間がかかることがあります。期限と優先順位を先に決めることで改善しています。",
  },
  {
    axes: [
      { left: "focus", leftJa: "集中派", right: "connect", rightJa: "共創派", position: 77 },
      { left: "plan", leftJa: "設計派", right: "experiment", rightJa: "実験派", position: 47 },
      { left: "mastery", leftJa: "習熟", right: "impact", rightJa: "貢献", position: 80 },
      { left: "stable", leftJa: "安定", right: "dynamic", rightJa: "変化", position: 41 },
    ],
    strength: "目標に必要な知識を深く身につけ、着実に質を高めていけます。小さな改善を積み重ねる粘り強さがあります。",
    weakness: "完成度を求めすぎて、途中の段階で共有することをためらう場合があります。早い段階でフィードバックをもらうよう心がけています。",
  },
];

function Constellation() {
  return (
    <Box component="svg" viewBox="0 0 120 120" aria-label="北斗七星" sx={{ width: 116, height: 116 }}>
      <g fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2">
        <path d="M12 12 45 29 58 58 43 79 77 104 101 87 72 62" />
        <path d="M77 104 101 87" />
      </g>
      {[ [12, 12], [45, 29], [58, 58], [43, 79], [77, 104], [101, 87], [72, 62] ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" fill="#fff" />
      ))}
    </Box>
  );
}

function AxisRow({ axis }: { axis: Axis }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "82px minmax(80px, 1fr) 82px", alignItems: "center", gap: 1 }}>
      <Box>
        <Typography sx={{ fontSize: 16, letterSpacing: "0.12em", lineHeight: 1.25 }}>{axis.left}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 18, lineHeight: 1.25 }}>{axis.leftJa}</Typography>
      </Box>
      <Box sx={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <Box sx={{ width: "100%", height: 4, borderRadius: 999, bgcolor: "rgba(255,255,255,0.92)" }} />
        <Box sx={{ position: "absolute", left: `calc(${axis.position}% - 11px)`, width: 22, height: 22, borderRadius: "50%", bgcolor: "#F6C95D", boxShadow: "0 1px 5px rgba(0,0,0,.35)" }} />
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontSize: 16, letterSpacing: "0.12em", lineHeight: 1.25 }}>{axis.right}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 18, lineHeight: 1.25 }}>{axis.rightJa}</Typography>
      </Box>
    </Box>
  );
}

function InsightCard({ children }: { children: string }) {
  return (
    <Paper elevation={0} sx={{ mt: 1.5, px: 2, py: 1.5, borderRadius: 2, color: "#2D4C86", bgcolor: "#FFF", fontSize: 16, lineHeight: 1.9, letterSpacing: "0.04em" }}>
      {children}
    </Paper>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <SvgIcon fontSize="small">
      <path d={direction === "left" ? "m14.5 5-7 7 7 7 1.5-1.5-5.5-5.5L16 6.5z" : "m9.5 5-1.5 1.5 5.5 5.5L8 17.5 9.5 19l7-7z"} />
    </SvgIcon>
  );
}

function ProfileIcon() {
  return (
    <SvgIcon sx={{ fontSize: 42 }} viewBox="0 0 24 24" aria-label="プロフィール">
      <path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2.1c-4.25 0-7.7 2.34-7.7 5.22V21h15.4v-1.68c0-2.88-3.45-5.22-7.7-5.22Z" />
    </SvgIcon>
  );
}

export default function HomePage() {
  const [resultIndex, setResultIndex] = useState(0);
  const result = RESULTS[resultIndex];

  const showPrevious = () => setResultIndex((current) => (current - 1 + RESULTS.length) % RESULTS.length);
  const showNext = () => setResultIndex((current) => (current + 1) % RESULTS.length);

  return (
    <Box component="main" sx={{ minHeight: "100dvh", pb: "72px", color: CHAT_COLORS.textOnDark, background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, #061C2B 46%, #075685 100%)` }}>
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Typography component="h1" sx={{ mt: 0.5, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 46, fontWeight: 400, letterSpacing: "-0.04em" }}>polaris</Typography>
        <Constellation />
        <Box aria-label="プロフィール画像の仮表示" sx={{ width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", color: "#54708D", bgcolor: "#F5F5F5", border: "3px solid rgba(255,255,255,.7)" }}><ProfileIcon /></Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 7, mb: 3 }}>
        <Typography component="h2" sx={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.08em" }}>自己分析結果</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <IconButton aria-label="前の分析結果" onClick={showPrevious} size="small" sx={{ color: CHAT_COLORS.textOnDark }}><ArrowIcon direction="left" /></IconButton>
          <Typography aria-live="polite" sx={{ minWidth: 54, textAlign: "center", fontSize: 13, color: CHAT_COLORS.textOnDarkMuted }}>分析 {resultIndex + 1} / {RESULTS.length}</Typography>
          <IconButton aria-label="次の分析結果" onClick={showNext} size="small" sx={{ color: CHAT_COLORS.textOnDark }}><ArrowIcon direction="right" /></IconButton>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 2.5 }}>{result.axes.map((axis) => <AxisRow key={axis.left} axis={axis} />)}</Box>

      <Typography component="h2" sx={{ fontSize: 23, fontWeight: 400, letterSpacing: "0.1em" }}>あなたの強み</Typography>
      <InsightCard>{result.strength}</InsightCard>

      <Typography component="h2" sx={{ mt: 4, fontSize: 23, fontWeight: 400, letterSpacing: "0.1em" }}>あなたの弱み</Typography>
      <InsightCard>{result.weakness}</InsightCard>
      </Box>
    </Box>
  );
}
