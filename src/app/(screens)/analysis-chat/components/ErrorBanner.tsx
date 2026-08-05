import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Typography from "@mui/material/Typography";

import type { ChatFormError } from "../use-analysis-chat";

interface ErrorBannerProps {
  error: ChatFormError;
}

// use-analysis-chat.ts が整形したエラー情報を表示するだけの見た目コンポーネント。
// ロジックを持たないので、デザイン確定後はこのファイルだけ差し替えればよい
export function ErrorBanner({ error }: ErrorBannerProps) {
  return (
    <Alert severity="error">
      <AlertTitle>エラー</AlertTitle>
      <Typography variant="body2">{error.message}</Typography>
      {error.retryable && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          もう一度お試しください。
        </Typography>
      )}
    </Alert>
  );
}
