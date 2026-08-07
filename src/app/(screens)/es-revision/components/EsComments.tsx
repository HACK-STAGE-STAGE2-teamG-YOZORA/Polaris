import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { EsAnalysis } from "@/types/es-document";
import type { EsComment, EsCommentCategory, SubmissionReadiness } from "../use-es-revision";

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

const QUESTION_COVERAGE_LABEL: Record<EsAnalysis["questionCoverage"], string> = {
  ANSWERED: "設問に回答できています",
  PARTIALLY_ANSWERED: "設問に一部しか回答できていません",
  NOT_ANSWERED: "設問に回答できていません",
};

// AIコメント画面。verify結果(EsAnalysis)から合成したcomments配列を吹き出し形式で表示し、
// 提出準備状況(数値スコアは使わず、設問回答状況・文字数・根拠状態で説明する)を示す
export function EsComments({ analysis, characterLimit, comments, submissionReadiness }: EsCommentsProps) {
  const verifiedClaimCount = analysis.claims.filter((claim) => claim.status === "VERIFIED").length;
  const needsAttentionClaimCount = analysis.claims.length - verifiedClaimCount;

  return (
    <Stack spacing={2}>
      <Alert severity={submissionReadiness === "READY_TO_SUBMIT" ? "success" : "warning"}>
        <AlertTitle>
          {submissionReadiness === "READY_TO_SUBMIT" ? "提出の準備ができています" : "まだ見直しが必要です"}
        </AlertTitle>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2">
            ・{QUESTION_COVERAGE_LABEL[analysis.questionCoverage]}
          </Typography>
          <Typography variant="body2">
            ・文字数 {analysis.characterCount} / {characterLimit}文字（
            {analysis.withinCharacterLimit ? "上限内です" : "上限を超えています"}）
          </Typography>
          <Typography variant="body2">
            ・根拠確認済みの主張 {verifiedClaimCount}件
            {needsAttentionClaimCount > 0 ? ` / 要確認の主張 ${needsAttentionClaimCount}件` : ""}
          </Typography>
        </Stack>
      </Alert>

      <Divider />

      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          特に指摘事項はありませんでした。
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {comments.map((comment) => (
            <Box key={comment.id} sx={{ maxWidth: "90%" }}>
              <Alert
                severity={comment.severity.toLowerCase() as "error" | "warning" | "info"}
                sx={{ borderRadius: "4px 12px 12px 12px" }}
                icon={false}
              >
                <Chip
                  label={CATEGORY_LABEL[comment.category]}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 0.5 }}
                />
                <Typography variant="body2">{comment.message}</Typography>
              </Alert>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
