import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { EsFormError } from "../use-es-revision";

interface EsErrorBannerProps {
  error: EsFormError;
}

// use-es-revision.ts が整形したエラー情報を表示するだけの見た目コンポーネント。
// ロジックを持たないので、デザイン確定後はこのファイルだけ差し替えればよい
export function EsErrorBanner({ error }: EsErrorBannerProps) {
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
    </Box>
  );
}
