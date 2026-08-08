import { strict as assert } from "node:assert";
import {
  OVERALL_SELF_ANALYSIS_AXES,
  stabilizeOverallSelfAnalysisCandidate,
} from "../src/infrastructure/ai/overall-output.ts";
import { stabilizeAxisAssessmentsCandidate } from "../src/infrastructure/ai/axis-output.ts";
import { stabilizeSelfAnalysisReportCandidate } from "../src/infrastructure/ai/report-output.ts";
import type { OverallSelfAnalysisInput } from "../src/infrastructure/ai/types.ts";

const reportA = "10000000-0000-4000-8000-000000000001";
const reportB = "10000000-0000-4000-8000-000000000002";
const evidenceEnergy = "20000000-0000-4000-8000-000000000001";
const evidenceAction = "20000000-0000-4000-8000-000000000002";
const evidenceSatisfaction = "20000000-0000-4000-8000-000000000003";
const unknownId = "90000000-0000-4000-8000-000000000009";

const grounding = {
  completedSessionReports: [
    {
      id: reportA,
      summary: "共同作業では役割を明確にすると動きやすい。",
      axes: [
        {
          axis: "ENERGY_SOURCE" as const,
          position: "LEANS_RIGHT" as const,
          statement: "対話から考えを深める。",
          evidenceIds: [evidenceEnergy],
          contextNotes: [],
          userAssessment: "MATCHES" as const,
        },
        {
          axis: "ACTION_STYLE" as const,
          position: "LEANS_LEFT" as const,
          statement: "準備してから着手する。",
          evidenceIds: [evidenceAction],
          contextNotes: [],
          userAssessment: "MATCHES" as const,
        },
      ],
    },
    {
      id: reportB,
      summary: "成果が見える場面で満足を感じる。",
      axes: [
        {
          axis: "SATISFACTION_SOURCE" as const,
          position: "RIGHT" as const,
          statement: "成果の達成を重視する。",
          evidenceIds: [evidenceSatisfaction],
          contextNotes: [],
          userAssessment: "PARTIALLY_MATCHES" as const,
        },
      ],
    },
  ],
  evidenceItems: [
    {
      id: evidenceEnergy,
      experienceId: "30000000-0000-4000-8000-000000000001",
      axis: "ENERGY_SOURCE" as const,
      pole: "RIGHT" as const,
      statement: "相談しながら考えを整理した。",
      supportType: "SUPPORT" as const,
      quote: "相談しながら考えを整理しました。",
      interpretation: "他者との対話が思考を促した。",
    },
    {
      id: evidenceAction,
      experienceId: "30000000-0000-4000-8000-000000000002",
      axis: "ACTION_STYLE" as const,
      pole: "LEFT" as const,
      statement: "事前に作業を分解した。",
      supportType: "SUPPORT" as const,
      quote: "最初に作業を分解しました。",
      interpretation: "準備を優先した。",
    },
    {
      id: evidenceSatisfaction,
      experienceId: "30000000-0000-4000-8000-000000000003",
      axis: "SATISFACTION_SOURCE" as const,
      pole: "RIGHT" as const,
      statement: "目標達成に満足した。",
      supportType: "SUPPORT" as const,
      quote: "目標を達成できて満足しました。",
      interpretation: "成果が満足につながった。",
    },
  ],
} satisfies Pick<OverallSelfAnalysisInput, "completedSessionReports" | "evidenceItems">;

const candidate: Record<string, unknown> = {
  summary: "入力に基づく要約",
  axisTrends: [
    {
      axis: "ENERGY_SOURCE",
      sourceReportIds: [reportA, reportA, reportB, unknownId],
      evidenceIds: [evidenceEnergy, evidenceEnergy, evidenceAction, unknownId],
    },
  ],
  strengths: [
    {
      title: "対話と準備を組み合わせる",
      description: "対話で整理し、準備して進める。",
      axes: ["ENERGY_SOURCE", "ACTION_STYLE", "ACTION_STYLE", "UNKNOWN_AXIS"],
      sourceReportIds: [reportA, reportA, reportB, unknownId],
      evidenceIds: [evidenceEnergy, evidenceAction, evidenceSatisfaction, unknownId],
    },
  ],
  weaknesses: [
    {
      title: "根拠の接続がない項目",
      description: "正式根拠はあるが、指定レポートには含まれない。",
      axes: ["SATISFACTION_SOURCE"],
      sourceReportIds: [reportA],
      evidenceIds: [evidenceSatisfaction],
    },
    {
      title: "",
      description: "空タイトルの項目",
      axes: ["ENERGY_SOURCE"],
      sourceReportIds: [reportA],
      evidenceIds: [evidenceEnergy],
    },
  ],
};

stabilizeOverallSelfAnalysisCandidate(candidate, grounding);

const trends = candidate.axisTrends as Array<Record<string, unknown>>;
assert.deepEqual(trends[0]?.sourceReportIds, [reportA]);
assert.deepEqual(trends[0]?.evidenceIds, [evidenceEnergy]);

const strengths = candidate.strengths as Array<Record<string, unknown>>;
assert.equal(strengths.length, 1);
assert.deepEqual(strengths[0]?.axes, ["ENERGY_SOURCE", "ACTION_STYLE"]);
assert.deepEqual(strengths[0]?.sourceReportIds, [reportA]);
assert.deepEqual(strengths[0]?.evidenceIds, [evidenceEnergy, evidenceAction]);
assert.deepEqual(candidate.weaknesses, []);

const serialized = JSON.stringify(candidate);
assert.equal(serialized.includes(unknownId), false, "未知IDを残してはいけません");
assert.equal(JSON.stringify(candidate.strengths).includes(evidenceSatisfaction), false, "強みへ接続のない根拠を残してはいけません");

const malformedCandidate: Record<string, unknown> = {
  summary: "",
  axisTrends: [
    {
      axis: "ENERGY_SOURCE",
      suggestedPosition: "UNKNOWN_POSITION",
      statement: "",
      sourceReportIds: [unknownId],
      evidenceIds: [unknownId],
      contextNotes: ["", "状況で変わる"],
      extra: "削除対象",
    },
    { axis: "ENERGY_SOURCE", statement: "重複" },
  ],
  strengths: "not-an-array",
  weaknesses: [{ title: "根拠なし", description: "削除される", axes: [], sourceReportIds: [], evidenceIds: [] }],
  extra: "削除対象",
};
stabilizeOverallSelfAnalysisCandidate(malformedCandidate, grounding);
assert.equal((malformedCandidate.axisTrends as unknown[]).length, 4, "不足4軸をレポートから復元する必要があります");
assert.deepEqual(
  (malformedCandidate.axisTrends as Array<{ axis: string }>).map((item) => item.axis),
  [...OVERALL_SELF_ANALYSIS_AXES],
);
assert.equal(malformedCandidate.summary, `${grounding.completedSessionReports[0].summary} ${grounding.completedSessionReports[1].summary}`);
assert.deepEqual(malformedCandidate.strengths, []);
assert.deepEqual(malformedCandidate.weaknesses, []);
assert.equal(Object.hasOwn(malformedCandidate, "extra"), false);
assert.equal(JSON.stringify(malformedCandidate).includes("UNKNOWN_POSITION"), false);

const axisCandidate = {
  assessments: [
    {
      axis: "ENERGY_SOURCE",
      statement: "",
      leftEvidenceIds: [unknownId],
      rightEvidenceIds: [evidenceEnergy, evidenceEnergy, evidenceAction],
      bothEvidenceIds: [],
      contextEvidenceIds: [],
      counterEvidenceIds: [],
    },
    {
      axis: "PREFERRED_ENVIRONMENT",
      statement: "   ",
      leftEvidenceIds: [],
      rightEvidenceIds: [],
      bothEvidenceIds: [],
      contextEvidenceIds: [],
      counterEvidenceIds: [],
    },
  ],
};

stabilizeAxisAssessmentsCandidate(axisCandidate, {
  sourceSessionId: "40000000-0000-4000-8000-000000000001",
  userMessageCount: 1,
  confirmedExperiences: [],
  evidenceItems: grounding.evidenceItems,
  previousAssessments: [],
});

assert.equal(axisCandidate.assessments[0]?.statement, "相談しながら考えを整理した。");
assert.deepEqual(axisCandidate.assessments[0]?.leftEvidenceIds, []);
assert.deepEqual(axisCandidate.assessments[0]?.rightEvidenceIds, [evidenceEnergy]);
assert.equal(
  axisCandidate.assessments[1]?.statement,
  "この軸を判断できる正式な根拠が不足しています。",
);

const assessmentId = "50000000-0000-4000-8000-000000000001";
const reportCandidate = {
  summary: "",
  axisComments: [{
    axis: "ENERGY_SOURCE",
    axisAssessmentId: unknownId,
    comment: "",
  }],
  mustConditions: [{ statement: "対話できること", axisAssessmentIds: [assessmentId, assessmentId] }],
  preferConditions: [{ statement: "根拠のない条件", axisAssessmentIds: [unknownId] }],
  avoidConditions: [{ statement: "", axisAssessmentIds: [assessmentId] }],
  verifyConditions: [],
  nextExperiments: ["", "少人数で相談して進める"],
};

stabilizeSelfAnalysisReportCandidate(reportCandidate, {
  sourceSessionId: "40000000-0000-4000-8000-000000000001",
  userMessageCount: 1,
  confirmedExperiences: [],
  axisAssessments: [{
    id: assessmentId,
    axis: "ENERGY_SOURCE",
    position: "LEANS_RIGHT",
    statement: "対話しながら考えを整理する傾向があります。",
    userAssessment: "MATCHES",
  }],
});

assert.equal(reportCandidate.summary, "対話しながら考えを整理する傾向があります。");
assert.equal(reportCandidate.axisComments[0]?.axisAssessmentId, assessmentId);
assert.equal(reportCandidate.axisComments[0]?.comment, "対話しながら考えを整理する傾向があります。");
assert.deepEqual(reportCandidate.mustConditions[0]?.axisAssessmentIds, [assessmentId]);
assert.deepEqual(reportCandidate.preferConditions, []);
assert.deepEqual(reportCandidate.avoidConditions, []);
assert.deepEqual(reportCandidate.nextExperiments, ["少人数で相談して進める"]);

console.log("総合自己分析の安全な出力正規化テストに成功しました。");
