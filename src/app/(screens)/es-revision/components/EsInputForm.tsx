"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { FieldLabel, fieldSx } from "@/app/components/FormFields";
import { extractEsText } from "@/lib/api/es-documents";
import { ApiError } from "@/lib/api/errors";
import { countCodePoints } from "@/shared/validation/count-code-points";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CompanySummary } from "@/types/company";
import type { CreateEsDocumentRequest } from "@/types/es-document";
import type { ExperienceResponse } from "@/types/experience";

// docs/openapi.yaml CreateEsDocumentRequest の上限
const MAX_QUESTION_LENGTH = 5000;
const MAX_TARGET_ROLE_LENGTH = 200;
const MAX_ORIGINAL_TEXT_LENGTH = 20000;
const MAX_CHARACTER_LIMIT = 10000;

// docs/openapi.yaml POST /api/v1/es-text-extractions が受け付けるファイル形式
const ACCEPTED_FILE_TYPES = "image/png,image/jpeg,application/pdf";

const selectControlSx = {
  "& .MuiInputLabel-root": { color: CHAT_COLORS.textOnDarkMuted },
  "& .MuiInputLabel-root.Mui-focused": { color: CHAT_COLORS.orange },
  "& .MuiOutlinedInput-root": {
    bgcolor: CHAT_COLORS.userBubble,
    borderRadius: "16px",
    "& fieldset": { borderColor: CHAT_COLORS.orange, borderWidth: 2 },
    "&:hover fieldset": { borderColor: CHAT_COLORS.orange },
    "&.Mui-focused fieldset": { borderColor: CHAT_COLORS.orange },
  },
  "& .MuiFormHelperText-root": { color: CHAT_COLORS.textOnDarkMuted },
};

// POST /api/v1/es-text-extractions のエラーレスポンスを画面表示用の文言へ変換する
function toExtractionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.response.code) {
      case "PAYLOAD_TOO_LARGE":
        return "ファイルサイズが大きすぎます(上限10MB)。";
      case "UNSUPPORTED_MEDIA_TYPE":
        return "PNG・JPEG・PDF(10ページ以下、暗号化なし)のみ添付できます。";
      default:
        return err.response.message || "ファイルからの文字抽出に失敗しました。";
    }
  }
  return "ファイルからの文字抽出に失敗しました。通信状況を確認してください。";
}

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
  // 現在実行中のAPI呼び出し段階(作成/原文分析/推敲)を表す文言。実行中でなければnull
  progressLabel?: string | null;
  fieldErrors: Record<string, string>;
  companies: CompanySummary[];
  experiences: ExperienceResponse[];
  initialRequest?: CreateEsDocumentRequest | null;
  existingDocument?: boolean;
  onSubmit: (request: CreateEsDocumentRequest) => void;
}

// ES入力フォーム。設問・文字数上限・ES原文を入力し、「検査する」でES文書作成→原文検査まで進める。
// PNG/JPEG/PDFの添付は POST /api/v1/es-text-extractions で抽出した文章をES原文欄へ反映する
export function EsInputForm({
  submitting,
  progressLabel,
  fieldErrors,
  companies,
  experiences,
  initialRequest,
  existingDocument = false,
  onSubmit,
}: EsInputFormProps) {
  const [companyId, setCompanyId] = useState(initialRequest?.companyId ?? "");
  const [targetRole, setTargetRole] = useState(initialRequest?.targetRole ?? "");
  const [preferredExperienceIds, setPreferredExperienceIds] = useState<string[]>(initialRequest?.preferredExperienceIds ?? []);
  const [question, setQuestion] = useState(initialRequest?.question ?? "");
  const [characterLimit, setCharacterLimit] = useState(String(initialRequest?.characterLimit ?? 400));
  const [originalText, setOriginalText] = useState(initialRequest?.originalText ?? "");
  const [extracting, setExtracting] = useState(false);
  const [extractionToast, setExtractionToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originalTextLength = countCodePoints(originalText);
  const characterLimitValue = Number(characterLimit);
  const hasValidCharacterLimit =
    characterLimit.trim() !== "" &&
    Number.isInteger(characterLimitValue) &&
    characterLimitValue >= 1 &&
    characterLimitValue <= MAX_CHARACTER_LIMIT;

  const canSubmit =
    !submitting &&
    !extracting &&
    countCodePoints(targetRole) <= MAX_TARGET_ROLE_LENGTH &&
    countCodePoints(question.trim()) > 0 &&
    countCodePoints(question) <= MAX_QUESTION_LENGTH &&
    hasValidCharacterLimit &&
    originalTextLength > 0 &&
    originalTextLength <= MAX_ORIGINAL_TEXT_LENGTH;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      companyId: companyId || null,
      targetRole: targetRole.trim() || null,
      question,
      characterLimit: characterLimitValue,
      originalText,
      preferredExperienceIds,
      emphasis: initialRequest?.emphasis ?? [],
    });
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 同じファイルを連続選択してもchangeイベントが発火するようにリセットする
    event.target.value = "";
    if (!file) return;

    setExtracting(true);
    try {
      const extraction = await extractEsText(file);
      setOriginalText(extraction.extractedText);
      setExtractionToast(
        extraction.warnings.length > 0
          ? `テキストを抽出しました。内容を確認してください。(${extraction.warnings.join(" / ")})`
          : "テキストを抽出しました。内容を確認してください。",
      );
    } catch (err) {
      setExtractionToast(toExtractionErrorMessage(err));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 3,
        border: `1px solid ${CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2.5,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          bgcolor: CHAT_COLORS.orange,
        },
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
            {existingDocument ? "保存済みESを編集する" : "ESを入力する"}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: CHAT_COLORS.textOnDarkMuted, lineHeight: 1.7 }}>
            設問と原文を入力してください。確認済みの経験を優先すると、根拠との照合がより明確になります。
          </Typography>
        </Box>

        <FormControl fullWidth error={Boolean(fieldErrors.companyId)} sx={selectControlSx}>
          <InputLabel id="es-company-label">企業（任意）</InputLabel>
          <Select
            labelId="es-company-label"
            value={companyId}
            label="企業（任意）"
            disabled={submitting}
            onChange={(event) => {
              const nextCompanyId = event.target.value;
              setCompanyId(nextCompanyId);
              const company = companies.find((item) => item.id === nextCompanyId);
              if (!targetRole.trim() && company?.targetRole) setTargetRole(company.targetRole);
            }}
          >
            <MenuItem value="">企業を指定しない</MenuItem>
            {companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {fieldErrors.companyId ?? (companies.length === 0 ? "登録済み企業はありません。" : "企業情報は任意です。")}
          </FormHelperText>
        </FormControl>

        <Stack spacing={0.75}>
          <FieldLabel>応募職種（任意）</FieldLabel>
          <TextField
            placeholder="例: ソフトウェアエンジニア"
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            error={Boolean(fieldErrors.targetRole) || countCodePoints(targetRole) > MAX_TARGET_ROLE_LENGTH}
            helperText={
              fieldErrors.targetRole ??
              (countCodePoints(targetRole) > MAX_TARGET_ROLE_LENGTH
                ? `${MAX_TARGET_ROLE_LENGTH}文字以内で入力してください。`
                : undefined)
            }
            fullWidth
            disabled={submitting}
            sx={fieldSx}
          />
        </Stack>

        <FormControl fullWidth error={Boolean(fieldErrors.preferredExperienceIds)} sx={selectControlSx}>
          <InputLabel id="es-experiences-label">優先する経験（任意）</InputLabel>
          <Select
            labelId="es-experiences-label"
            multiple
            value={preferredExperienceIds}
            disabled={submitting}
            onChange={(event) => {
              const value = event.target.value;
              setPreferredExperienceIds(typeof value === "string" ? value.split(",") : value);
            }}
            input={<OutlinedInput label="優先する経験（任意）" />}
            renderValue={(selected) =>
              selected
                .map((id) => experiences.find((experience) => experience.id === id)?.title ?? id)
                .join("、")
            }
          >
            {experiences.map((experience) => (
              <MenuItem key={experience.id} value={experience.id}>
                <Checkbox checked={preferredExperienceIds.includes(experience.id)} />
                <ListItemText primary={experience.title} secondary={experience.situation} />
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {fieldErrors.preferredExperienceIds ??
              (experiences.length === 0
                ? "確認済み経験はありません。未指定でもESの保存と検査はできます。"
                : "未選択の確認済み経験も候補から除外されません。")}
          </FormHelperText>
        </FormControl>

        <Stack spacing={0.75}>
          <FieldLabel required>設問</FieldLabel>
          <TextField
            placeholder="学生時代に力を入れたことを教えてください"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            error={Boolean(fieldErrors.question) || countCodePoints(question) > MAX_QUESTION_LENGTH}
            helperText={
              fieldErrors.question ??
              (countCodePoints(question) > MAX_QUESTION_LENGTH
                ? `${MAX_QUESTION_LENGTH}文字以内で入力してください。`
                : undefined)
            }
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
          <Tooltip title="画像・PDFからテキストを抽出">
            <span>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                hidden
                onChange={(event) => void handleFileChange(event)}
              />
              <IconButton
                aria-label="画像・PDFを添付してテキストを抽出"
                disabled={submitting || extracting}
                onClick={handleAttachClick}
                sx={{
                  bgcolor: CHAT_COLORS.orangeMuted,
                  color: CHAT_COLORS.orange,
                  "&:hover": { bgcolor: CHAT_COLORS.orangeMuted },
                }}
              >
                {extracting ? <CircularProgress size={20} color="inherit" /> : <ClipIcon />}
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
            {existingDocument ? "更新して再検査する" : "保存して検査する"}
        </Button>

        {submitting && progressLabel && (
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, textAlign: "center" }}>
            {progressLabel}
          </Typography>
        )}
      </Stack>

      <Snackbar
        open={extractionToast !== null}
        autoHideDuration={4000}
        onClose={() => setExtractionToast(null)}
        message={extractionToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
