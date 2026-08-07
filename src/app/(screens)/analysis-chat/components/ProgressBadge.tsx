import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AnalysisProgress, SelfAnalysisAxis } from "@/types/analysis-session";

interface ProgressBadgeProps {
  progress: AnalysisProgress;
  missingAxes: SelfAnalysisAxis[];
  experienceReady: boolean;
}

const outlinedChipSx = {
  color: CHAT_COLORS.orange,
  borderColor: CHAT_COLORS.orange,
  bgcolor: CHAT_COLORS.orangeMuted,
};

// 「経験カード3件必須」の表示は廃止(この制約自体がなくなったため)。
// userMessageCount/confirmedExperienceCountベースの簡易表示にする。
// canGenerateResultに応じたCTAはCompletionBanner側が担当する
export function ProgressBadge({ progress, missingAxes, experienceReady }: ProgressBadgeProps) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      <Chip
        label={`発言 ${progress.userMessageCount}件`}
        variant="outlined"
        sx={outlinedChipSx}
      />
      <Chip
        label={`確認済み経験 ${progress.confirmedExperienceCount}件`}
        variant="outlined"
        sx={outlinedChipSx}
      />
      {experienceReady && (
        <Chip label="経験カード化できます" sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText }} />
      )}
      {missingAxes.length > 0 && (
        <Chip
          label={`未確認: ${missingAxes.join(", ")}`}
          variant="outlined"
          sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder }}
        />
      )}
    </Stack>
  );
}
