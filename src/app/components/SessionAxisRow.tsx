"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { AxisPositionBar } from "@/app/components/AxisPositionBar";
import { AXIS_LABELS, axisPositionToPercent, formatAxisPosition } from "@/shared/self-analysis/axis-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AxisAssessmentSnapshot } from "@/types/self-analysis-report";

// セッション単体の自己分析結果の軸1本分。Homeの総合傾向(HomeAxisRow)と同じバー見た目にするが、
// 表示する位置・コメントは総合ではなく「そのセッションで生成した」スナップショットの値
export function SessionAxisRow({ axis }: { axis: AxisAssessmentSnapshot }) {
  const label = AXIS_LABELS[axis.axis];
  const percent = axisPositionToPercent(axis.position);
  const positionText = formatAxisPosition(axis.position, axis.axis);

  return (
    <Stack spacing={1}>
      <AxisPositionBar label={label} percent={percent} positionText={positionText} />
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        <Typography sx={{ fontSize: 14, lineHeight: 1.7, color: CHAT_COLORS.textOnDark }}>
          {label.name}: {positionText}
        </Typography>
        {axis.displayStatement && (
          <Typography sx={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.86)" }}>
            {axis.displayStatement}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
