import { OVERALL_SELF_ANALYSIS_AXES } from "./overall-output.ts";
import type {
  SelfAnalysisAxis,
  SelfAnalysisReportInput,
} from "./types.ts";

type JsonObject = Record<string, unknown>;

const CONDITION_FIELDS = [
  "mustConditions",
  "preferConditions",
  "avoidConditions",
  "verifyConditions",
] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stabilizeSelfAnalysisReportCandidate(
  value: unknown,
  input: SelfAnalysisReportInput,
): void {
  if (!isObject(value)) return;

  const assessmentById = new Map(input.axisAssessments.map((item) => [item.id, item]));
  const assessmentByAxis = new Map(input.axisAssessments.map((item) => [item.axis, item]));
  const validAxes = new Set<string>(OVERALL_SELF_ANALYSIS_AXES);

  if (typeof value.summary !== "string" || value.summary.trim().length === 0) {
    value.summary = input.axisAssessments
      .map((item) => item.statement.trim())
      .filter((statement) => statement.length > 0)
      .join(" ") || "本人確認済みの4軸分析をまとめました。";
  }

  if (Array.isArray(value.axisComments)) {
    for (const comment of value.axisComments) {
      if (!isObject(comment)) continue;
      const axis = typeof comment.axis === "string" && validAxes.has(comment.axis)
        ? comment.axis as SelfAnalysisAxis
        : undefined;
      const assessment = axis ? assessmentByAxis.get(axis) : undefined;

      if (assessment) comment.axisAssessmentId = assessment.id;
      if (typeof comment.comment !== "string" || comment.comment.trim().length === 0) {
        comment.comment = assessment?.statement || "本人確認済みの見解を参照してください。";
      }
    }
  }

  for (const field of CONDITION_FIELDS) {
    if (!Array.isArray(value[field])) continue;

    value[field] = value[field].filter((condition) => {
      if (!isObject(condition)) return false;
      if (typeof condition.statement !== "string" || condition.statement.trim().length === 0) {
        return false;
      }
      const ids = Array.isArray(condition.axisAssessmentIds)
        ? [...new Set(condition.axisAssessmentIds.filter(
            (id): id is string => typeof id === "string" && assessmentById.has(id),
          ))]
        : [];
      condition.axisAssessmentIds = ids;
      return ids.length > 0;
    });
  }

  if (Array.isArray(value.nextExperiments)) {
    value.nextExperiments = value.nextExperiments.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  }
}
