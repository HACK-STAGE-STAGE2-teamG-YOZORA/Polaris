"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { countCodePoints } from "@/shared/validation/count-code-points";
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
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1">ESを入力する</Typography>

        <TextField
          label="設問"
          placeholder="学生時代に力を入れたことを教えてください"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          error={Boolean(fieldErrors.question)}
          helperText={fieldErrors.question}
          multiline
          minRows={2}
          fullWidth
          required
          disabled={submitting}
        />

        <TextField
          label="文字数上限"
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
          required
          disabled={submitting}
        />

        <TextField
          label="ES原文"
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
          required
          disabled={submitting}
        />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tooltip title="PDF添付(準備中)">
            <span>
              <IconButton
                aria-label="PDFを添付"
                disabled={submitting}
                onClick={() => setPdfToastOpen(true)}
              >
                <ClipIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            color={originalTextLength > MAX_ORIGINAL_TEXT_LENGTH ? "error" : "text.secondary"}
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
    </Paper>
  );
}
