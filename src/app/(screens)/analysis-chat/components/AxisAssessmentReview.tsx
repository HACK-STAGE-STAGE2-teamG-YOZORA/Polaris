"use client";

import Link from "next/link";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { HOME_PATH } from "@/shared/routes";
import {
  AXIS_LABELS,
  REVIEWABLE_ASSESSMENTS,
  USER_ASSESSMENT_LABELS,
  formatAssessmentStatus,
  formatAxisPosition,
} from "@/shared/self-analysis/axis-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AxisAssessment, EvidenceReference, UserAssessment } from "@/types/axis-assessment";

interface AxisAssessmentReviewProps {
  assessments: AxisAssessment[];
  reviewingAxisId: string | null;
  onReview: (axisAssessmentId: string, assessment: UserAssessment) => void;
  unreviewedCount: number;
  hasStaleAssessment: boolean;
  canFinalize: boolean;
  onFinalize: () => void;
  finalizing: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
  completed: boolean;
  recomputeFailed: boolean;
}

function EvidenceList({ label, items }: { label: string; items: EvidenceReference[] }) {
  if (items.length === 0) return null;
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" sx={{ color: CHAT_COLORS.orange, fontWeight: 700 }}>
        {label}（{items.length}件）
      </Typography>
      {items.map((evidence) => (
        <Box key={evidence.id} sx={{ borderLeft: `3px solid ${CHAT_COLORS.navyBorder}`, pl: 1.5 }}>
          {/* 引用は本人の発言そのまま。ここから元の会話内容へ遡れる */}
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark, whiteSpace: "pre-wrap" }}>
            「{evidence.quote}」
          </Typography>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            {evidence.interpretation}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

// セッション固有の4軸結果と、その本人評価。
// docs/product-scope.md: 4軸すべてへの本人評価が終わるまでレポートを確定できない
export function AxisAssessmentReview({
  assessments,
  reviewingAxisId,
  onReview,
  unreviewedCount,
  hasStaleAssessment,
  canFinalize,
  onFinalize,
  finalizing,
  onRegenerate,
  regenerating,
  completed,
  recomputeFailed,
}: AxisAssessmentReviewProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, display: "block" }}>
        【生成された4軸分析結果】各軸に「当てはまるか」を選ぶと結果を確定できます
      </Typography>

      {assessments.map((assessment) => {
        const label = AXIS_LABELS[assessment.axis];
        const evidenceGroups: Array<{ label: string; items: EvidenceReference[] }> = [
          { label: `${label.leftJa}側の根拠`, items: assessment.leftEvidence },
          { label: `${label.rightJa}側の根拠`, items: assessment.rightEvidence },
          { label: "両方に当てはまる根拠", items: assessment.bothEvidence },
          { label: "状況によって変わる根拠", items: assessment.contextEvidence },
          { label: "反対方向の根拠", items: assessment.counterEvidence },
        ];
        const evidenceCount = evidenceGroups.reduce((total, group) => total + group.items.length, 0);
        const reviewing = reviewingAxisId === assessment.id;

        return (
          <Box
            key={assessment.id}
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: CHAT_COLORS.textOnDark,
            }}
          >
            <Stack spacing={1}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#F6C95D" }}>
                  {label.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, bgcolor: "rgba(246, 201, 93, 0.2)", px: 1, py: 0.2, borderRadius: 1 }}
                >
                  {formatAxisPosition(assessment.position, assessment.axis)}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.9)" }}>
                {assessment.displayStatement}
              </Typography>

              {/* 根拠の状態と件数。件数の多さと確信度を混同させないため別々に出す */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" label={formatAssessmentStatus(assessment.status)} sx={{ bgcolor: CHAT_COLORS.navySurface, color: CHAT_COLORS.textOnDark }} />
                <Chip
                  size="small"
                  label={evidenceCount === 0 ? "根拠不足" : `根拠 ${evidenceCount}件`}
                  sx={{ bgcolor: CHAT_COLORS.navySurface, color: CHAT_COLORS.textOnDark }}
                />
                {assessment.isStale && (
                  <Chip size="small" label="再生成が必要" sx={{ bgcolor: "rgba(248,113,113,0.2)", color: "#F87171" }} />
                )}
              </Stack>

              {assessment.contextNotes.length > 0 && (
                <Stack spacing={0.25}>
                  {assessment.contextNotes.map((note) => (
                    <Typography key={note} variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                      ※ {note}
                    </Typography>
                  ))}
                </Stack>
              )}

              {evidenceCount > 0 && (
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{ bgcolor: "transparent", color: CHAT_COLORS.textOnDark, "&::before": { display: "none" } }}
                >
                  <AccordionSummary sx={{ px: 0, minHeight: 0, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                    <Typography variant="caption" sx={{ color: CHAT_COLORS.orange, fontWeight: 700 }}>
                      根拠になったあなたの発言を見る
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                    <Stack spacing={1.5}>
                      {evidenceGroups.map((group) => (
                        <EvidenceList key={group.label} label={group.label} items={group.items} />
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}

              {evidenceCount === 0 ? (
                // 根拠不足の軸は判断する材料が何もないため、本人評価も求めない
                // （確定条件からも除外される。docs/screen-api-map.md 4.3）
                <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                  この軸を判断できる材料がまだありません。会話を続けるか、経験カードを確認済みにすると根拠が増え、評価できるようになります。
                </Typography>
              ) : (
                /* 本人評価。押した値だけが保存され、未評価のまま自動で埋めることはしない */
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                  {REVIEWABLE_ASSESSMENTS.map((value) => (
                    <Button
                      key={value}
                      size="small"
                      variant={assessment.userAssessment === value ? "contained" : "outlined"}
                      disabled={reviewingAxisId !== null || completed}
                      onClick={() => onReview(assessment.id, value)}
                      sx={
                        assessment.userAssessment === value
                          ? { bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, "&:hover": { bgcolor: CHAT_COLORS.orangeDark } }
                          : { color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder }
                      }
                    >
                      {USER_ASSESSMENT_LABELS[value]}
                    </Button>
                  ))}
                  {reviewing && <CircularProgress size={16} sx={{ color: CHAT_COLORS.orange }} />}
                </Stack>
              )}
            </Stack>
          </Box>
        );
      })}

      {/* 確定操作。未評価の軸が残っているあいだはサーバーが409を返すため、ここで止める */}
      <Stack spacing={1}>
        {hasStaleAssessment && (
          <Typography variant="caption" sx={{ color: "#FFD1D1" }}>
            評価のあとに会話が続いたため、4軸分析を作り直す必要があります。
          </Typography>
        )}
        {!completed && unreviewedCount > 0 && (
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            あと{unreviewedCount}軸の評価が残っています。4軸すべてを評価すると確定できます。
          </Typography>
        )}
        {recomputeFailed && (
          <Typography variant="caption" sx={{ color: "#FFD1D1" }}>
            結果は確定しましたが、ホームの総合傾向の再集計に失敗しました。ホームの「再集計する」からやり直せます。
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {hasStaleAssessment && !completed && (
            <Button
              variant="contained"
              size="medium"
              onClick={onRegenerate}
              disabled={regenerating}
              startIcon={regenerating ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700, "&:hover": { bgcolor: CHAT_COLORS.orangeDark } }}
            >
              4軸分析を作り直す
            </Button>
          )}

          {!completed && (
            <Button
              variant="contained"
              size="medium"
              onClick={onFinalize}
              disabled={!canFinalize || finalizing}
              startIcon={finalizing ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{
                bgcolor: "#10B981",
                color: "#fff",
                fontWeight: 700,
                "&:hover": { bgcolor: "#059669" },
                "&.Mui-disabled": { bgcolor: "rgba(16,185,129,0.25)", color: CHAT_COLORS.textOnDarkMuted },
              }}
            >
              {finalizing ? "確定＆総合反映中..." : "この結果を確定してホームの総合結果に反映する"}
            </Button>
          )}

          <Button
            component={Link}
            href={HOME_PATH}
            variant="outlined"
            size="medium"
            sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)", "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" } }}
          >
            ホーム（総合自己分析画面）へ戻る
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
