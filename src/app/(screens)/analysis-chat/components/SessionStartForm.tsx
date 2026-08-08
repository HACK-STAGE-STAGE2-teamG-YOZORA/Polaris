"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";

interface SessionStartFormProps {
  submitting: boolean;
  fieldErrors: Record<string, string>;
  onSubmit: (title: string) => void;
}

// セッション開始フォーム。タイトル（任意）だけを持つ。
// 4軸は事前に選ばせず常に4軸全部を対象にする(この画面ではtargetAxesを送らず、
// サーバー側デフォルトに任せる)。会話の中でAIがどの軸の話かを自動判定するため、
// 「どの軸を話すか」を先にユーザーへ選ばせるのは自己分析の流れとして不自然という判断による
export function SessionStartForm({ submitting, fieldErrors, onSubmit }: SessionStartFormProps) {
  const [title, setTitle] = useState("");

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
          セッションを開始する
        </Typography>
        <TextField
          label="タイトル（任意）"
          placeholder="自己分析"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={Boolean(fieldErrors.title)}
          helperText={fieldErrors.title}
          fullWidth
          disabled={submitting}
          sx={inputSx}
        />
        <Button
          variant="contained"
          disabled={submitting}
          onClick={() => onSubmit(title)}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{
            bgcolor: CHAT_COLORS.orange,
            color: CHAT_COLORS.bubbleText,
            fontWeight: 700,
            borderRadius: "999px",
            "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
          }}
        >
          開始する
        </Button>
      </Stack>
    </Box>
  );
}

const inputSx = {
  "& .MuiInputLabel-root": { color: CHAT_COLORS.textOnDarkMuted },
  "& .MuiOutlinedInput-root": {
    color: CHAT_COLORS.textOnDark,
    "& fieldset": { borderColor: CHAT_COLORS.navyBorder },
    "&:hover fieldset": { borderColor: CHAT_COLORS.orange },
    "&.Mui-focused fieldset": { borderColor: CHAT_COLORS.orange },
  },
};
