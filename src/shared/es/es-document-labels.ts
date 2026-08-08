// ES文書の状態の表示名。docs/screen-api-map.md「ES下書きあり」でホームへ表示する。
import type { EsDocumentStatus } from "@/types/dashboard";

export const ES_DOCUMENT_STATUS_LABELS: Record<EsDocumentStatus, string> = {
  DRAFT: "下書き",
  ANALYZED: "検査済み",
  REVISED: "完成版あり",
  VERIFIED: "再検査済み",
};
