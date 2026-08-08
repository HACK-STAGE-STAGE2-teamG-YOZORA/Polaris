import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { SYSTEM_STATUS_PATH } from "@/shared/routes";
import type { ChatFormError } from "../use-analysis-chat";

interface ErrorBannerProps {
  error: ChatFormError;
}

// use-analysis-chat.ts が整形したエラー情報を表示するだけの見た目コンポーネント。
// ロジックを持たないので、デザイン確定後はこのファイルだけ差し替えればよい
export function ErrorBanner({ error }: ErrorBannerProps) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid #f28b82",
        bgcolor: "rgba(211, 47, 47, 0.18)",
        px: 2,
        py: 1.5,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: "#ffcdd2", fontWeight: 700 }}>
        エラー
      </Typography>
      <Typography variant="body2" sx={{ color: "#ffe0de", mt: 0.5 }}>
        {error.message}
      </Typography>
      {error.retryable && (
        <Typography variant="body2" sx={{ color: "#ffe0de", mt: 0.5 }}>
          もう一度お試しください。
        </Typography>
      )}
      {/* LM Studio未起動は画面上の操作では直せないため、復旧手順を出す起動確認画面へ誘導する */}
      {error.code === "AI_UNAVAILABLE" && (
        <Button
          component={Link}
          href={SYSTEM_STATUS_PATH}
          size="small"
          variant="outlined"
          sx={{ mt: 1, color: "#ffe0de", borderColor: "#f28b82" }}
        >
          起動確認をひらく
        </Button>
      )}
    </Box>
  );
}
