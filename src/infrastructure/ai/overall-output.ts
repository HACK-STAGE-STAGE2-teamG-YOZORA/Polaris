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

/**
 * AI出力を入力中の正式な根拠だけへ縮退させる。
 * IDや分析項目は補作せず、照合できない参照と根拠不足の任意項目だけを除外する。
 */
export function stabilizeOverallSelfAnalysisCandidate(
  value: unknown,
  input: Pick<OverallSelfAnalysisInput, "completedSessionReports" | "evidenceItems">,
): void {
  if (!isObject(value)) return;

  const axes = new Set<string>(OVERALL_SELF_ANALYSIS_AXES);
  const evidenceById = new Map(input.evidenceItems.map((item) => [item.id, item]));
  const reportById = new Map(input.completedSessionReports.map((report) => [report.id, report]));

  if (Array.isArray(value.axisTrends)) {
    for (const trend of value.axisTrends) {
      if (!isObject(trend)) continue;

      const axis = typeof trend.axis === "string" && axes.has(trend.axis)
        ? trend.axis as SelfAnalysisAxis
        : undefined;
      const sourceReportIds = uniqueStrings(
        trend.sourceReportIds,
        (id) => {
          const report = reportById.get(id);
          return report !== undefined && (
            axis === undefined || report.axes.some((item) => item.axis === axis)
          );
        },
      );
      const selectedReports = sourceReportIds
        .map((id) => reportById.get(id))
        .filter((report) => report !== undefined);
      const evidenceIds = uniqueStrings(
        trend.evidenceIds,
        (id) => {
          const evidence = evidenceById.get(id);
          if (!evidence || (axis !== undefined && evidence.axis !== axis)) return false;
          if (axis === undefined) return true;

          return selectedReports.some((report) => report.axes.some(
            (item) => item.axis === axis && item.evidenceIds.includes(id),
          ));
        },
      );

      trend.sourceReportIds = sourceReportIds;
      trend.evidenceIds = evidenceIds;
    }
  }

  for (const key of ["strengths", "weaknesses"] as const) {
    if (!Array.isArray(value[key])) continue;

    value[key] = value[key].filter((insight) => {
      if (!isObject(insight)) return false;
      if (typeof insight.title !== "string" || insight.title.trim().length === 0) return false;
      if (typeof insight.description !== "string" || insight.description.trim().length === 0) return false;

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

      insight.axes = insightAxes;
      insight.sourceReportIds = sourceReportIds;
      insight.evidenceIds = evidenceIds;

      return insightAxes.length > 0 && sourceReportIds.length > 0 && evidenceIds.length > 0;
    });
  }
}
