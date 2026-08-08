"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ES_REVISION_PATH } from "@/shared/routes";
import { ES_DOCUMENT_STATUS_LABELS } from "@/shared/es/es-document-labels";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { EsDocumentSummary } from "@/types/dashboard";

// 保存済みESと最新の検査状態（docs/screen-api-map.md「ES下書きあり」）
export function HomeEsList({ documents }: { documents: EsDocumentSummary[] }) {
  return (
    <Stack spacing={1.5}>
      {documents.length === 0 ? (
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Typography sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            保存済みのESはまだありません。
          </Typography>
          <Button
            component={Link}
            href={ES_REVISION_PATH}
            variant="outlined"
            sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}
          >
            ES添削へ
          </Button>
        </Stack>
      ) : (
        documents.map((document) => (
          <Box
            key={document.id}
            sx={{
              borderRadius: 2,
              border: `1px solid ${CHAT_COLORS.navyBorder}`,
              bgcolor: CHAT_COLORS.navySurface,
              p: 1.5,
            }}
          >
            <Stack spacing={0.75}>
              <Chip
                size="small"
                label={ES_DOCUMENT_STATUS_LABELS[document.status]}
                sx={{ alignSelf: "flex-start", bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.orange, fontWeight: 700 }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: CHAT_COLORS.textOnDark,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {document.question}
              </Typography>
              <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                {document.characterCount} / {document.characterLimit}文字 / 更新{" "}
                {new Date(document.updatedAt).toLocaleString()}
              </Typography>
            </Stack>
          </Box>
        ))
      )}
    </Stack>
  );
}
