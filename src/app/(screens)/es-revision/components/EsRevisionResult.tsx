"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { EsDocument, EsRevision, RevisionDecision } from "@/types/es-document";

interface EsRevisionResultProps {
  esDocument: EsDocument;
  esRevision: EsRevision;
  onRequestComments: () => void;
  onReviewChange: (changeId: string, decision: RevisionDecision) => void;
  reviewingChangeId: string | null;
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
  onReviewChange,
  reviewingChangeId,
  loading,
  progressLabel,
}: EsRevisionResultProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const copyRevision = async () => {
    try {
      await navigator.clipboard.writeText(esRevision.revisedText);
      setCopyMessage("完成版ES案をコピーしました。");
    } catch {
      setCopyMessage("コピーできませんでした。文章を選択してコピーしてください。");
    }
  };

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

      <Button
        variant="outlined"
        onClick={() => void copyRevision()}
        sx={{ color: CHAT_COLORS.orange, borderColor: CHAT_COLORS.orange, borderRadius: "999px" }}
      >
        完成版をコピー
      </Button>

      {esRevision.changes.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
            主な変更と理由
          </Typography>
          {esRevision.changes.map((change) => (
            <Box
              key={change.id}
              sx={{ borderRadius: 2, border: `1px solid ${CHAT_COLORS.navyBorder}`, bgcolor: CHAT_COLORS.navySurface, p: 1.5 }}
            >
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  変更前: {change.before || "（追加）"}
                </Typography>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
                  変更後: {change.after || "（削除）"}
                </Typography>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.orange }}>
                  理由: {change.reason}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    label={
                      change.decision === "ACCEPTED"
                        ? "採用"
                        : change.decision === "REJECTED"
                          ? "却下"
                          : "未選択"
                    }
                    color={change.decision === "ACCEPTED" ? "success" : change.decision === "REJECTED" ? "error" : "default"}
                  />
                  <Button
                    size="small"
                    variant={change.decision === "ACCEPTED" ? "contained" : "outlined"}
                    disabled={reviewingChangeId !== null}
                    onClick={() => onReviewChange(change.id, "ACCEPTED")}
                  >
                    採用
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant={change.decision === "REJECTED" ? "contained" : "outlined"}
                    disabled={reviewingChangeId !== null}
                    onClick={() => onReviewChange(change.id, "REJECTED")}
                  >
                    却下
                  </Button>
                  {reviewingChangeId === change.id && <CircularProgress size={18} />}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

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
        disabled={loading || reviewingChangeId !== null}
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

      <Snackbar
        open={copyMessage !== null}
        autoHideDuration={3000}
        onClose={() => setCopyMessage(null)}
        message={copyMessage}
      />
    </Stack>
  );
}
