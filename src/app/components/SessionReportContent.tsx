"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SessionAxisRow } from "@/app/components/SessionAxisRow";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CareerCondition, SelfAnalysisReport } from "@/types/self-analysis-report";

function ConditionGroup({ title, conditions }: { title: string; conditions: CareerCondition[] }) {
  if (conditions.length === 0) return null;
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
        {title}
      </Typography>
      {conditions.map((condition) => (
        <Typography key={condition.statement} variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
          ・{condition.statement}
        </Typography>
      ))}
    </Stack>
  );
}

// セッション単体の自己分析結果の中身。SessionReportDialog（経験カードからの小さいダイアログ）と
// SessionResultReveal（チャット完了直後の大きな結果表示）の両方から共有する
export function SessionReportContent({ report }: { report: SelfAnalysisReport }) {
  return (
    <Stack spacing={2.5}>
      {report.freshness === "STALE" && (
        <Typography variant="caption" sx={{ color: CHAT_COLORS.orange }}>
          ※このセッションの後に経験の修正などがあり、内容が最新でない可能性があります。
        </Typography>
      )}

      <Typography sx={{ color: "rgba(255,255,255,0.92)", lineHeight: 1.8 }}>{report.summary}</Typography>

      <Stack spacing={2}>
        {report.axes.map((axis) => (
          <SessionAxisRow key={axis.axisAssessmentId} axis={axis} />
        ))}
      </Stack>

      <ConditionGroup title="重視したい条件" conditions={report.mustConditions} />
      <ConditionGroup title="できれば重視したい条件" conditions={report.preferConditions} />
      <ConditionGroup title="避けたい条件" conditions={report.avoidConditions} />
      <ConditionGroup title="今後確かめたいこと" conditions={report.verifyConditions} />

      {report.nextExperiments.length > 0 && (
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
            次に試すとよさそうなこと
          </Typography>
          {report.nextExperiments.map((experiment) => (
            <Typography key={experiment} variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
              ・{experiment}
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
