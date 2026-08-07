import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { EsDocument, EsRevision } from "@/types/es-document";

interface EsRevisionResultProps {
  esDocument: EsDocument;
  esRevision: EsRevision;
  onRequestComments: () => void;
  loading: boolean;
}

// 添削結果画面。原文と推敲後の文章を並べて表示し、「コメントをもらう」で再検査(verify)へ進む
export function EsRevisionResult({
  esDocument,
  esRevision,
  onRequestComments,
  loading,
}: EsRevisionResultProps) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Box>
            <Chip label="添削" size="small" color="primary" />
          </Box>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {esDocument.originalText}
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">修正結果</Typography>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {esRevision.revisedText}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {esRevision.characterCount} / {esDocument.characterLimit}文字
          </Typography>
        </Stack>
      </Paper>

      <Button
        variant="contained"
        onClick={onRequestComments}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        コメントをもらう
      </Button>
    </Stack>
  );
}
