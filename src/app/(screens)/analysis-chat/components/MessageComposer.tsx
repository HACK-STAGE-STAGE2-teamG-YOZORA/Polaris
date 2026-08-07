"use client";

import type { KeyboardEvent } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { countCodePoints } from "@/shared/validation/count-code-points";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

// docs/openapi.yaml SendMessageRequest.content の上限（1〜10000文字）
const MAX_CONTENT_LENGTH = 10000;

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  fieldError?: string;
}

function SendArrowIcon() {
  return (
    <SvgIcon fontSize="small">
      <path d="M4 12h13.2M12.5 6.5 18 12l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
        <TextField
          placeholder="回答を入力"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          error={Boolean(fieldError) || overLimit}
          multiline
          maxRows={4}
          fullWidth
          disabled={disabled}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: CHAT_COLORS.userBubble,
              borderRadius: "999px",
              px: 1,
              "& fieldset": { borderColor: CHAT_COLORS.orange, borderWidth: 2 },
              "&:hover fieldset": { borderColor: CHAT_COLORS.orange },
              "&.Mui-focused fieldset": { borderColor: CHAT_COLORS.orange },
              "&.Mui-error fieldset": { borderColor: "#d32f2f" },
            },
          }}
        />
        <IconButton
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-label="送信"
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            bgcolor: CHAT_COLORS.orange,
            color: CHAT_COLORS.userBubble,
            "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
            "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
          }}
        >
          {disabled ? <CircularProgress size={20} color="inherit" /> : <SendArrowIcon />}
        </IconButton>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: "space-between", px: 1.5 }}>
        <Typography variant="caption" sx={{ color: "#ff8a80" }}>
          {fieldError ?? (overLimit ? `${MAX_CONTENT_LENGTH}文字以内で入力してください。` : "")}
        </Typography>
        <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          {length} / {MAX_CONTENT_LENGTH}
        </Typography>
      </Stack>
    </Stack>
  );
}
