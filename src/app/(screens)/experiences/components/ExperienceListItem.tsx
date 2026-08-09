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
  // sourceSessionIdがある経験だけ「そのセッションの結果を見る」を出す(フォーム作成の経験にはない)
  onViewSession?: (sessionId: string) => void;
  deleting: boolean;
  disabled: boolean;
}

// 一覧に並べる1件分の経験カード。詳細の編集はExperienceCardFormが担当する
export function ExperienceListItem({
  experience,
  onEdit,
  onDelete,
  onViewSession,
  deleting,
  disabled,
}: ExperienceListItemProps) {
  const confirmed = experience.status === "CONFIRMED";

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 3,
        border: `1px solid ${confirmed ? CHAT_COLORS.orange : CHAT_COLORS.navyBorder}`,
        bgcolor: CHAT_COLORS.navySurface,
        p: 2.25,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          bgcolor: confirmed ? CHAT_COLORS.orange : CHAT_COLORS.navyBorder,
        },
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
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
          <Typography aria-hidden sx={{ color: confirmed ? CHAT_COLORS.orange : CHAT_COLORS.textOnDarkMuted, fontSize: 14 }}>
            ✦
          </Typography>
        </Stack>

        <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700, fontSize: 17, lineHeight: 1.6 }}>
          {experience.title}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: CHAT_COLORS.textOnDarkMuted,
            lineHeight: 1.8,
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
            sx={{
              color: confirmed ? CHAT_COLORS.textOnDark : CHAT_COLORS.bubbleText,
              borderColor: confirmed ? CHAT_COLORS.navyBorder : CHAT_COLORS.orange,
              bgcolor: confirmed ? "transparent" : CHAT_COLORS.orange,
              borderRadius: "999px",
              fontWeight: 700,
              "&:hover": { borderColor: CHAT_COLORS.orange, bgcolor: confirmed ? CHAT_COLORS.orangeMuted : CHAT_COLORS.orangeDark },
            }}
          >
            {confirmed ? "内容を見る・修正する" : "確認して確定する"}
          </Button>
          {experience.sourceSessionId && onViewSession && (
            <Button
              size="small"
              variant="text"
              onClick={() => onViewSession(experience.sourceSessionId!)}
              disabled={disabled}
              sx={{ color: CHAT_COLORS.orange }}
            >
              このセッションの結果を見る
            </Button>
          )}
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
