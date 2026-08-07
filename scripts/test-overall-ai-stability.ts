import { strict as assert } from "node:assert";
import { LmStudioPolarisAiGateway } from "../src/infrastructure/ai/lm-studio-ai-gateway.ts";
import { OVERALL_SELF_ANALYSIS_AXES } from "../src/infrastructure/ai/overall-output.ts";
import type {
  ConfirmedExperience,
  OverallSelfAnalysisInput,
  OverallSelfAnalysisOutput,
  SelfAnalysisAxis,
} from "../src/infrastructure/ai/types.ts";

const ids = {
  reportA: "11000000-0000-4000-8000-000000000001",
  reportB: "11000000-0000-4000-8000-000000000002",
  experienceA: "12000000-0000-4000-8000-000000000001",
  experienceB: "12000000-0000-4000-8000-000000000002",
  messageA: "13000000-0000-4000-8000-000000000001",
  messageB: "13000000-0000-4000-8000-000000000002",
  energyA: "14000000-0000-4000-8000-000000000001",
  actionA: "14000000-0000-4000-8000-000000000002",
  satisfactionA: "14000000-0000-4000-8000-000000000003",
  environmentA: "14000000-0000-4000-8000-000000000004",
  energyB: "14000000-0000-4000-8000-000000000005",
  actionB: "14000000-0000-4000-8000-000000000006",
} as const;

function experience(
  id: string,
  messageId: string,
  title: string,
  quote: string,
): ConfirmedExperience {
  return {
    id,
    status: "CONFIRMED",
    type: "ENGAGED",
    title,
    situation: title,
    goal: "チームで期限内に成果を出す",
    role: "実装担当",
    options: ["先に設計する", "小さく試す"],
    decision: "状況に合わせて進め方を選ぶ",
    decisionReason: "品質と速度を両立するため",
    actions: ["作業を分解した", "メンバーと相談した"],
    result: "期限内に成果物を完成した",
    positiveEmotion: "達成感があった",
    negativeEmotion: null,
    energyChange: 1,
    environment: ["少人数チーム"],
    evidenceQuotes: [{ messageId, quote }],
    missingFields: [],
  };
}

const experiences = [
  experience(ids.experienceA, ids.messageA, "共同開発", "相談しながら作業を分解しました。"),
  experience(ids.experienceB, ids.messageB, "短期改善", "まず試作し、一人で集中して改善しました。"),
];

const evidenceItems: OverallSelfAnalysisInput["evidenceItems"] = [
  {
    id: ids.energyA,
    experienceId: ids.experienceA,
    axis: "ENERGY_SOURCE",
    pole: "RIGHT",
    statement: "相談しながら考えを整理した。",
    supportType: "SUPPORT",
    quote: "相談しながら作業を分解しました。",
    interpretation: "対話が思考整理を支えた。",
  },
  {
    id: ids.actionA,
    experienceId: ids.experienceA,
    axis: "ACTION_STYLE",
    pole: "LEFT",
    statement: "作業を分解してから実装した。",
    supportType: "SUPPORT",
    quote: "相談しながら作業を分解しました。",
    interpretation: "計画して進めた。",
  },
  {
    id: ids.satisfactionA,
    experienceId: ids.experienceA,
    axis: "SATISFACTION_SOURCE",
    pole: "RIGHT",
    statement: "チームで成果を完成したことに達成感があった。",
    supportType: "SUPPORT",
    quote: "相談しながら作業を分解しました。",
    interpretation: "成果への貢献が満足につながった。",
  },
  {
    id: ids.environmentA,
    experienceId: ids.experienceA,
    axis: "PREFERRED_ENVIRONMENT",
    pole: "LEFT",
    statement: "役割が明確な少人数チームで進めた。",
    supportType: "SUPPORT",
    quote: "相談しながら作業を分解しました。",
    interpretation: "見通しのある環境で動きやすかった。",
  },
  {
    id: ids.energyB,
    experienceId: ids.experienceB,
    axis: "ENERGY_SOURCE",
    pole: "LEFT",
    statement: "改善作業では一人で集中した。",
    supportType: "SUPPORT",
    quote: "まず試作し、一人で集中して改善しました。",
    interpretation: "作業局面によって集中を選んだ。",
  },
  {
    id: ids.actionB,
    experienceId: ids.experienceB,
    axis: "ACTION_STYLE",
    pole: "RIGHT",
    statement: "短期改善では先に試作した。",
    supportType: "SUPPORT",
    quote: "まず試作し、一人で集中して改善しました。",
    interpretation: "期限が短い場面では実験を選んだ。",
  },
];

function reportAxes(
  evidence: Partial<Record<SelfAnalysisAxis, string[]>>,
  positions: Partial<Record<SelfAnalysisAxis, "LEANS_LEFT" | "LEANS_RIGHT" | "CONTEXT_DEPENDENT">> = {},
): OverallSelfAnalysisInput["completedSessionReports"][number]["axes"] {
  return OVERALL_SELF_ANALYSIS_AXES.map((axis) => ({
    axis,
    position: positions[axis] ?? "INSUFFICIENT_EVIDENCE",
    statement: evidence[axis]?.length
      ? `${axis}について本人確認済みの根拠があります。`
      : `${axis}は根拠不足です。`,
    evidenceIds: evidence[axis] ?? [],
    contextNotes: [],
    userAssessment: evidence[axis]?.length ? "MATCHES" : "NEEDS_EXPLORATION",
  }));
}

const sparseInput: OverallSelfAnalysisInput = {
  completedSessionReports: [{
    id: ids.reportA,
    summary: "共同開発で対話と事前の作業分解を活用した。",
    axes: reportAxes(
      { ENERGY_SOURCE: [ids.energyA], ACTION_STYLE: [ids.actionA] },
      { ENERGY_SOURCE: "LEANS_RIGHT", ACTION_STYLE: "LEANS_LEFT" },
    ),
  }],
  confirmedExperiences: [experiences[0]!],
  evidenceItems: evidenceItems.slice(0, 2),
  sourceUserQuotes: [{
    messageId: ids.messageA,
    sessionId: "15000000-0000-4000-8000-000000000001",
    quote: "相談しながら作業を分解しました。",
  }],
};

const contextualInput: OverallSelfAnalysisInput = {
  completedSessionReports: [
    {
      id: ids.reportA,
      summary: "共同開発では対話と計画を活用した。",
      axes: reportAxes({
        ENERGY_SOURCE: [ids.energyA],
        ACTION_STYLE: [ids.actionA],
        SATISFACTION_SOURCE: [ids.satisfactionA],
        PREFERRED_ENVIRONMENT: [ids.environmentA],
      }, {
        ENERGY_SOURCE: "LEANS_RIGHT",
        ACTION_STYLE: "LEANS_LEFT",
        SATISFACTION_SOURCE: "LEANS_RIGHT",
        PREFERRED_ENVIRONMENT: "LEANS_LEFT",
      }),
    },
    {
      id: ids.reportB,
      summary: "短期改善では一人で集中し、試作から始めた。",
      axes: reportAxes({ ENERGY_SOURCE: [ids.energyB], ACTION_STYLE: [ids.actionB] }, {
        ENERGY_SOURCE: "LEANS_LEFT",
        ACTION_STYLE: "LEANS_RIGHT",
      }),
    },
  ],
  confirmedExperiences: experiences,
  evidenceItems,
  sourceUserQuotes: [
    { messageId: ids.messageA, sessionId: "15000000-0000-4000-8000-000000000001", quote: "相談しながら作業を分解しました。" },
    { messageId: ids.messageB, sessionId: "15000000-0000-4000-8000-000000000002", quote: "まず試作し、一人で集中して改善しました。" },
  ],
};

function verifyOutput(
  output: OverallSelfAnalysisOutput,
  input: OverallSelfAnalysisInput,
  label: string,
): void {
  assert.ok(output.summary.trim().length > 0, `${label}: summaryが空です`);
  assert.equal(output.axisTrends.length, 4, `${label}: 4軸ではありません`);
  assert.deepEqual(
    new Set(output.axisTrends.map((item) => item.axis)),
    new Set(OVERALL_SELF_ANALYSIS_AXES),
    `${label}: 軸が不足または重複しています`,
  );

  const reports = new Map(input.completedSessionReports.map((report) => [report.id, report]));
  const evidence = new Map(input.evidenceItems.map((item) => [item.id, item]));
  for (const trend of output.axisTrends) {
    assert.ok(trend.sourceReportIds.every((id) => reports.has(id)), `${label}: 未知のレポートIDがあります`);
    assert.ok(
      trend.evidenceIds.every((id) => evidence.get(id)?.axis === trend.axis),
      `${label}: 4軸と根拠のaxisが一致しません`,
    );
  }
  for (const insight of [...output.strengths, ...output.weaknesses]) {
    assert.ok(insight.axes.length > 0, `${label}: insightのaxisが空です`);
    assert.ok(insight.sourceReportIds.length > 0, `${label}: insightのレポート参照が空です`);
    assert.ok(insight.evidenceIds.length > 0, `${label}: insightの根拠参照が空です`);
    assert.ok(insight.sourceReportIds.every((id) => reports.has(id)), `${label}: insightに未知のレポートIDがあります`);
    assert.ok(
      insight.evidenceIds.every((id) => {
        const item = evidence.get(id);
        return item !== undefined && insight.axes.includes(item.axis);
      }),
      `${label}: insightと根拠のaxisが一致しません`,
    );
    assert.ok(
      insight.evidenceIds.every((id) => insight.sourceReportIds.some((reportId) =>
        reports.get(reportId)?.axes.some((axis) => axis.evidenceIds.includes(id)),
      )),
      `${label}: insightの根拠が参照レポートに接続していません`,
    );
  }
}

const runs = Math.max(1, Number.parseInt(process.env.AI_STABILITY_RUNS ?? "2", 10));
const ai = new LmStudioPolarisAiGateway();

try {
  for (let run = 1; run <= runs; run += 1) {
    for (const [name, input] of [["sparse", sparseInput], ["contextual", contextualInput]] as const) {
      const output = await ai.generateOverallSelfAnalysis(input);
      verifyOutput(output, input, `${name} run ${run}`);
      console.log(`[${name} ${run}/${runs}] 総合自己分析の根拠整合性を確認しました。`);
    }
  }
} finally {
  await ai[Symbol.asyncDispose]();
}

console.log(`総合自己分析の安定性テストに成功しました（${runs * 2}回）。`);
