import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatLocalDateTime } from "@/lib/format/date-time";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AnalysisSession } from "@/types/analysis-session";

interface StartModeChoiceProps {
  session: AnalysisSession;
  onResume: () => void;
  onStartNew: () => void;
  busy: boolean;
}

// 「チャット開始選択」画面。GET /analysis-sessions/current で進行中セッションが
// 見つかった場合にだけ表示する。「続きから」は既存セッションをそのまま使い（POSTしない）、
// 「初めから」はSessionStartFormへ進んでRESTART_ACTIVEでPOSTする
export function StartModeChoice({ session, onResume, onStartNew, busy }: StartModeChoiceProps) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2.5,
      }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
          進行中のセッションがあります
        </Typography>
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          {session.title}（最終更新: {formatLocalDateTime(session.updatedAt)}）
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={onResume}
            disabled={busy}
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              borderRadius: "999px",
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
            }}
          >
            続きから
          </Button>
          <Button
            variant="outlined"
            onClick={onStartNew}
            disabled={busy}
            sx={{
              color: CHAT_COLORS.orange,
              borderColor: CHAT_COLORS.orange,
              borderRadius: "999px",
            }}
          >
            初めから
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
