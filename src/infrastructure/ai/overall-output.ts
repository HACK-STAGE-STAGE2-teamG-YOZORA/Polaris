import type {
  OverallSelfAnalysisInput,
  SelfAnalysisAxis,
} from "./types.ts";

export const OVERALL_SELF_ANALYSIS_AXES = [
  "ENERGY_SOURCE",
  "ACTION_STYLE",
  "SATISFACTION_SOURCE",
  "PREFERRED_ENVIRONMENT",
] as const satisfies readonly SelfAnalysisAxis[];

type JsonObject = Record<string, unknown>;

const AXIS_POSITIONS = new Set([
  "LEFT",
  "LEANS_LEFT",
  "BALANCED_OR_BOTH",
  "LEANS_RIGHT",
  "RIGHT",
  "CONTEXT_DEPENDENT",
  "INSUFFICIENT_EVIDENCE",
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(
  value: unknown,
  predicate: (item: string) => boolean,
): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value.filter(
        (item): item is string => typeof item === "string" && predicate(item),
      ),
    ),
  ];
}

function text(value: unknown, fallback: string, maxLength: number): string {
  const selected = typeof value === "string" && value.trim() !== "" ? value.trim() : fallback.trim();
  return [...selected].slice(0, maxLength).join("") || "確認済みの情報が不足しています。";
}

function stringList(value: unknown, maxLength: number): string[] {
  return uniqueStrings(value, (item) => item.trim() !== "")
    .map((item) => [...item.trim()].slice(0, maxLength).join(""));
}

/**
 * AI出力を入力中の正式な根拠だけへ縮退させる。
 * 欠けた必須4軸は確認済みレポートから決定的に復元し、入力にない事実やIDは補作しない。
 */
export function stabilizeOverallSelfAnalysisCandidate(
  value: unknown,
  input: Pick<OverallSelfAnalysisInput, "completedSessionReports" | "evidenceItems">,
): void {
  if (!isObject(value)) return;

  const axes = new Set<string>(OVERALL_SELF_ANALYSIS_AXES);
  const evidenceById = new Map(input.evidenceItems.map((item) => [item.id, item]));
  const reportById = new Map(input.completedSessionReports.map((report) => [report.id, report]));
  const reportSummary = input.completedSessionReports.map((report) => report.summary).filter(Boolean).join(" ");
  value.summary = text(value.summary, reportSummary, 3000);

  const candidateByAxis = new Map<SelfAnalysisAxis, JsonObject>();
  if (Array.isArray(value.axisTrends)) {
    for (const candidate of value.axisTrends) {
      if (!isObject(candidate) || typeof candidate.axis !== "string" || !axes.has(candidate.axis)) continue;
      const axis = candidate.axis as SelfAnalysisAxis;
      if (!candidateByAxis.has(axis)) candidateByAxis.set(axis, candidate);
    }
  }

  value.axisTrends = OVERALL_SELF_ANALYSIS_AXES.map((axis) => {
    const candidate = candidateByAxis.get(axis);
    const reportAxes = input.completedSessionReports.flatMap((report) => report.axes
      .filter((item) => item.axis === axis)
      .map((item) => ({ report, item })));
    const fallback = reportAxes.at(-1);
    let sourceReportIds = uniqueStrings(candidate?.sourceReportIds, (id) => (
      reportById.get(id)?.axes.some((item) => item.axis === axis) ?? false
    ));
    if (sourceReportIds.length === 0) sourceReportIds = reportAxes.map(({ report }) => report.id);
    const selectedReports = sourceReportIds.map((id) => reportById.get(id)).filter((report) => report !== undefined);
    let evidenceIds = uniqueStrings(candidate?.evidenceIds, (id) => {
      const evidence = evidenceById.get(id);
      return evidence?.axis === axis && selectedReports.some((report) => report.axes.some(
        (item) => item.axis === axis && item.evidenceIds.includes(id),
      ));
    });
    if (!candidate && fallback) {
      evidenceIds = fallback.item.evidenceIds.filter((id) => evidenceById.get(id)?.axis === axis);
    }

    return {
      axis,
      suggestedPosition: typeof candidate?.suggestedPosition === "string" && AXIS_POSITIONS.has(candidate.suggestedPosition)
        ? candidate.suggestedPosition
        : fallback?.item.position ?? "INSUFFICIENT_EVIDENCE",
      statement: text(candidate?.statement, fallback?.item.statement ?? "この軸を判断できる正式な根拠が不足しています。", 1500),
      sourceReportIds,
      evidenceIds,
      contextNotes: candidate
        ? stringList(candidate.contextNotes, 700)
        : stringList(fallback?.item.contextNotes ?? [], 700),
    };
  });

  for (const key of ["strengths", "weaknesses"] as const) {
    if (!Array.isArray(value[key])) {
      value[key] = [];
      continue;
    }

    value[key] = value[key].slice(0, 8).flatMap((insight) => {
      if (!isObject(insight)) return [];
      if (typeof insight.title !== "string" || insight.title.trim().length === 0) return [];
      if (typeof insight.description !== "string" || insight.description.trim().length === 0) return [];

      let insightAxes = uniqueStrings(insight.axes, (axis) => axes.has(axis)) as SelfAnalysisAxis[];
      let evidenceIds = uniqueStrings(insight.evidenceIds, (id) => {
        const evidence = evidenceById.get(id);
        return evidence !== undefined && insightAxes.includes(evidence.axis);
      });
      const evidenceAxes = new Set(
        evidenceIds.map((id) => evidenceById.get(id)?.axis).filter((axis) => axis !== undefined),
      );
      insightAxes = insightAxes.filter((axis) => evidenceAxes.has(axis));
      evidenceIds = evidenceIds.filter((id) => {
        const evidence = evidenceById.get(id);
        return evidence !== undefined && insightAxes.includes(evidence.axis);
      });

      let sourceReportIds = uniqueStrings(insight.sourceReportIds, (id) => reportById.has(id));
      sourceReportIds = sourceReportIds.filter((id) => {
        const report = reportById.get(id);
        return report?.axes.some(
          (reportAxis) => insightAxes.includes(reportAxis.axis)
            && reportAxis.evidenceIds.some((evidenceId) => evidenceIds.includes(evidenceId)),
        ) ?? false;
      });
      evidenceIds = evidenceIds.filter((id) => sourceReportIds.some((reportId) => {
        const report = reportById.get(reportId);
        return report?.axes.some(
          (reportAxis) => insightAxes.includes(reportAxis.axis) && reportAxis.evidenceIds.includes(id),
        ) ?? false;
      }));

      const supportedAxes = new Set(
        evidenceIds.map((id) => evidenceById.get(id)?.axis).filter((axis) => axis !== undefined),
      );
      insightAxes = insightAxes.filter((axis) => supportedAxes.has(axis));

      if (insightAxes.length === 0 || sourceReportIds.length === 0 || evidenceIds.length === 0) return [];
      return [{
        title: text(insight.title, "", 120),
        description: text(insight.description, "", 1200),
        axes: insightAxes,
        sourceReportIds,
        evidenceIds,
      }];
    });
  }

  for (const key of Object.keys(value)) {
    if (!["summary", "axisTrends", "strengths", "weaknesses"].includes(key)) delete value[key];
  }
}
