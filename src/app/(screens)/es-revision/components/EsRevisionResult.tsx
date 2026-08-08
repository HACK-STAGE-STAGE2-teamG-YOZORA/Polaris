import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { EsDocument, EsRevision } from "@/types/es-document";

interface EsRevisionResultProps {
  esDocument: EsDocument;
  esRevision: EsRevision;
  onRequestComments: () => void;
  loading: boolean;
  // 再検査(verify)実行中の表示文言。実行中でなければnull
  progressLabel?: string | null;
}

// 添削結果画面。「添削」バッジ付きの原文カード → 「修正結果」見出し →
// オレンジ枠の修正後テキストカード、という縦並び構成。「コメントをもらう」で再検査(verify)へ進む
export function EsRevisionResult({
  esDocument,
  esRevision,
  onRequestComments,
  loading,
  progressLabel,
}: EsRevisionResultProps) {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          borderRadius: 3,
          border: `1px solid ${CHAT_COLORS.navyBorder}`,
          bgcolor: CHAT_COLORS.navySurface,
          p: 2,
        }}
      >
        <Stack spacing={1}>
          <Box>
            <Chip
              label="添削"
              size="small"
              sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700 }}
            />
          </Box>
          <Typography variant="body1" sx={{ color: CHAT_COLORS.textOnDark, whiteSpace: "pre-wrap" }}>
            {esDocument.originalText}
          </Typography>
        </Stack>
      </Box>

      <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
        修正結果
      </Typography>

      <Box
        sx={{
          borderRadius: 3,
          border: `2px solid ${CHAT_COLORS.orange}`,
          bgcolor: CHAT_COLORS.navySurface,
          p: 2,
        }}
      >
        <Stack spacing={1}>
          <Typography variant="body1" sx={{ color: CHAT_COLORS.textOnDark, whiteSpace: "pre-wrap" }}>
            {esRevision.revisedText}
          </Typography>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            {esRevision.characterCount} / {esDocument.characterLimit}文字
          </Typography>
        </Stack>
      </Box>

      <Button
        variant="contained"
        onClick={onRequestComments}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        sx={{
          bgcolor: CHAT_COLORS.orange,
          color: CHAT_COLORS.bubbleText,
          fontWeight: 700,
          borderRadius: "999px",
          "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
          "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
        }}
      >
        コメントをもらう
      </Button>

      {loading && progressLabel && (
        <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, textAlign: "center" }}>
          {progressLabel}
        </Typography>
      )}
    </Stack>
  );
}
