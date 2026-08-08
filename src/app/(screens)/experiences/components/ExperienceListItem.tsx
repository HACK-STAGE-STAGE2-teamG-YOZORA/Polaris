"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {
  EXPERIENCE_STATUS_LABELS,
  EXPERIENCE_TYPE_LABELS,
} from "@/shared/self-analysis/experience-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { ExperienceResponse } from "@/types/experience";

interface ExperienceListItemProps {
  experience: ExperienceResponse;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  disabled: boolean;
}

// 一覧に並べる1件分の経験カード。詳細の編集はExperienceCardFormが担当する
export function ExperienceListItem({
  experience,
  onEdit,
  onDelete,
  deleting,
  disabled,
}: ExperienceListItemProps) {
  const confirmed = experience.status === "CONFIRMED";

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${confirmed ? CHAT_COLORS.orange : CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
          <Chip
            size="small"
            label={EXPERIENCE_STATUS_LABELS[experience.status]}
            sx={
              confirmed
                ? { bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700 }
                : { bgcolor: CHAT_COLORS.navySurface, color: CHAT_COLORS.textOnDarkMuted, border: `1px solid ${CHAT_COLORS.navyBorder}` }
            }
          />
          <Chip
            size="small"
            label={EXPERIENCE_TYPE_LABELS[experience.type]}
            sx={{ bgcolor: "transparent", color: CHAT_COLORS.textOnDarkMuted, border: `1px solid ${CHAT_COLORS.navyBorder}` }}
          />
        </Stack>

        <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
          {experience.title}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: CHAT_COLORS.textOnDarkMuted,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {experience.situation}
        </Typography>

        <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          更新 {new Date(experience.updatedAt).toLocaleString()}
          {!confirmed && " / 下書きは4軸分析とESの根拠になりません"}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={onEdit}
            disabled={disabled}
            sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}
          >
            {confirmed ? "内容を見る・修正する" : "確認して確定する"}
          </Button>
          <Button
            size="small"
            variant="text"
            color="error"
            onClick={onDelete}
            disabled={disabled || deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            削除
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
