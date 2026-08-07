import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatLocalDateTime } from "@/lib/format/date-time";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { ChatMessage } from "@/types/analysis-session";

interface MessageListProps {
  messages: ChatMessage[];
}

// 会話履歴の一覧表示。roleがUSERなら右寄せ白吹き出し、ASSISTANTなら左寄せオレンジ吹き出しで区別する
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted, textAlign: "center", mt: 4 }}>
        まだメッセージはありません。最初の回答を送信してください。
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {messages.map((message) => {
        const isUser = message.role === "USER";
        return (
          <Box
            key={message.id}
            sx={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}
          >
            <Box sx={{ maxWidth: "78%" }}>
              <Box
                sx={{
                  position: "relative",
                  bgcolor: isUser ? CHAT_COLORS.userBubble : CHAT_COLORS.aiBubble,
                  color: CHAT_COLORS.bubbleText,
                  borderRadius: "18px",
                  px: 2,
                  py: 1.25,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 12,
                    width: 0,
                    height: 0,
                    border: "7px solid transparent",
                    ...(isUser
                      ? { right: -12, borderLeftColor: CHAT_COLORS.userBubble, borderRightWidth: 0 }
                      : { left: -12, borderRightColor: CHAT_COLORS.aiBubble, borderLeftWidth: 0 }),
                  },
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {message.content}
                </Typography>
              </Box>
              {/* createdAtはUTCで届くのでここで初めてローカル時刻表示に変換する */}
              <Typography
                variant="caption"
                component="div"
                sx={{
                  color: CHAT_COLORS.textOnDarkMuted,
                  textAlign: isUser ? "right" : "left",
                  mt: 0.5,
                  px: 0.5,
                }}
              >
                {formatLocalDateTime(message.createdAt)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
