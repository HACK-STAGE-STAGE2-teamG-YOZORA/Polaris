"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { countCodePoints } from "@/shared/validation/count-code-points";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CreateEsDocumentRequest } from "@/types/es-document";

// docs/openapi.yaml CreateEsDocumentRequest の上限
const MAX_QUESTION_LENGTH = 5000;
const MAX_ORIGINAL_TEXT_LENGTH = 20000;
const MAX_CHARACTER_LIMIT = 10000;

function ClipIcon() {
  return (
    <SvgIcon fontSize="small">
      <path
        d="M7 12.5 15 4.5a3 3 0 0 1 4.24 4.24l-9 9a1.5 1.5 0 0 1-2.12-2.12l7.5-7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

// ラベルをTextField内の浮き上がるlabelにすると、白背景と暗い背景の境界(枠線のノッチ部分)に
// またがって表示され読みにくくなるため、labelは使わずFieldLabelを枠の外側(常に暗い背景の上)に置く
const fieldSx = {
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

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
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

interface EsInputFormProps {
  submitting: boolean;
  fieldErrors: Record<string, string>;
  onSubmit: (request: CreateEsDocumentRequest) => void;
}

// ES入力フォーム。設問・文字数上限・ES原文を入力し、「添削する」でES文書作成→推敲まで進める。
// PDF添付は対応するAPIがopenapi.yamlに存在しないため見た目だけ配置する(チーム合意済み)
export function EsInputForm({ submitting, fieldErrors, onSubmit }: EsInputFormProps) {
  const [question, setQuestion] = useState("");
  const [characterLimit, setCharacterLimit] = useState("400");
  const [originalText, setOriginalText] = useState("");
  const [pdfToastOpen, setPdfToastOpen] = useState(false);

  const originalTextLength = countCodePoints(originalText);
  const characterLimitValue = Number(characterLimit);
  const hasValidCharacterLimit =
    characterLimit.trim() !== "" &&
    Number.isInteger(characterLimitValue) &&
    characterLimitValue >= 1 &&
    characterLimitValue <= MAX_CHARACTER_LIMIT;

  const canSubmit =
    !submitting &&
    question.trim().length > 0 &&
    question.length <= MAX_QUESTION_LENGTH &&
    hasValidCharacterLimit &&
    originalTextLength > 0 &&
    originalTextLength <= MAX_ORIGINAL_TEXT_LENGTH;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      question,
      characterLimit: characterLimitValue,
      originalText,
    });
  };

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
          ESを入力する
        </Typography>

        <Stack spacing={0.75}>
          <FieldLabel required>設問</FieldLabel>
          <TextField
            placeholder="学生時代に力を入れたことを教えてください"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            error={Boolean(fieldErrors.question)}
            helperText={fieldErrors.question}
            multiline
            minRows={2}
            fullWidth
            disabled={submitting}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>文字数上限</FieldLabel>
          <TextField
            type="number"
            value={characterLimit}
            onChange={(event) => setCharacterLimit(event.target.value)}
            error={Boolean(fieldErrors.characterLimit) || (characterLimit !== "" && !hasValidCharacterLimit)}
            helperText={
              fieldErrors.characterLimit ??
              (characterLimit !== "" && !hasValidCharacterLimit
                ? `1〜${MAX_CHARACTER_LIMIT}の範囲で指定してください。`
                : undefined)
            }
            slotProps={{ htmlInput: { min: 1, max: MAX_CHARACTER_LIMIT } }}
            fullWidth
            disabled={submitting}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>ES原文</FieldLabel>
          <TextField
            placeholder="ここにES原文を入力してください"
            value={originalText}
            onChange={(event) => setOriginalText(event.target.value)}
            error={Boolean(fieldErrors.originalText) || originalTextLength > MAX_ORIGINAL_TEXT_LENGTH}
            helperText={
              fieldErrors.originalText ??
              (originalTextLength > MAX_ORIGINAL_TEXT_LENGTH
                ? `${MAX_ORIGINAL_TEXT_LENGTH}文字以内で入力してください。`
                : undefined)
            }
            multiline
            minRows={8}
            fullWidth
            disabled={submitting}
            sx={fieldSx}
          />
        </Stack>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tooltip title="PDF添付(準備中)">
            <span>
              <IconButton
                aria-label="PDFを添付"
                disabled={submitting}
                onClick={() => setPdfToastOpen(true)}
                sx={{
                  bgcolor: CHAT_COLORS.orangeMuted,
                  color: CHAT_COLORS.orange,
                  "&:hover": { bgcolor: CHAT_COLORS.orangeMuted },
                }}
              >
                <ClipIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            sx={{
              color:
                originalTextLength > MAX_ORIGINAL_TEXT_LENGTH ? "#ff8a80" : CHAT_COLORS.textOnDarkMuted,
            }}
          >
            {originalTextLength} / {hasValidCharacterLimit ? characterLimitValue : MAX_ORIGINAL_TEXT_LENGTH}
            文字
          </Typography>
        </Box>

        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleSubmit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{
            bgcolor: CHAT_COLORS.orange,
            color: CHAT_COLORS.bubbleText,
            fontWeight: 700,
            borderRadius: "999px",
            "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
            "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
          }}
        >
          添削する
        </Button>
      </Stack>

      <Snackbar
        open={pdfToastOpen}
        autoHideDuration={3000}
        onClose={() => setPdfToastOpen(false)}
        message="PDF添付は現在準備中です"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
