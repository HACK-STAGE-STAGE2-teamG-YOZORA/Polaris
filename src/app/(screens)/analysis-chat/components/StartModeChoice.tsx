import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatLocalDateTime } from "@/lib/format/date-time";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { AnalysisSession } from "@/types/analysis-session";

interface StartModeChoiceProps {
  // ユーザーは複数のセッションを同時に進行できるため一覧で受け取る
  resumableSessions: AnalysisSession[];
  // 確定済み(COMPLETED)のセッション。結果を見るだけでなく、続きから会話を再開して
  // 再確定することもできる(再開するとレポートと4軸分析は古い状態になり、再確定が必要)
  otherSessions: AnalysisSession[];
  onResume: (sessionId: string) => void;
  onViewResult: (sessionId: string) => void;
  onStartNew: () => void;
  busy: boolean;
}

function SessionRow({
  session,
  action,
}: {
  session: AnalysisSession;
  action: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${CHAT_COLORS.navyBorder}`,
        p: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        flexWrap: "wrap",
      }}
    >
      <Stack spacing={0.25}>
        <Typography variant="body1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 600 }}>
          {session.title}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            最終更新: {formatLocalDateTime(session.updatedAt)}
          </Typography>
          <Chip
            size="small"
            label={`発言 ${session.progress.userMessageCount}件`}
            sx={{ bgcolor: "transparent", color: CHAT_COLORS.textOnDarkMuted, border: `1px solid ${CHAT_COLORS.navyBorder}` }}
          />
          {session.status === "READY_TO_FINALIZE" && (
            <Chip size="small" label="結果生成済み" sx={{ bgcolor: CHAT_COLORS.orangeMuted, color: CHAT_COLORS.orange }} />
          )}
        </Stack>
      </Stack>
      {action}
    </Box>
  );
}

// 「チャット開始選択」画面。GET /analysis-sessions で取得した進行中セッション一覧から
// 個別に「続きから」を選べる。完了済みセッションも「結果を見る」だけの一覧として並べ、
// 全セッションへの導線をここへ集約する。
// 「初めから」は常にSTART_NEWで新しいセッションを作る（他のセッションを破棄しない）
export function StartModeChoice({
  resumableSessions,
  otherSessions,
  onResume,
  onViewResult,
  onStartNew,
  busy,
}: StartModeChoiceProps) {
  return (
    <Stack spacing={2}>
      {resumableSessions.length > 0 && (
        <Box
          sx={{
            borderRadius: 3,
            border: `1px solid ${CHAT_COLORS.navyBorder}`,
            bgcolor: CHAT_COLORS.navySurface,
            p: 2.5,
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
              進行中の自己分析が{resumableSessions.length}件あります
            </Typography>
            {resumableSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                action={
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => onResume(session.id)}
                    disabled={busy}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{
                      bgcolor: CHAT_COLORS.orange,
                      color: CHAT_COLORS.bubbleText,
                      fontWeight: 700,
                      borderRadius: "999px",
                      "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                    }}
                  >
                    続きから
                  </Button>
                }
              />
            ))}
          </Stack>
        </Box>
      )}

      {otherSessions.length > 0 && (
        <Box
          sx={{
            borderRadius: 3,
            border: `1px solid ${CHAT_COLORS.navyBorder}`,
            bgcolor: CHAT_COLORS.navySurface,
            p: 2.5,
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ color: CHAT_COLORS.textOnDark, fontWeight: 700 }}>
              完了済みの自己分析（{otherSessions.length}件）
            </Typography>
            <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              結果はいつでも見返せます。続きから会話を再開すると、レポートは再確定するまで古い状態になります。
            </Typography>
            {otherSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                action={
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onViewResult(session.id)}
                      sx={{ color: CHAT_COLORS.textOnDark, borderColor: CHAT_COLORS.navyBorder, borderRadius: "999px" }}
                    >
                      結果を見る
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => onResume(session.id)}
                      disabled={busy}
                      startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                      sx={{
                        bgcolor: CHAT_COLORS.orange,
                        color: CHAT_COLORS.bubbleText,
                        fontWeight: 700,
                        borderRadius: "999px",
                        "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                      }}
                    >
                      続きから
                    </Button>
                  </Stack>
                }
              />
            ))}
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          borderRadius: 3,
          border: `1px solid ${CHAT_COLORS.orange}`,
          bgcolor: CHAT_COLORS.orangeMuted,
          p: 2.5,
          textAlign: "center",
        }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDark }}>
            新しい経験について話したいときは、ここから始められます。
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={onStartNew}
            disabled={busy}
            data-tutorial="start-new-button"
            sx={{
              bgcolor: CHAT_COLORS.orange,
              color: CHAT_COLORS.bubbleText,
              fontWeight: 700,
              borderRadius: "999px",
              px: 4,
              "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
            }}
          >
            初めから
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
