// 4軸の表示名と、position enumの日本語表示への変換をここへ集約する。
// docs/screen-api-map.md「軸名に応じてLEFT／RIGHTをFocus／Connect等の表示名へ変換する」に対応し、
// ホーム・セッション4軸結果・経験一覧で同じ表記になるようにする。
// DB値・API値には表示名を使わない（docs/implementation-rules.md）。
import type { AxisAssessmentStatus, UserAssessment } from "@/types/axis-assessment";
import type { AxisPosition, SelfAnalysisAxis } from "@/types/dashboard";

export interface AxisLabel {
  // 軸そのものの日本語名
  name: string;
  // 左極（英語表記／日本語表記）
  left: string;
  leftJa: string;
  // 右極（英語表記／日本語表記）
  right: string;
  rightJa: string;
}

export const AXIS_LABELS: Record<SelfAnalysisAxis, AxisLabel> = {
  ENERGY_SOURCE: { name: "エネルギー源", left: "focus", leftJa: "集中派", right: "connect", rightJa: "共創派" },
  ACTION_STYLE: { name: "行動スタイル", left: "plan", leftJa: "設計派", right: "experiment", rightJa: "実験派" },
  SATISFACTION_SOURCE: { name: "満足の源", left: "mastery", leftJa: "習熟", right: "impact", rightJa: "貢献" },
  PREFERRED_ENVIRONMENT: { name: "好む環境", left: "stable", leftJa: "安定", right: "dynamic", rightJa: "変化" },
};

// 画面上で常に同じ並び順にするための軸の表示順
export const AXIS_ORDER = Object.keys(AXIS_LABELS) as SelfAnalysisAxis[];

// 軸の位置を日本語の説明文にする。左右へ優劣を付けず、点数へも変換しない
export function formatAxisPosition(position: AxisPosition, axis: SelfAnalysisAxis): string {
  const label = AXIS_LABELS[axis];
  switch (position) {
    case "LEFT":
      return `${label.leftJa}寄り`;
    case "LEANS_LEFT":
      return `やや${label.leftJa}寄り`;
    case "BALANCED_OR_BOTH":
      return "両方・中間";
    case "LEANS_RIGHT":
      return `やや${label.rightJa}寄り`;
    case "RIGHT":
      return `${label.rightJa}寄り`;
    case "CONTEXT_DEPENDENT":
      return "状況依存";
    default:
      return "根拠不足";
  }
}

// グラフ上の左右位置(%)。docs/screen-api-map.md のとおり順番を表すレイアウト専用の値で、
// 点数として画面文言・API・DBへ出さない。
// CONTEXT_DEPENDENTは中央へ潰さず、INSUFFICIENT_EVIDENCEとともにnull（位置を描かない）とする
export function axisPositionToPercent(position: AxisPosition): number | null {
  const percents: Partial<Record<AxisPosition, number>> = {
    LEFT: 20,
    LEANS_LEFT: 35,
    BALANCED_OR_BOTH: 50,
    LEANS_RIGHT: 65,
    RIGHT: 80,
  };
  return percents[position] ?? null;
}

// 根拠状態の表示名。AIの数値confidenceは表示しない（docs/product-scope.md）
export function formatAssessmentStatus(status: AxisAssessmentStatus): string {
  switch (status) {
    case "CONFIRMED_PATTERN":
      return "確認済みの傾向";
    case "CURRENT_HYPOTHESIS":
      return "現時点の仮説";
    default:
      return "根拠不足";
  }
}

// 各軸へ本人が選べる評価。docs/product-scope.md の
// 「当てはまる／一部当てはまる／当てはまらない／追加で考えたい」に対応する
export const USER_ASSESSMENT_LABELS: Record<UserAssessment, string> = {
  UNREVIEWED: "未評価",
  MATCHES: "当てはまる",
  PARTIALLY_MATCHES: "一部当てはまる",
  DOES_NOT_MATCH: "当てはまらない",
  NEEDS_EXPLORATION: "追加で考えたい",
};

// 本人が選択できる値。UNREVIEWEDは「まだ選んでいない」状態なので選択肢に出さない
export const REVIEWABLE_ASSESSMENTS: readonly UserAssessment[] = [
  "MATCHES",
  "PARTIALLY_MATCHES",
  "DOES_NOT_MATCH",
  "NEEDS_EXPLORATION",
];
