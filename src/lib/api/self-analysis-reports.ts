// docs/openapi.yaml の /api/v1/self-analysis-reports 系エンドポイントに対応するAPIクライアント。
import { apiGet } from "@/lib/api/client";
import type { SelfAnalysisReport, SelfAnalysisReportSummary } from "@/types/self-analysis-report";

interface SelfAnalysisReportPage {
  items: SelfAnalysisReportSummary[];
}

// GET /api/v1/self-analysis-reports?sourceSessionId={id} — そのセッションのレポート(0〜1件)を探す。
// 経験カードから「このセッションの自己分析結果を見る」ときに使う
export function findReportBySession(sessionId: string): Promise<SelfAnalysisReportSummary | null> {
  return apiGet<SelfAnalysisReportPage>(`/self-analysis-reports?sourceSessionId=${sessionId}`).then(
    (page) => page.items[0] ?? null,
  );
}

// GET /api/v1/self-analysis-reports/{reportId} — レポート本体(4軸スナップショット・条件・要約)を取得する
export function getSelfAnalysisReport(reportId: string): Promise<SelfAnalysisReport> {
  return apiGet<SelfAnalysisReport>(`/self-analysis-reports/${reportId}`);
}
