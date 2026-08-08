"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { ExperienceCardForm } from "@/app/components/ExperienceCardForm";
import { FieldLabel, fieldSx } from "@/app/components/FormFields";
import { EXPERIENCES_PATH } from "@/shared/routes";
import {
  EXPERIENCE_TYPE_LABELS,
  EXPERIENCE_TYPE_ORDER,
} from "@/shared/self-analysis/experience-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type {
  ExperienceResponse,
  ExperienceType,
  UpdateExperienceRequest,
} from "@/types/experience";

interface ExperienceDraftPanelProps {
  // AIが「経験カードを作れる」と判断したターンでtrueになる
  experienceReady: boolean;
  confirmedExperienceCount: number;
  draftExperience: ExperienceResponse | null;
  creatingDraft: boolean;
  savingDraft: boolean;
  notice: string | null;
  hasUserMessage: boolean;
  onCreateDraft: (experienceType: ExperienceType) => void;
  onSaveDraft: (body: UpdateExperienceRequest) => void;
  onDismissDraft: () => void;
}

// 経験カード確認。docs/product-scope.md のとおり、AIが作る案は必ずDRAFTで、
// 本人が内容を修正・確認して初めて4軸分析とESの正式根拠になる
export function ExperienceDraftPanel({
  experienceReady,
  confirmedExperienceCount,
  draftExperience,
  creatingDraft,
  savingDraft,
  notice,
  hasUserMessage,
  onCreateDraft,
  onSaveDraft,
  onDismissDraft,
}: ExperienceDraftPanelProps) {
  const [experienceType, setExperienceType] = useState<ExperienceType>("ENGAGED");

  // 確認待ちの案がある間はフォームだけを出す。
  // keyを付けて、別の案に切り替わったときに入力状態を持ち越さないようにする
  if (draftExperience) {
    return (
      <ExperienceCardForm
        key={draftExperience.id}
        experience={draftExperience}
        saving={savingDraft}
        onSave={onSaveDraft}
        onCancel={onDismissDraft}
      />
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${experienceReady ? CHAT_COLORS.orange : CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
          {experienceReady ? "経験カードを作れそうです" : "会話から経験カードを作る"}
        </Typography>
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          ここまでの会話からAIが経験カードの案を作ります。内容はあなたが確認・修正してから保存します。
        </Typography>

        {notice && (
          <Typography variant="body2" sx={{ color: CHAT_COLORS.orange }}>
            {notice}
          </Typography>
        )}

        <Stack spacing={0.75}>
          <FieldLabel>どんな経験としてまとめますか</FieldLabel>
          <TextField
            select
            size="small"
            value={experienceType}
            onChange={(event) => setExperienceType(event.target.value as ExperienceType)}
            disabled={creatingDraft || !hasUserMessage}
            sx={fieldSx}
          >
            {EXPERIENCE_TYPE_ORDER.map((value) => (
              <MenuItem key={value} value={value}>
                {EXPERIENCE_TYPE_LABELS[value]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => onCreateDraft(experienceType)}
            disabled={creatingDraft || !hasUserMessage}
            startIcon={creatingDraft ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              borderRadius: "999px",
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
              "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
            }}
          >
            {creatingDraft ? "作成中..." : "経験カードの案を作る"}
          </Button>
          <Button
            component={Link}
            href={EXPERIENCES_PATH}
            variant="text"
            size="small"
            sx={{ color: CHAT_COLORS.textOnDarkMuted }}
          >
            経験一覧を見る（確認済み{confirmedExperienceCount}件）
          </Button>
        </Stack>

        {!hasUserMessage && (
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            まずは質問に一度答えてください。
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
