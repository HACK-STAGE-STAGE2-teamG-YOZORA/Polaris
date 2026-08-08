"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";

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

function CloseIcon() {
  return (
    <SvgIcon fontSize="small">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </SvgIcon>
  );
}

// 経験カード確認。docs/product-scope.md のとおり、AIが作る案は必ずDRAFTで、
// 本人が内容を修正・確認して初めて4軸分析とESの正式根拠になる。
//
// トリガー自体はメッセージ入力欄のすぐ上に常に固定表示し、確認フォームはDialogで開く。
// 会話が長くなっても、画面のどこを見ていても操作にスクロールが不要になるようにするため
// （以前は画面上部の固定パネルで、下までスクロールした状態から毎回上へ戻る必要があった）
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
  const fullScreenDialog = useMediaQuery("(max-width:600px)");

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          borderRadius: 3,
          border: `1px solid ${experienceReady ? CHAT_COLORS.orange : CHAT_COLORS.navyBorder}`,
          bgcolor: CHAT_COLORS.navySurface,
          p: 1.5,
        }}
      >
        <Stack spacing={1}>
          {experienceReady && !notice && (
            <Typography variant="caption" sx={{ color: CHAT_COLORS.orange, fontWeight: 700 }}>
              経験カードを作れそうです
            </Typography>
          )}
          {notice && (
            <Typography variant="body2" sx={{ color: CHAT_COLORS.orange }}>
              {notice}
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <TextField
              select
              size="small"
              value={experienceType}
              onChange={(event) => setExperienceType(event.target.value as ExperienceType)}
              disabled={creatingDraft || !hasUserMessage}
              sx={{ ...fieldSx, minWidth: 160 }}
            >
              {EXPERIENCE_TYPE_ORDER.map((value) => (
                <MenuItem key={value} value={value}>
                  {EXPERIENCE_TYPE_LABELS[value]}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="contained"
              size="small"
              onClick={() => onCreateDraft(experienceType)}
              disabled={creatingDraft || !hasUserMessage}
              startIcon={creatingDraft ? <CircularProgress size={16} color="inherit" /> : undefined}
              data-tutorial="create-draft-button"
              sx={{
                bgcolor: CHAT_COLORS.orange,
                color: CHAT_COLORS.bubbleText,
                fontWeight: 700,
                borderRadius: "999px",
                "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                "&.Mui-disabled": { bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.textOnDarkMuted },
              }}
            >
              {creatingDraft ? "作成中..." : "経験カードを作る"}
            </Button>

            <Button
              component={Link}
              href={EXPERIENCES_PATH}
              variant="text"
              size="small"
              sx={{ color: CHAT_COLORS.textOnDarkMuted }}
            >
              経験一覧（確認済み{confirmedExperienceCount}件）
            </Button>
          </Stack>

          {!hasUserMessage && (
            <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              まずは質問に一度答えると経験カードを作れます。
            </Typography>
          )}
        </Stack>
      </Box>

      {/* 確認フォームはダイアログ内で完結させ、背後のチャット画面のスクロール位置に依存しない */}
      <Dialog
        open={draftExperience !== null}
        onClose={onDismissDraft}
        fullScreen={fullScreenDialog}
        fullWidth
        maxWidth="sm"
        scroll="paper"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          経験カードの確認
          <IconButton onClick={onDismissDraft} size="small" aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: CHAT_COLORS.navy }}>
          {draftExperience && (
            <ExperienceCardForm
              key={draftExperience.id}
              experience={draftExperience}
              saving={savingDraft}
              onSave={onSaveDraft}
              onCancel={onDismissDraft}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
