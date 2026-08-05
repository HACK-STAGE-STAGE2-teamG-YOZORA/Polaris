import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatLocalDateTime } from "@/lib/format/date-time";
import type { ChatMessage } from "@/types/analysis-session";

interface MessageListProps {
  messages: ChatMessage[];
}

// 会話履歴の一覧表示。吹き出し風ではなくリスト＋左右寄せだけの最小実装。
// roleがUSERなら右寄せ、ASSISTANTなら左寄せにするだけで区別する
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        まだメッセージはありません。最初の回答を送信してください。
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {messages.map((message) => {
        const isUser = message.role === "USER";
        return (
          <Box
            key={message.id}
            sx={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}
          >
            <Box sx={{ maxWidth: "80%", textAlign: isUser ? "right" : "left" }}>
              <Chip
                size="small"
                label={isUser ? "あなた" : "AI"}
                color={isUser ? "primary" : "default"}
                sx={{ mb: 0.5 }}
              />
              <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                {message.content}
              </Typography>
              {/* createdAtはUTCで届くのでここで初めてローカル時刻表示に変換する */}
              <Typography variant="caption" color="text.secondary" component="div">
                {formatLocalDateTime(message.createdAt)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
