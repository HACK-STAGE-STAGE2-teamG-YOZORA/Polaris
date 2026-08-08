"use client";

import Link from "next/link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

import { useDashboard } from "./use-dashboard";
import { useAuthUser } from "@/app/components/AuthGate";
import { Constellation } from "@/app/components/Constellation";
import { HomeAxisRow } from "@/app/components/home/HomeAxisRow";
import { HomeEsList } from "@/app/components/home/HomeEsList";
import { HomeSessionEntry } from "@/app/components/home/HomeSessionEntry";
import { EXPERIENCES_PATH, SYSTEM_STATUS_PATH } from "@/shared/routes";
import { AXIS_ORDER } from "@/shared/self-analysis/axis-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { DataWarningReason, ProfileInsight } from "@/types/dashboard";

const DATA_WARNING_LABELS: Record<DataWarningReason, string> = {
  FEW_COMPLETED_SESSIONS: "完了した自己分析が少ない",
  FEW_CONFIRMED_EXPERIENCES: "確認済みの経験が少ない",
};

// 強み・弱みには必ず参照した分析結果と根拠を添える（docs/product-scope.md）
function InsightCard({ insight }: { insight: ProfileInsight }) {
  return (
    <Paper elevation={0} sx={{ mt: 1.5, px: 2, py: 1.5, borderRadius: 2, color: "#2D4C86", bgcolor: "#FFF" }}>
      <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 0.5 }}>{insight.title}</Typography>
      <Typography sx={{ fontSize: 16, lineHeight: 1.9, letterSpacing: "0.04em" }}>{insight.description}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 12, color: "#5C7BB5" }}>
        根拠 {insight.evidenceIds.length}件 / 参照した分析結果 {insight.sourceReportIds.length}件
      </Typography>
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

const sectionHeadingSx = { mt: 4, mb: 1.5, fontSize: 23, fontWeight: 400, letterSpacing: "0.1em" };

export default function HomePage() {
  const { dashboard, loading, recomputing, error, recompute } = useDashboard();
  const profile = dashboard?.overallProfile ?? null;
  // 総合プロフィールの軸は4件そろう契約だが、表示順は画面側で固定する
  const axesByKey = new Map((profile?.axes ?? []).map((trend) => [trend.axis, trend]));

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        pb: "72px",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, ${CHAT_COLORS.gradientMid} 46%, ${CHAT_COLORS.gradientBottom} 100%)`,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography
            component="h1"
            sx={{ mt: 0.5, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 46, fontWeight: 400, letterSpacing: "-0.04em" }}
          >
            polaris
          </Typography>
          <Constellation />
          <ProfileAvatar />
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
          </Box>
        )}

        {error && (
          <Stack spacing={1} sx={{ mt: 3 }}>
            <Typography sx={{ color: "#FFD1D1" }}>{error.message}</Typography>
            {error.code === "AI_UNAVAILABLE" && (
              <Button
                component={Link}
                href={SYSTEM_STATUS_PATH}
                size="small"
                variant="outlined"
                sx={{ alignSelf: "flex-start", color: "#ffe0de", borderColor: "#f28b82" }}
              >
                起動確認をひらく
              </Button>
            )}
          </Stack>
        )}

        {dashboard && (
          <HomeSessionEntry activeSession={dashboard.activeSession} hasProfile={profile !== null} />
        )}

        <Typography component="h2" sx={{ ...sectionHeadingSx, mt: 5 }}>
          自己分析結果
        </Typography>

        {!loading && !error && !profile && (
          <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            自己分析チャットを完了すると、ここにあなたの分析結果が表示されます。
          </Typography>
        )}

        {profile && (
          <>
            {/* 古い結果であることを隠さず、再集計の導線を出す（docs/screen-api-map.md） */}
            {profile.freshness === "STALE" && (
              <Box
                sx={{
                  mb: 2,
                  borderRadius: 3,
                  border: `1px solid ${CHAT_COLORS.orange}`,
                  bgcolor: CHAT_COLORS.orangeMuted,
                  p: 1.5,
                }}
              >
                <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    この結果は最新ではありません（STALE）
                  </Typography>
                  <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                    経験や分析結果が更新されています。全履歴から集計し直してください。
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => void recompute()}
                    disabled={recomputing}
                    startIcon={recomputing ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{
                      bgcolor: CHAT_COLORS.orange,
                      color: CHAT_COLORS.bubbleText,
                      fontWeight: 700,
                      borderRadius: "999px",
                      "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                    }}
                  >
                    {recomputing ? "再集計中..." : "再集計する"}
                  </Button>
                </Stack>
              </Box>
            )}

            {profile.summary && (
              <Typography sx={{ mb: 2.5, fontSize: 15, lineHeight: 1.9, color: "rgba(255,255,255,0.9)" }}>
                {profile.summary}
              </Typography>
            )}

            <Box sx={{ display: "grid", gap: 3 }}>
              {AXIS_ORDER.map((axis) => {
                const trend = axesByKey.get(axis);
                return trend ? <HomeAxisRow key={axis} trend={trend} /> : null;
              })}
            </Box>

            <Typography component="h2" sx={sectionHeadingSx}>
              あなたの強み
            </Typography>
            {profile.strengths.length > 0 ? (
              profile.strengths.map((insight) => <InsightCard key={insight.title} insight={insight} />)
            ) : (
              <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                強みは、根拠が集まると表示されます。
              </Typography>
            )}

            <Typography component="h2" sx={sectionHeadingSx}>
              弱み・注意点
            </Typography>
            {profile.weaknesses.length > 0 ? (
              profile.weaknesses.map((insight) => <InsightCard key={insight.title} insight={insight} />)
            ) : (
              <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                苦手になりやすい条件は、根拠が集まると表示されます。
              </Typography>
            )}

            {/* データ量。少ない場合も結果自体は隠さず、件数と注意文を添える */}
            <Box
              sx={{
                mt: 3,
                borderRadius: 3,
                border: `1px solid ${CHAT_COLORS.navyBorder}`,
                bgcolor: CHAT_COLORS.navySurface,
                p: 2,
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  この結果のもとになったデータ
                </Typography>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  完了した自己分析 {profile.dataSummary.completedSessionCount}件 / あなたの発言{" "}
                  {profile.dataSummary.userMessageCount}件 / 確認済みの経験{" "}
                  {profile.dataSummary.confirmedExperienceCount}件
                </Typography>
                {profile.dataSummary.isDataSparse && (
                  <Typography variant="body2" sx={{ color: CHAT_COLORS.orange }}>
                    ※データが少ないため、今後結果が変わる可能性があります
                    {profile.dataSummary.warningReasons.length > 0 &&
                      `（${profile.dataSummary.warningReasons.map((reason) => DATA_WARNING_LABELS[reason]).join("、")}）`}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  最終集計 {new Date(profile.generatedAt).toLocaleString()}
                </Typography>
                <Button
                  component={Link}
                  href={EXPERIENCES_PATH}
                  size="small"
                  variant="text"
                  sx={{ alignSelf: "flex-start", color: CHAT_COLORS.orange }}
                >
                  経験一覧を確認する
                </Button>
              </Stack>
            </Box>
          </>
        )}

        <Typography component="h2" sx={sectionHeadingSx}>
          保存済みのES
        </Typography>
        <HomeEsList documents={dashboard?.recentEsDocuments ?? []} />

        <Box sx={{ mt: 4, mb: 2, textAlign: "center" }}>
          <Button
            component={Link}
            href={SYSTEM_STATUS_PATH}
            size="small"
            variant="text"
            sx={{ color: CHAT_COLORS.textOnDarkMuted }}
          >
            システムの起動確認
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
