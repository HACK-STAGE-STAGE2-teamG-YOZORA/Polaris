import { randomUUID } from "node:crypto";
import { LmStudioPolarisAiGateway } from "@/infrastructure/ai/lm-studio-ai-gateway";
import type {
  ConfirmedExperience,
  EsAnalysisInput,
  AxisEvidence,
} from "@/infrastructure/ai/types";

const ai = new LmStudioPolarisAiGateway();

function createExperience(input: {
  title: string;
  situation: string;
  role: string;
  actions: string[];
  result: string;
  energyChange: -2 | -1 | 0 | 1 | 2;
  environment: string[];
  quote: string;
}): ConfirmedExperience {
  return {
    id: randomUUID(),
    status: "CONFIRMED",
    type: "OTHER",
    title: input.title,
    situation: input.situation,
    goal: null,
    role: input.role,
    options: [],
    decision: null,
    decisionReason: null,
    actions: input.actions,
    result: input.result,
    positiveEmotion: null,
    negativeEmotion: null,
    energyChange: input.energyChange,
    environment: input.environment,
    evidenceQuotes: [
      {
        messageId: randomUUID(),
        quote: input.quote,
      },
    ],
    missingFields: ["goal", "options", "decision", "decisionReason"],
  };
}

try {
  const firstExperience = createExperience({
    title: "Webアプリ開発",
    situation: "大学の授業で4人チームのWebアプリを開発した。",
    role: "API設計とタスク分解を担当した。",
    actions: ["APIを設計した", "作業を小さなタスクに分けた"],
    result: "期限内に完成した。",
    energyChange: 1,
    environment: ["4人チーム", "役割分担あり"],
    quote:
      "大学の授業で4人チームのWebアプリを作り、私はAPI設計とタスク分解を担当しました。",
  });
  const secondExperience = createExperience({
    title: "学園祭の待ち時間改善",
    situation: "学園祭の模擬店で待ち時間が長かった。",
    role: "提供工程の整理を担当した。",
    actions: ["作業を3工程に分けた", "担当を工程ごとに決めた"],
    result: "待ち時間が15分から6分になった。",
    energyChange: 2,
    environment: ["少人数チーム", "結果をすぐ確認できる"],
    quote:
      "待ち時間を減らすため作業を3工程に分け、15分から6分に短縮しました。",
  });

  const evidenceItems: AxisEvidence[] = [
    {
      id: randomUUID(),
      experienceId: firstExperience.id,
      axis: "ACTION_STYLE",
      pole: "RIGHT",
      statement: "作業を小さな単位へ分ける",
      supportType: "SUPPORT",
      quote: firstExperience.evidenceQuotes[0]!.quote,
      interpretation: "API設計とタスク分解を担当した",
    },
    {
      id: randomUUID(),
      experienceId: secondExperience.id,
      axis: "ACTION_STYLE",
      pole: "RIGHT",
      statement: "作業を工程単位へ分ける",
      supportType: "SUPPORT",
      quote: secondExperience.evidenceQuotes[0]!.quote,
      interpretation: "提供作業を3工程に分けた",
    },
    {
      id: randomUUID(),
      experienceId: secondExperience.id,
      axis: "SATISFACTION_SOURCE",
      pole: "LEFT",
      statement: "改善結果が見える活動で元気になる",
      supportType: "SUPPORT",
      quote: secondExperience.evidenceQuotes[0]!.quote,
      interpretation: "改善結果が数値で確認でき、energyChangeが2だった",
    },
  ];

  console.log("キャリア仮説を生成しています...");
  const hypotheses = await ai.generateAxisAssessments({
    sourceSessionId: randomUUID(),
    userMessageCount: 2,
    confirmedExperiences: [firstExperience, secondExperience],
    evidenceItems,
    previousAssessments: [],
  });
  console.log("\n検証済みキャリア仮説:");
  console.log(JSON.stringify(hypotheses, null, 2));

  const experienceId = firstExperience.id;
  const companyFactId = randomUUID();
  const esInput: EsAnalysisInput = {
    question: "学生時代に力を入れたことを200字以内で教えてください。",
    characterLimit: 200,
    text:
      "私は10人チームのリーダーとしてWebアプリを開発し、売上を2倍にしました。この経験を生かし、若手に全面的な裁量がある御社で活躍します。",
    allConfirmedExperiences: [
      {
        id: experienceId,
        confirmedFacts: [
          "大学の授業で4人チームのWebアプリを開発した",
          "API設計とタスク分解を担当した",
          "期限内に完成した",
        ],
        sourceQuotes: [firstExperience.evidenceQuotes[0]!.quote],
      },
    ],
    allowedCompanyFacts: [
      {
        id: companyFactId,
        category: "WORK_ENVIRONMENT",
        fact: "若手社員も改善提案を行える",
        evidenceQuote: "若手社員からの改善提案を歓迎します。",
        trustLevel: "OFFICIAL",
      },
    ],
    allSessionReports: [],
    preferredExperienceIds: [experienceId],
  };

  console.log("\nESを検査しています...");
  const analysis = await ai.analyzeEs(esInput);
  console.log("\n検証済みES検査:");
  console.log(JSON.stringify(analysis, null, 2));

  if (
    !analysis.claims.some(
      (claim) =>
        claim.suggestedStatus === "NEEDS_CONFIRMATION" ||
        claim.suggestedStatus === "CONTRADICTED",
    )
  ) {
    throw new Error("未確認の人数・役割・売上を検出できませんでした。");
  }

  console.log("\nESを推敲し、再検査しています...");
  const revised = await ai.reviseAndVerifyEs({
    ...esInput,
    latestAnalysis: analysis,
    emphasis: ["API設計", "タスク分解"],
    preserveExpressions: [],
    forbiddenAdditions: [
      "NUMBER",
      "ROLE",
      "RESULT",
      "COMPANY_FACT",
      "MOTIVATION",
      "VALUE",
      "FUTURE_GOAL",
    ],
  });
  console.log("\n推敲・再検査結果:");
  console.log(JSON.stringify(revised, null, 2));

  if (/10人|売上を2倍|全面的な裁量/u.test(revised.revision.revisedText)) {
    throw new Error("推敲後も未確認事実が残っています。");
  }

  console.log("\nキャリア仮説・ES支援AIのテスト成功");
} finally {
  await ai[Symbol.asyncDispose]();
}
