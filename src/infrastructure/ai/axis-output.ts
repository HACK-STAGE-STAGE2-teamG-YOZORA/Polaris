import { OVERALL_SELF_ANALYSIS_AXES } from "./overall-output.ts";
import type {
  AxisAssessmentsInput,
  SelfAnalysisAxis,
} from "./types.ts";

type JsonObject = Record<string, unknown>;

const EVIDENCE_ID_FIELDS = [
  "leftEvidenceIds",
  "rightEvidenceIds",
  "bothEvidenceIds",
  "contextEvidenceIds",
  "counterEvidenceIds",
] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stabilizeAxisAssessmentsCandidate(
  value: unknown,
  input: AxisAssessmentsInput,
): void {
  if (!isObject(value) || !Array.isArray(value.assessments)) return;

  const validAxes = new Set<string>(OVERALL_SELF_ANALYSIS_AXES);
  const evidenceById = new Map(input.evidenceItems.map((item) => [item.id, item]));

  for (const assessment of value.assessments) {
    if (!isObject(assessment)) continue;

    const axis = typeof assessment.axis === "string" && validAxes.has(assessment.axis)
      ? assessment.axis as SelfAnalysisAxis
      : undefined;

    for (const field of EVIDENCE_ID_FIELDS) {
      const rawIds = Array.isArray(assessment[field]) ? assessment[field] : [];
      assessment[field] = [
        ...new Set(rawIds.filter((id): id is string => {
          if (typeof id !== "string") return false;
          const evidence = evidenceById.get(id);
          return evidence !== undefined && (axis === undefined || evidence.axis === axis);
        })),
      ];
    }

    if (typeof assessment.statement !== "string" || assessment.statement.trim().length === 0) {
      const previousStatement = input.previousAssessments.find(
        (item) => item.axis === axis && item.statement.trim().length > 0,
      )?.statement;
      const evidenceStatement = input.evidenceItems.find(
        (item) => item.axis === axis && item.statement.trim().length > 0,
      )?.statement;

      assessment.statement = previousStatement
        ?? evidenceStatement
        ?? "この軸を判断できる正式な根拠が不足しています。";
    }
  }
}
