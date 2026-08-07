import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { EsAnalysis } from "@/types/es-document";
import type { EsComment, EsCommentCategory, EsCommentSeverity, SubmissionReadiness } from "../use-es-revision";

interface EsCommentsProps {
  analysis: EsAnalysis;
  characterLimit: number;
  comments: EsComment[];
  submissionReadiness: SubmissionReadiness;
}

const CATEGORY_LABEL: Record<EsCommentCategory, string> = {
  EVIDENCE_STATUS: "根拠",
  ISSUE: "指摘",
  IMPROVEMENT_REASON: "改善理由",
};

// severityごとにアクセントカラーを変え、紺色ベースの吹き出しでもERROR/WARNING/INFOが
// 同じ見た目にならないようにする
const SEVERITY_ACCENT: Record<EsCommentSeverity, string> = {
  ERROR: "#F2755B",
  WARNING: CHAT_COLORS.orange,
  INFO: "#6FA8DC",
};

const SEVERITY_LABEL: Record<EsCommentSeverity, string> = {
  ERROR: "エラー",
  WARNING: "注意",
  INFO: "情報",
};

const QUESTION_COVERAGE_LABEL: Record<EsAnalysis["questionCoverage"], string> = {
  ANSWERED: "設問に回答できています",
  PARTIALLY_ANSWERED: "設問に一部しか回答できていません",
  NOT_ANSWERED: "設問に回答できていません",
};

// AIコメント画面。verify結果(EsAnalysis)から合成したcomments配列を、
// 紺色ベースの吹き出し風カード(severityごとに左端のアクセント色で区別)で表示する。
// 提出準備状況は数値スコアを使わず、設問回答状況・文字数・根拠状態で説明する
export function EsComments({ analysis, characterLimit, comments, submissionReadiness }: EsCommentsProps) {
  const verifiedClaimCount = analysis.claims.filter((claim) => claim.status === "VERIFIED").length;
  const needsAttentionClaimCount = analysis.claims.length - verifiedClaimCount;
  const readinessAccent = submissionReadiness === "READY_TO_SUBMIT" ? "#6FCF97" : CHAT_COLORS.orange;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          borderRadius: 3,
          border: `1px solid ${readinessAccent}`,
          bgcolor: CHAT_COLORS.navySurface,
          borderLeft: `4px solid ${readinessAccent}`,
          p: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ color: readinessAccent, fontWeight: 700 }}>
          {submissionReadiness === "READY_TO_SUBMIT" ? "提出の準備ができています" : "まだ見直しが必要です"}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
            ・{QUESTION_COVERAGE_LABEL[analysis.questionCoverage]}
          </Typography>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
            ・文字数 {analysis.characterCount} / {characterLimit}文字（
            {analysis.withinCharacterLimit ? "上限内です" : "上限を超えています"}）
          </Typography>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
            ・根拠確認済みの主張 {verifiedClaimCount}件
            {needsAttentionClaimCount > 0 ? ` / 要確認の主張 ${needsAttentionClaimCount}件` : ""}
          </Typography>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: CHAT_COLORS.navyBorder }} />

      {comments.length === 0 ? (
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
          特に指摘事項はありませんでした。
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {comments.map((comment) => {
            const accent = SEVERITY_ACCENT[comment.severity];
            return (
              <Box
                key={comment.id}
                sx={{
                  position: "relative",
                  maxWidth: "90%",
                  borderRadius: "4px 16px 16px 16px",
                  bgcolor: CHAT_COLORS.navySurface,
                  border: `1px solid ${CHAT_COLORS.navyBorder}`,
                  borderLeft: `4px solid ${accent}`,
                  px: 2,
                  py: 1.25,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                  <Chip
                    label={CATEGORY_LABEL[comment.category]}
                    size="small"
                    sx={{
                      bgcolor: CHAT_COLORS.navyBorder,
                      color: CHAT_COLORS.textOnDark,
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    label={SEVERITY_LABEL[comment.severity]}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: accent, color: accent, fontWeight: 600 }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
                  {comment.message}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
