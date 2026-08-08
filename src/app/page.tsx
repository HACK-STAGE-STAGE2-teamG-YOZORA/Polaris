"use client";

import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { useAuthUser } from "@/app/components/AuthGate";
import { Constellation } from "@/app/components/Constellation";
import { apiGet } from "@/lib/api/client";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type {
  AxisPosition,
  DashboardResponse,
  OverallSelfAnalysisProfileResponse,
  SelfAnalysisAxis,
} from "@/types/dashboard";

type Axis = {
  left: string;
  leftJa: string;
  right: string;
  rightJa: string;
  position: number | null;
};

const AXIS_LABELS: Record<SelfAnalysisAxis, Omit<Axis, "position">> = {
  ENERGY_SOURCE: { left: "focus", leftJa: "集中派", right: "connect", rightJa: "共創派" },
  ACTION_STYLE: { left: "plan", leftJa: "設計派", right: "experiment", rightJa: "実験派" },
  SATISFACTION_SOURCE: { left: "mastery", leftJa: "習熟", right: "impact", rightJa: "貢献" },
  PREFERRED_ENVIRONMENT: { left: "stable", leftJa: "安定", right: "dynamic", rightJa: "変化" },
};

const AXIS_ORDER = Object.keys(AXIS_LABELS) as SelfAnalysisAxis[];

function axisPositionToPercent(position: AxisPosition): number | null {
  const positions: Partial<Record<AxisPosition, number>> = {
    LEFT: 20,
    LEANS_LEFT: 35,
    BALANCED_OR_BOTH: 50,
    LEANS_RIGHT: 65,
    RIGHT: 80,
  };
  return positions[position] ?? null;
}

function buildAxes(profile: OverallSelfAnalysisProfileResponse): Axis[] {
  const trends = new Map(profile.axes.map((trend) => [trend.axis, trend]));
  return AXIS_ORDER.map((axis) => ({
    ...AXIS_LABELS[axis],
    position: axisPositionToPercent(trends.get(axis)?.position ?? "INSUFFICIENT_EVIDENCE"),
  }));
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
        {axis.position !== null && <Box sx={{ position: "absolute", left: `calc(${axis.position}% - 11px)`, width: 22, height: 22, borderRadius: "50%", bgcolor: "#F6C95D", boxShadow: "0 1px 5px rgba(0,0,0,.35)" }} />}
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontSize: 16, letterSpacing: "0.12em", lineHeight: 1.25 }}>{axis.right}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 18, lineHeight: 1.25 }}>{axis.rightJa}</Typography>
      </Box>
    </Box>
  );
}

function InsightCard({ title, description }: { title: string; description: string }) {
  return (
    <Paper elevation={0} sx={{ mt: 1.5, px: 2, py: 1.5, borderRadius: 2, color: "#2D4C86", bgcolor: "#FFF" }}>
      <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 0.5 }}>{title}</Typography>
      <Typography sx={{ fontSize: 16, lineHeight: 1.9, letterSpacing: "0.04em" }}>{description}</Typography>
    </Paper>
  );
}

function ProfileIcon() {
  return (
    <SvgIcon sx={{ fontSize: 42 }} viewBox="0 0 24 24">
      <path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2.1c-4.25 0-7.7 2.34-7.7 5.22V21h15.4v-1.68c0-2.88-3.45-5.22-7.7-5.22Z" />
    </SvgIcon>
  );
}

// Googleアカウントの写真。未設定や画像取得失敗のときはMUIが自動でchildren（人型アイコン）へ戻す
function ProfileAvatar() {
  const user = useAuthUser();
  const label = user?.displayName ?? user?.email ?? "プロフィール";

  return (
    <Avatar
      src={user?.avatarUrl ?? undefined}
      alt={label}
      slotProps={{ img: { referrerPolicy: "no-referrer" } }}
      sx={{
        width: 76,
        height: 76,
        color: "#54708D",
        bgcolor: "#F5F5F5",
        border: "3px solid rgba(255,255,255,.7)",
      }}
    >
      <ProfileIcon />
    </Avatar>
  );
}

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void apiGet<DashboardResponse>("/dashboard")
      .then((response) => {
        if (!cancelled) setDashboard(response);
      })
      .catch(() => {
        if (!cancelled) setLoadError("分析結果を読み込めませんでした。時間をおいてもう一度お試しください。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const profile = dashboard?.overallProfile;

  return (
    <Box component="main" sx={{ minHeight: "100dvh", pb: "72px", color: CHAT_COLORS.textOnDark, background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, #061C2B 46%, #075685 100%)` }}>
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography component="h1" sx={{ mt: 0.5, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 46, fontWeight: 400, letterSpacing: "-0.04em" }}>polaris</Typography>
          <Constellation />
          <ProfileAvatar />
        </Box>

        <Typography component="h2" sx={{ mt: 7, mb: 3, fontSize: 28, fontWeight: 400, letterSpacing: "0.08em" }}>自己分析結果</Typography>
        {loading && <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>分析結果を読み込んでいます…</Typography>}
        {loadError && <Typography sx={{ color: "#FFD1D1" }}>{loadError}</Typography>}
        {!loading && !loadError && !profile && <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>自己分析チャットを完了すると、ここにあなたの分析結果が表示されます。</Typography>}
        {profile && <>
          <Box sx={{ display: "grid", gap: 2.5 }}>{buildAxes(profile).map((axis) => <AxisRow key={axis.left} axis={axis} />)}</Box>
          <Typography component="h2" sx={{ mt: 4, fontSize: 23, fontWeight: 400, letterSpacing: "0.1em" }}>あなたの強み</Typography>
          {profile.strengths.length > 0 ? profile.strengths.map((insight) => <InsightCard key={insight.title} title={insight.title} description={insight.description} />) : <Typography sx={{ mt: 1.5, color: CHAT_COLORS.textOnDarkMuted }}>強みは、分析結果が増えると表示されます。</Typography>}
          <Typography component="h2" sx={{ mt: 4, fontSize: 23, fontWeight: 400, letterSpacing: "0.1em" }}>あなたの弱み</Typography>
          {profile.weaknesses.length > 0 ? profile.weaknesses.map((insight) => <InsightCard key={insight.title} title={insight.title} description={insight.description} />) : <Typography sx={{ mt: 1.5, color: CHAT_COLORS.textOnDarkMuted }}>弱み・注意点は、分析結果が増えると表示されます。</Typography>}
        </>}
      </Box>
    </Box>
  );
}
