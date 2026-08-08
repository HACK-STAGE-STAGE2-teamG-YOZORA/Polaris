import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AnalysisSessionStatus, CompletionIntent, SelfAnalysisAxis } from "@/types/analysis-session";

interface CompletionBannerProps {
  completionIntent: CompletionIntent;
  canGenerateResult: boolean;
  onGenerateResult: () => void;
  generatingResult: boolean;
  sessionStatus?: AnalysisSessionStatus;
  assessments?: any[];
  onFinalizeSession?: () => Promise<boolean>;
  finalizingSession?: boolean;
}

const AXIS_NAMES: Record<SelfAnalysisAxis, { left: string; right: string; name: string }> = {
  ENERGY_SOURCE: { left: "Focus (集中派)", right: "Connect (共創派)", name: "エネルギー源" },
  ACTION_STYLE: { left: "Plan (設計派)", right: "Experiment (実験派)", name: "行動スタイル" },
  SATISFACTION_SOURCE: { left: "Mastery (習熟)", right: "Impact (貢献)", name: "満足感の源" },
  PREFERRED_ENVIRONMENT: { left: "Stable (安定)", right: "Dynamic (変化)", name: "好む環境" },
};

function formatPosition(position: string, axis: SelfAnalysisAxis): string {
  const meta = AXIS_NAMES[axis];
  if (!meta) return position;
  switch (position) {
    case "LEFT":
      return `${meta.left}寄り`;
    case "LEANS_LEFT":
      return `${meta.left}にやや近い`;
    case "BALANCED_OR_BOTH":
      return "両方の要素・バランス型";
    case "LEANS_RIGHT":
      return `${meta.right}にやや近い`;
    case "RIGHT":
      return `${meta.right}寄り`;
    case "CONTEXT_DEPENDENT":
      return "状況・文脈による";
    default:
      return "判断材料不足";
  }
}

export function CompletionBanner({
  completionIntent,
  canGenerateResult,
  onGenerateResult,
  generatingResult,
  sessionStatus,
  assessments = [],
  onFinalizeSession,
  finalizingSession = false,
}: CompletionBannerProps) {
  if (completionIntent !== "SUGGESTED" && !canGenerateResult) {
    return null;
  }

  const isGenerated = sessionStatus === "READY_TO_FINALIZE" || sessionStatus === "COMPLETED";

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${CHAT_COLORS.orange}`,
        bgcolor: CHAT_COLORS.orangeMuted,
        px: 2,
        py: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, mb: 0.5 }}>
        {sessionStatus === "COMPLETED"
          ? "🎉 分析結果の確定とホームへの反映が完了しました！"
          : isGenerated
          ? "✨ 4軸分析結果が生成されました"
          : completionIntent === "SUGGESTED"
          ? "ここまでの内容で分析結果を作りますか？"
          : "ここまでの内容でも分析結果を作成できます。"}
      </Typography>

      {!isGenerated && (
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          「この内容で結果を見る」を押すと、これまでの会話から4軸の傾向がAI生成されます。
        </Typography>
      )}

      {canGenerateResult && !isGenerated && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            variant="contained"
            size="medium"
            onClick={onGenerateResult}
            disabled={generatingResult}
            startIcon={generatingResult ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: "#fff",
              fontWeight: 700,
              "&:hover": {
                bgcolor: "#d97706",
              },
              "&.Mui-disabled": { color: CHAT_COLORS.textOnDarkMuted, borderColor: CHAT_COLORS.navyBorder },
            }}
          >
            {generatingResult ? "分析結果を生成中..." : "この内容で結果を見る"}
          </Button>
        </Box>
      )}

      {/* 生成済みの4軸分析結果カード表示 */}
      {isGenerated && assessments.length > 0 && (
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, display: "block" }}>
            【生成された4軸分析結果】
          </Typography>
          {assessments.map((item: any) => {
            const axisKey = item.axis as SelfAnalysisAxis;
            const meta = AXIS_NAMES[axisKey];
            return (
              <Paper
                key={item.id || item.axis}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: CHAT_COLORS.textOnDark,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#F6C95D" }}>
                    {meta?.name || item.axis}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, bgcolor: "rgba(246, 201, 93, 0.2)", px: 1, py: 0.2, borderRadius: 1 }}>
                    {formatPosition(item.position, axisKey)}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.9)" }}>
                  {item.displayStatement || item.aiStatement}
                </Typography>
              </Paper>
            );
          })}

          {/* 確定＆ホーム結果画面へのナビゲーション */}
          <Box sx={{ pt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
            {sessionStatus !== "COMPLETED" && onFinalizeSession && (
              <Button
                variant="contained"
                size="medium"
                onClick={() => void onFinalizeSession()}
                disabled={finalizingSession}
                startIcon={finalizingSession ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{
                  bgcolor: "#10B981",
                  color: "#fff",
                  fontWeight: 700,
                  "&:hover": { bgcolor: "#059669" },
                }}
              >
                {finalizingSession ? "確定＆総合反映中..." : "この結果を確定してホームの総合結果に反映する"}
              </Button>
            )}

            <Button
              component={Link}
              href="/"
              variant="outlined"
              size="medium"
              sx={{
                color: "#fff",
                borderColor: "rgba(255,255,255,0.4)",
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              ホーム（総合自己分析画面）へ戻る
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
