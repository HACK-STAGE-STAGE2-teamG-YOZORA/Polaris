import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type {
  ClaimEvidence,
  ClaimStatus,
  EsAiCommentCategory,
  EsAnalysis,
  EsIssueSeverity,
  SubmissionReadiness,
  TextRange,
} from "@/types/es-document";
import { textForRange } from "../es-revision-logic";

interface EsCommentsProps {
  analysis: EsAnalysis;
  characterLimit: number;
  sourceText: string;
  submissionReadiness: SubmissionReadiness;
}

const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  VERIFIED: "確認済み",
  PARTIALLY_VERIFIED: "一部確認",
  NEEDS_CONFIRMATION: "要確認",
  CONTRADICTED: "矛盾",
};

const CLAIM_STATUS_COLOR: Record<ClaimStatus, string> = {
  VERIFIED: "#6FCF97",
  PARTIALLY_VERIFIED: "#6FA8DC",
  NEEDS_CONFIRMATION: CHAT_COLORS.orange,
  CONTRADICTED: "#F2755B",
};

const SEVERITY_LABEL: Record<EsIssueSeverity, string> = {
  ERROR: "エラー",
  WARNING: "注意",
  INFO: "情報",
};

const SEVERITY_ACCENT: Record<EsIssueSeverity, string> = {
  ERROR: "#F2755B",
  WARNING: CHAT_COLORS.orange,
  INFO: "#6FA8DC",
};

const COMMENT_CATEGORY_LABEL: Record<EsAiCommentCategory, string> = {
  EVIDENCE_STATUS: "根拠状態",
  ISSUE: "問題箇所",
  IMPROVEMENT_REASON: "改善理由",
};

const COMMENT_CATEGORY_ORDER: EsAiCommentCategory[] = [
  "EVIDENCE_STATUS",
  "ISSUE",
  "IMPROVEMENT_REASON",
];

const QUESTION_COVERAGE_LABEL: Record<EsAnalysis["questionCoverage"], string> = {
  ANSWERED: "設問に回答できています",
  PARTIALLY_ANSWERED: "設問に一部しか回答できていません",
  NOT_ANSWERED: "設問に回答できていません",
};

function EvidenceList({ evidence }: { evidence: ClaimEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
        対応する確認済み根拠はありません。
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5}>
      {evidence.map((item, index) => (
        <Box key={`${item.sourceType}-${item.sourceId}-${index}`} sx={{ pl: 1, borderLeft: `2px solid ${CHAT_COLORS.navyBorder}` }}>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            {item.sourceType === "EXPERIENCE" ? "確認済み経験" : "企業公式情報"}・{item.sourceId}
          </Typography>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
            「{item.quote}」
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function TargetText({ text, range }: { text: string; range: TextRange | null }) {
  const target = textForRange(text, range);
  if (!target) return null;
  return (
    <Typography variant="body2" sx={{ color: CHAT_COLORS.orange, fontWeight: 700 }}>
      対象箇所: 「{target}」
    </Typography>
  );
}

export function EsComments({
  analysis,
  characterLimit,
  sourceText,
  submissionReadiness,
}: EsCommentsProps) {
  const verifiedClaimCount = analysis.claims.filter((claim) => claim.status === "VERIFIED").length;
  const readinessAccent = submissionReadiness === "READY_TO_SUBMIT" ? "#6FCF97" : CHAT_COLORS.orange;

  return (
    <Stack spacing={2.5}>
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
            ・根拠確認済みの主張 {verifiedClaimCount} / {analysis.claims.length}件
          </Typography>
        </Stack>
      </Box>

      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
          主張ごとの根拠状態
        </Typography>
        {analysis.claims.length === 0 ? (
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            検査対象となる主張はありませんでした。
          </Typography>
        ) : analysis.claims.map((claim) => {
          const accent = CLAIM_STATUS_COLOR[claim.status];
          return (
            <Box
              key={claim.id}
              sx={{ borderRadius: 2, border: `1px solid ${accent}`, bgcolor: CHAT_COLORS.navySurface, p: 1.5 }}
            >
              <Stack spacing={1}>
                <Chip
                  label={CLAIM_STATUS_LABEL[claim.status]}
                  size="small"
                  sx={{ alignSelf: "flex-start", color: accent, borderColor: accent }}
                  variant="outlined"
                />
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
                  {claim.sentence || claim.text}
                </Typography>
                <TargetText text={sourceText} range={claim.targetRange} />
                {claim.explanation && (
                  <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                    {claim.explanation}
                  </Typography>
                )}
                <EvidenceList evidence={claim.evidence} />
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ borderColor: CHAT_COLORS.navyBorder }} />

      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
          問題箇所
        </Typography>
        {analysis.issues.length === 0 ? (
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            問題箇所は検出されませんでした。
          </Typography>
        ) : analysis.issues.map((issue, index) => {
          const accent = SEVERITY_ACCENT[issue.severity];
          return (
            <Box
              key={`${issue.code}-${index}`}
              sx={{ borderRadius: 2, borderLeft: `4px solid ${accent}`, bgcolor: CHAT_COLORS.navySurface, p: 1.5 }}
            >
              <Stack spacing={0.75}>
                <Chip
                  label={SEVERITY_LABEL[issue.severity]}
                  size="small"
                  sx={{ alignSelf: "flex-start", color: accent, borderColor: accent }}
                  variant="outlined"
                />
                <TargetText text={sourceText} range={issue.targetRange} />
                {issue.sentence && !issue.targetRange && (
                  <Typography variant="body2" sx={{ color: CHAT_COLORS.orange }}>
                    対象文: 「{issue.sentence}」
                  </Typography>
                )}
                <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
                  {issue.message}
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ borderColor: CHAT_COLORS.navyBorder }} />

      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
          AIコメント
        </Typography>
        {COMMENT_CATEGORY_ORDER.map((category) => {
          const categoryComments = analysis.comments.filter((comment) => comment.category === category);
          if (categoryComments.length === 0) return null;
          return (
            <Stack key={category} spacing={1}>
              <Typography variant="subtitle2" sx={{ color: CHAT_COLORS.orange, fontWeight: 700 }}>
                {COMMENT_CATEGORY_LABEL[category]}
              </Typography>
              {categoryComments.map((comment, index) => {
                const accent = SEVERITY_ACCENT[comment.severity];
                return (
                  <Box
                    key={`${category}-${index}`}
                    sx={{ borderRadius: "4px 16px 16px 16px", borderLeft: `4px solid ${accent}`, bgcolor: CHAT_COLORS.navySurface, p: 1.5 }}
                  >
                    <Stack spacing={0.75}>
                      <TargetText text={sourceText} range={comment.targetRange} />
                      <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
                        {comment.message}
                      </Typography>
                      <EvidenceList evidence={comment.evidence} />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          );
        })}
        {analysis.comments.length === 0 && (
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            AIコメントはありません。提出可否は上の決定的な検査結果を確認してください。
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
