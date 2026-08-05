"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { countCodePoints } from "@/shared/validation/count-code-points";

// docs/openapi.yaml SendMessageRequest.content の上限（1〜10000文字）
const MAX_CONTENT_LENGTH = 10000;

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  fieldError?: string;
}

// メッセージ入力欄＋送信ボタン。disabled=true（送信中）のあいだは
// 入力欄・ボタンとも無効化して連打・二重送信を防ぐ
export function MessageComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  fieldError,
}: MessageComposerProps) {
  // .lengthではなくサロゲートペア対応のcountCodePointsで文字数を数える
  const length = countCodePoints(value);
  const overLimit = length > MAX_CONTENT_LENGTH;
  const canSubmit = !disabled && length > 0 && !overLimit;

  return (
    <Stack spacing={1}>
      <TextField
        label="回答を入力"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={Boolean(fieldError) || overLimit}
        helperText={
          fieldError ?? (overLimit ? `${MAX_CONTENT_LENGTH}文字以内で入力してください。` : undefined)
        }
        multiline
        minRows={3}
        fullWidth
        disabled={disabled}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary">
          {length} / {MAX_CONTENT_LENGTH}
        </Typography>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!canSubmit}
          // 送信中はスピナーに差し替えて処理中であることを示す
          startIcon={disabled ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          送信
        </Button>
      </Box>
    </Stack>
  );
}
