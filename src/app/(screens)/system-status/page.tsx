"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useSystemStatus } from "./use-system-status";
import { HOME_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { DependencyHealth, LmStudioStatus } from "@/types/system";

// docs/screen-api-map.md「5. 主要ローディング・失敗UI」の AI_UNAVAILABLE 欄で
// 表示を求められている4手順。サーバーのguidanceは状態ごとの補足として別に出す
const LM_STUDIO_RECOVERY_STEPS = [
  "LM Studio を起動する",
  "左メニューの Developer 画面を開く",
  "Local Server を Start にする",
  "使用するモデルをロードする",
];

// 状態ラベルの配色。緑=正常、赤=停止。デザインは後から差し替える前提で、
// ホーム画面と同じ CHAT_COLORS を土台にした仮の配色にしている
const OK_COLOR = "#10B981";
const NG_COLOR = "#F87171";

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        bgcolor: ok ? "rgba(16,185,129,0.18)" : "rgba(248,113,113,0.18)",
        color: ok ? OK_COLOR : NG_COLOR,
        border: `1px solid ${ok ? OK_COLOR : NG_COLOR}`,
        fontWeight: 700,
      }}
    />
  );
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2,
      }}
    >
      <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function DependencyRow({ label, dependency }: { label: string; dependency: DependencyHealth }) {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
          {label}
        </Typography>
        <StatusChip label={dependency.status === "UP" ? "稼働中" : "停止"} ok={dependency.status === "UP"} />
      </Stack>
      {dependency.message && (
        <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          {dependency.message}
        </Typography>
      )}
    </Stack>
  );
}

// LM Studioの状態を日本語にする。CONNECTED以外はいずれも復旧操作が必要な状態
function formatLmStudioStatus(status: LmStudioStatus["status"]): string {
  switch (status) {
    case "CONNECTED":
      return "接続済み";
    case "SERVER_UNREACHABLE":
      return "サーバーへ接続できません";
    case "MODEL_NOT_LOADED":
      return "モデルが未ロードです";
    case "INVALID_RESPONSE":
      return "応答が想定と異なります";
    default:
      return "設定が不正です";
  }
}

export default function SystemStatusPage() {
  const { health, lmStudio, checking, unreachable, check } = useSystemStatus();
  const lmStudioConnected = lmStudio?.status === "CONNECTED";

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        pb: "72px",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, #061C2B 46%, #075685 100%)`,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: 3 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.08em", mb: 2 }}>
          起動確認
        </Typography>

        <Stack spacing={2}>
          {checking && !health && !lmStudio && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
            </Box>
          )}

          {unreachable && !checking && (
            <StatusCard title="アプリサーバーへ接続できません">
              <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                開発サーバー（npm run dev）が起動しているか確認してから、もう一度確認してください。
              </Typography>
            </StatusCard>
          )}

          {health && (
            <StatusCard title="アプリの稼働状態">
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
                    総合
                  </Typography>
                  <StatusChip label={health.status === "OK" ? "正常" : "一部停止"} ok={health.status === "OK"} />
                </Stack>
                <DependencyRow label="データベース" dependency={health.database} />
                <DependencyRow label="AI（LM Studio）" dependency={health.ai} />
                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  バージョン {health.version} / 確認時刻 {new Date(health.timestamp).toLocaleString()}
                </Typography>
              </Stack>
            </StatusCard>
          )}

          {lmStudio && (
            <StatusCard title="LM Studio 接続確認">
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
                    接続状態
                  </Typography>
                  <StatusChip label={formatLmStudioStatus(lmStudio.status)} ok={lmStudioConnected} />
                </Stack>

                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  接続先 {lmStudio.baseUrl}
                  {lmStudio.modelId ? ` / モデル ${lmStudio.modelId}` : ""}
                  {lmStudio.contextLength ? ` / コンテキスト長 ${lmStudio.contextLength}` : ""}
                </Typography>
                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  確認時刻 {new Date(lmStudio.checkedAt).toLocaleString()}
                </Typography>

                {lmStudio.guidance?.map((line) => (
                  <Typography key={line} variant="body2" sx={{ color: CHAT_COLORS.orange }}>
                    {line}
                  </Typography>
                ))}

                {/* 未接続のときだけ、復旧のための操作手順を並べる */}
                {!lmStudioConnected && (
                  <Box>
                    <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, mb: 0.5 }}>
                      復旧手順
                    </Typography>
                    <Stack component="ol" spacing={0.5} sx={{ pl: 2.5, m: 0 }}>
                      {LM_STUDIO_RECOVERY_STEPS.map((step) => (
                        <Typography key={step} component="li" variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                          {step}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </StatusCard>
          )}

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => void check()}
              disabled={checking}
              startIcon={checking ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{
                bgcolor: CHAT_COLORS.orange,
                color: CHAT_COLORS.bubbleText,
                fontWeight: 700,
                borderRadius: "999px",
                "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
              }}
            >
              {checking ? "確認中..." : "もう一度確認する"}
            </Button>
            <Button
              component={Link}
              href={HOME_PATH}
              variant="outlined"
              sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}
            >
              ホームへ戻る
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
