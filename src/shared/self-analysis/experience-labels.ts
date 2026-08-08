// 経験カードのenum値に対応する日本語表示。
// docs/implementation-rules.md のとおり、表示名をDB値・API値として使わない。
import type { ExperienceStatus, ExperienceType } from "@/types/experience";

export const EXPERIENCE_TYPE_LABELS: Record<ExperienceType, string> = {
  ENGAGED: "夢中になった経験",
  ACHIEVEMENT: "成果を出した経験",
  CHALLENGE: "困難に向き合った経験",
  DRAINING_SUCCESS: "成果は出たが消耗した経験",
  TEAM_CONFLICT: "チームで意見が割れた経験",
  OTHER: "その他",
};

export const EXPERIENCE_TYPE_ORDER = Object.keys(EXPERIENCE_TYPE_LABELS) as ExperienceType[];

// DRAFTはAIの案で正式根拠に使えない。CONFIRMEDだけが4軸分析とESの根拠になる
export const EXPERIENCE_STATUS_LABELS: Record<ExperienceStatus, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確認済み",
};

// docs/openapi.yaml EnergyChange: -2=大きく消耗 〜 2=大きく元気
export const ENERGY_CHANGE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: -2, label: "-2 大きく消耗した" },
  { value: -1, label: "-1 やや消耗した" },
  { value: 0, label: "0 どちらでもない・わからない" },
  { value: 1, label: "1 やや元気になった" },
  { value: 2, label: "2 大きく元気になった" },
];
