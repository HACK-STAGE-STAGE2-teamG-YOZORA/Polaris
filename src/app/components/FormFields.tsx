"use client";

import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";

// ラベルをTextField内の浮き上がるlabelにすると、白背景と暗い背景の境界(枠線のノッチ部分)に
// またがって表示され読みにくくなるため、labelは使わずFieldLabelを枠の外側(常に暗い背景の上)に置く
export const fieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: CHAT_COLORS.userBubble,
    borderRadius: "16px",
    "& fieldset": { borderColor: CHAT_COLORS.orange, borderWidth: 2 },
    "&:hover fieldset": { borderColor: CHAT_COLORS.orange },
    "&.Mui-focused fieldset": { borderColor: CHAT_COLORS.orange },
    "&.Mui-error fieldset": { borderColor: "#d32f2f" },
  },
  "& .MuiFormHelperText-root": { color: CHAT_COLORS.textOnDarkMuted },
};

export function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
      {children}
      {required && (
        <Typography component="span" sx={{ color: CHAT_COLORS.orange, ml: 0.5 }}>
          *
        </Typography>
      )}
    </Typography>
  );
}
