import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { AXIS_LABELS } from "@/shared/self-analysis/axis-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type {
  AnalysisSessionStatus,
  CompletionIntent,
  SelfAnalysisAxis,
} from "@/types/analysis-session";

interface CompletionBannerProps {
  completionIntent: CompletionIntent;
  canGenerateResult: boolean;
  onGenerateResult: () => void;
  generatingResult: boolean;
  sessionStatus: AnalysisSessionStatus;
  // 根拠不足でも生成は止めないが、不足している内容は明示する（docs/screen-api-map.md）
  confirmedExperienceCount: number;
  missingAxes: SelfAnalysisAxis[];
}

// 終了案内。AIが終了意図を検出（SUGGESTED）した場合も、ここでは案内を出すだけで
// セッション状態は変えない。確定操作は4軸の本人評価がそろってから行う
export function CompletionBanner({
  completionIntent,
  canGenerateResult,
  onGenerateResult,
  generatingResult,
  sessionStatus,
  confirmedExperienceCount,
  missingAxes,
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
          ? "分析結果の確定とホームへの反映が完了しました"
          : isGenerated
            ? "4軸分析結果が生成されました"
            : completionIntent === "SUGGESTED"
              ? "ここまでの内容で分析結果を作りますか？"
              : "ここまでの内容でも分析結果を作成できます。"}
      </Typography>

      {!isGenerated && (
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            「この内容で結果を見る」を押すと、これまでの会話から4軸の傾向を作ります。会話を続けることもできます。
          </Typography>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            確認済みの経験カード: {confirmedExperienceCount}件
            {confirmedExperienceCount === 0 && "（0件でも結果は作れますが、根拠不足の軸が増えます）"}
          </Typography>
          {missingAxes.length > 0 && (
            <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              まだ材料が少ない軸: {missingAxes.map((axis) => AXIS_LABELS[axis].name).join("、")}
            </Typography>
          )}
        </Stack>
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
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
              "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
            }}
          >
            {generatingResult ? "分析結果を生成中..." : "この内容で結果を見る"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
