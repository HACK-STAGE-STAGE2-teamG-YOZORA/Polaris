"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { FieldLabel, fieldSx } from "@/app/components/FormFields";
import {
  ENERGY_CHANGE_OPTIONS,
  EXPERIENCE_TYPE_LABELS,
  EXPERIENCE_TYPE_ORDER,
} from "@/shared/self-analysis/experience-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type {
  ExperienceResponse,
  ExperienceType,
  UpdateExperienceRequest,
} from "@/types/experience";

// 配列項目は「1行1件」のテキストとして編集する
function toLines(items: string[]): string {
  return items.join("\n");
}

function fromLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

// 任意項目の空欄はnullとして送り、「未設定」であることをAPIへ明示する
// （docs/implementation-rules.md: 未設定自体に意味がある項目は省略せずnull）
function toNullable(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

interface ExperienceCardFormProps {
  experience: ExperienceResponse;
  saving: boolean;
  // statusを含めない保存＝内容の修正のみ。CONFIRMED済みカードを編集した場合、
  // サーバー側で自動的にDRAFTへ戻る（docs/openapi.yaml updateExperience）
  onSave: (body: UpdateExperienceRequest) => void;
  onCancel?: () => void;
  errorMessage?: string | null;
}

// AIが抽出した経験カード案を本人が修正・確認するフォーム。
// 自己分析チャット（経験カード確認）と経験一覧の両方から使う。
// docs/product-scope.md: 確認済み(CONFIRMED)経験だけが4軸分析とESの正式根拠になる
export function ExperienceCardForm({
  experience,
  saving,
  onSave,
  onCancel,
  errorMessage,
}: ExperienceCardFormProps) {
  const [type, setType] = useState<ExperienceType>(experience.type);
  const [title, setTitle] = useState(experience.title);
  const [situation, setSituation] = useState(experience.situation);
  const [goal, setGoal] = useState(experience.goal ?? "");
  const [role, setRole] = useState(experience.role);
  const [options, setOptions] = useState(toLines(experience.options));
  const [decision, setDecision] = useState(experience.decision ?? "");
  const [decisionReason, setDecisionReason] = useState(experience.decisionReason ?? "");
  const [actions, setActions] = useState(toLines(experience.actions));
  const [result, setResult] = useState(experience.result ?? "");
  const [positiveEmotion, setPositiveEmotion] = useState(experience.positiveEmotion ?? "");
  const [negativeEmotion, setNegativeEmotion] = useState(experience.negativeEmotion ?? "");
  const [energyChange, setEnergyChange] = useState(experience.energyChange);
  const [environment, setEnvironment] = useState(toLines(experience.environment));

  // docs/openapi.yaml updateExperience: CONFIRMEDにはtitle・situation・role・actionsが必要
  const canConfirm =
    title.trim() !== "" &&
    situation.trim() !== "" &&
    role.trim() !== "" &&
    fromLines(actions).length > 0;

  const buildBody = (status?: "CONFIRMED"): UpdateExperienceRequest => ({
    type,
    title: title.trim(),
    situation: situation.trim(),
    goal: toNullable(goal),
    role: role.trim(),
    options: fromLines(options),
    decision: toNullable(decision),
    decisionReason: toNullable(decisionReason),
    actions: fromLines(actions),
    result: toNullable(result),
    positiveEmotion: toNullable(positiveEmotion),
    negativeEmotion: toNullable(negativeEmotion),
    energyChange,
    environment: fromLines(environment),
    ...(status ? { status } : {}),
  });

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
          経験カードの内容を確認する
        </Typography>
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          AIが会話から作った案です。事実と違う部分は書き直してください。
          「確認済みにする」を押したカードだけが4軸分析とESの根拠になります。
        </Typography>

        <Stack spacing={0.75}>
          <FieldLabel required>経験の種類</FieldLabel>
          <TextField
            select
            value={type}
            onChange={(event) => setType(event.target.value as ExperienceType)}
            disabled={saving}
            sx={fieldSx}
          >
            {EXPERIENCE_TYPE_ORDER.map((value) => (
              <MenuItem key={value} value={value}>
                {EXPERIENCE_TYPE_LABELS[value]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>タイトル</FieldLabel>
          <TextField
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={saving}
            error={title.trim() === ""}
            helperText={title.trim() === "" ? "入力してください（120文字以内）" : "120文字以内"}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>状況</FieldLabel>
          <TextField
            value={situation}
            onChange={(event) => setSituation(event.target.value)}
            disabled={saving}
            multiline
            minRows={3}
            error={situation.trim() === ""}
            helperText={situation.trim() === "" ? "入力してください" : "いつ・どこで・何があったか"}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>目標（任意）</FieldLabel>
          <TextField
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>自分の役割</FieldLabel>
          <TextField
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={saving}
            error={role.trim() === ""}
            helperText={role.trim() === "" ? "入力してください" : undefined}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>検討した選択肢（任意・1行に1件）</FieldLabel>
          <TextField
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>選んだこと（任意）</FieldLabel>
          <TextField
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>選んだ理由（任意）</FieldLabel>
          <TextField
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>実際にしたこと（1行に1件）</FieldLabel>
          <TextField
            value={actions}
            onChange={(event) => setActions(event.target.value)}
            disabled={saving}
            multiline
            minRows={3}
            error={fromLines(actions).length === 0}
            helperText={fromLines(actions).length === 0 ? "1件以上入力してください" : "1行に1件ずつ書いてください"}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>結果（任意）</FieldLabel>
          <TextField
            value={result}
            onChange={(event) => setResult(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>うれしかったこと（任意）</FieldLabel>
          <TextField
            value={positiveEmotion}
            onChange={(event) => setPositiveEmotion(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>つらかったこと（任意）</FieldLabel>
          <TextField
            value={negativeEmotion}
            onChange={(event) => setNegativeEmotion(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            sx={fieldSx}
          />
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel required>この経験のあとの元気の変化</FieldLabel>
          <TextField
            select
            value={energyChange}
            onChange={(event) => setEnergyChange(Number(event.target.value))}
            disabled={saving}
            sx={fieldSx}
          >
            {ENERGY_CHANGE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack spacing={0.75}>
          <FieldLabel>環境・条件（任意・1行に1件）</FieldLabel>
          <TextField
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            disabled={saving}
            multiline
            minRows={2}
            helperText="例: 少人数のチーム / 締め切りが短い"
            sx={fieldSx}
          />
        </Stack>

        {/* 根拠として引用された本人の発言。ここから元の会話内容を確認できる */}
        {experience.evidenceQuotes.length > 0 && (
          <Stack spacing={0.75}>
            <FieldLabel>もとになったあなたの発言</FieldLabel>
            {experience.evidenceQuotes.map((quote) => (
              <Typography
                key={`${quote.messageId}-${quote.quote}`}
                variant="body2"
                sx={{
                  color: CHAT_COLORS.textOnDarkMuted,
                  borderLeft: `3px solid ${CHAT_COLORS.orange}`,
                  pl: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {quote.quote}
              </Typography>
            ))}
          </Stack>
        )}

        {errorMessage && (
          <Typography variant="body2" sx={{ color: "#FFD1D1" }}>
            {errorMessage}
          </Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => onSave(buildBody("CONFIRMED"))}
            disabled={saving || !canConfirm}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              borderRadius: "999px",
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
              "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
            }}
          >
            確認済みにする
          </Button>
          <Button
            variant="outlined"
            onClick={() => onSave(buildBody())}
            disabled={saving}
            sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}
          >
            下書きとして保存
          </Button>
          {onCancel && (
            <Button
              variant="text"
              onClick={onCancel}
              disabled={saving}
              sx={{ color: CHAT_COLORS.textOnDarkMuted }}
            >
              閉じる
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
