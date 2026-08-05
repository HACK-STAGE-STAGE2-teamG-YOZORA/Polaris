import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatLocalDateTime } from "@/lib/format/date-time";
import type { AnalysisSession } from "@/types/analysis-session";

interface StartModeChoiceProps {
  session: AnalysisSession;
  onResume: () => void;
  onStartNew: () => void;
  busy: boolean;
}

// 「チャット開始選択」画面。GET /analysis-sessions/current で進行中セッションが
// 見つかった場合にだけ表示する。「続きから」は既存セッションをそのまま使い（POSTしない）、
// 「初めから」はSessionStartFormへ進んでRESTART_ACTIVEでPOSTする
export function StartModeChoice({ session, onResume, onStartNew, busy }: StartModeChoiceProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1">進行中のセッションがあります</Typography>
        <Typography variant="body2" color="text.secondary">
          {session.title}（最終更新: {formatLocalDateTime(session.updatedAt)}）
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={onResume} disabled={busy}>
            続きから
          </Button>
          <Button variant="outlined" onClick={onStartNew} disabled={busy}>
            初めから
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
