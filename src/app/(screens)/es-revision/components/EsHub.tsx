"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CompanyInfoPanel } from "./CompanyInfoPanel";
import { ES_DOCUMENT_STATUS_LABELS } from "@/shared/es/es-document-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CompanySummary } from "@/types/company";
import type { EsDocumentSummary } from "@/types/es-document";

interface EsHubProps {
  documents: EsDocumentSummary[];
  companies: CompanySummary[];
  loadingDocumentId: string | null;
  onStartNew: () => void;
  onOpenDocument: (documentId: string) => void;
  onCompaniesChanged: () => Promise<boolean>;
}

export function EsHub({
  documents,
  companies,
  loadingDocumentId,
  onStartNew,
  onOpenDocument,
  onCompaniesChanged,
}: EsHubProps) {
  return (
    <Stack spacing={3.5}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 3,
          border: `1px solid ${CHAT_COLORS.orange}`,
          bgcolor: CHAT_COLORS.navySurface,
          p: { xs: 2, sm: 2.5 },
          "&::after": {
            content: '"✦"',
            position: "absolute",
            top: 12,
            right: 16,
            color: CHAT_COLORS.orange,
            fontSize: 18,
          },
        }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Typography variant="h6" sx={{ pr: 4, fontWeight: 700 }}>
            新しいESを検査・推敲する
          </Typography>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted, lineHeight: 1.8 }}>
            設問と原文を入力すると、確認済みの経験・自己分析・企業公式情報から根拠を確認し、完成版の案まで作成します。
          </Typography>
          <Button
            variant="contained"
            onClick={onStartNew}
            sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700, borderRadius: "999px", "&:hover": { bgcolor: CHAT_COLORS.orangeDark } }}
          >
            新しいESを作成
          </Button>
        </Stack>
      </Box>

      <Stack spacing={1.5}>
        <Box>
          <Typography component="h2" sx={{ fontSize: 21, letterSpacing: "0.08em" }}>
            保存済みのES
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: CHAT_COLORS.textOnDarkMuted }}>
            前回の入力や検査結果から、そのまま再開できます。
          </Typography>
        </Box>

        {documents.length === 0 ? (
          <Box sx={{ borderRadius: 3, border: `1px dashed ${CHAT_COLORS.navyBorder}`, p: 2 }}>
            <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              保存済みのESはまだありません。
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {documents.map((document) => {
              const company = companies.find((item) => item.id === document.companyId);
              const loading = loadingDocumentId === document.id;
              return (
                <Box
                  key={document.id}
                  sx={{ borderRadius: 2.5, border: `1px solid ${CHAT_COLORS.navyBorder}`, bgcolor: CHAT_COLORS.navySurface, p: 1.5 }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Chip
                        size="small"
                        label={ES_DOCUMENT_STATUS_LABELS[document.status]}
                        sx={{ bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.orange, fontWeight: 700 }}
                      />
                      <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                        {new Date(document.updatedAt).toLocaleDateString("ja-JP")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.7 }}>
                      {document.question}
                    </Typography>
                    <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                      {company?.name ?? "企業指定なし"} ・ {document.targetRole ?? "職種指定なし"} ・ {document.characterCount} / {document.characterLimit}文字
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onOpenDocument(document.id)}
                      disabled={loadingDocumentId !== null}
                      startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
                      sx={{ alignSelf: "flex-start", color: CHAT_COLORS.orange, borderColor: CHAT_COLORS.orange, borderRadius: "999px" }}
                    >
                      {loading ? "読み込み中…" : "開いて続ける"}
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Box sx={{ borderTop: `1px solid ${CHAT_COLORS.navyBorder}`, pt: 3 }}>
        <CompanyInfoPanel companies={companies} onCompaniesChanged={onCompaniesChanged} />
      </Box>
    </Stack>
  );
}
