import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import type { CompletionIntent } from "@/types/analysis-session";

interface CompletionBannerProps {
  completionIntent: CompletionIntent;
  canGenerateResult: boolean;
}

// docs/screen-api-map.md「4. チャット終了UI」に対応。
// completionIntent=SUGGESTEDはAIが終了候補と判断したことを示すだけで、
// ここで自動的にセッション状態を変えることはしない（本人確認が必要）。
// 「この内容で結果を見る」は終了確認画面（axis-assessments/generate → finalize）への入り口だが、
// その画面は今回のスコープ外のため、ボタンはここでは無効化して表示だけ用意する
export function CompletionBanner({ completionIntent, canGenerateResult }: CompletionBannerProps) {
  if (completionIntent !== "SUGGESTED" && !canGenerateResult) {
    return null;
  }

  return (
    <Alert severity="info">
      <Typography variant="body2">
        {completionIntent === "SUGGESTED"
          ? "ここまでの内容で分析結果を作りますか？"
          : "ここまでの内容でも分析結果を作成できます。"}
      </Typography>
      {canGenerateResult && (
        <Box sx={{ mt: 1 }}>
          <Button variant="outlined" size="small" disabled>
            この内容で結果を見る
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {/* TODO: 終了確認画面の実装後、ここからaxis-assessments/generate → finalizeへ遷移する */}
            終了確認画面は準備中です
          </Typography>
        </Box>
      )}
    </Alert>
  );
}
