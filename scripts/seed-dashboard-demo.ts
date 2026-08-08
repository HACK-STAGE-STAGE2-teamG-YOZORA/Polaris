import { prisma } from "../src/lib/prisma.ts";
const axisTrends = [
  {
    axis: "ENERGY_SOURCE",
    position: "LEANS_LEFT",
    statement: "一人で考えを深める時間に集中力を発揮します。",
    sourceReportIds: [],
    evidenceIds: [],
    contextNotes: [],
  },
  {
    axis: "ACTION_STYLE",
    position: "LEANS_RIGHT",
    statement: "小さく試し、反応を見ながら改善する進め方を好みます。",
    sourceReportIds: [],
    evidenceIds: [],
    contextNotes: [],
  },
  {
    axis: "SATISFACTION_SOURCE",
    position: "BALANCED_OR_BOTH",
    statement: "自分の専門性を高めることと、周囲の役に立つことの両方にやりがいを感じます。",
    sourceReportIds: [],
    evidenceIds: [],
    contextNotes: [],
  },
  {
    axis: "PREFERRED_ENVIRONMENT",
    position: "CONTEXT_DEPENDENT",
    statement: "見通しがある環境では安定して力を出し、目的が明確なら変化にも前向きに対応できます。",
    sourceReportIds: [],
    evidenceIds: [],
    contextNotes: [],
  },
];

const strengths = [
  {
    title: "課題を深く掘り下げる力",
    description: "課題を見つけると、自分で調べて整理し、改善案を形にするまで粘り強く取り組めます。",
    axes: ["ENERGY_SOURCE", "SATISFACTION_SOURCE"],
    sourceReportIds: [],
    evidenceIds: [],
  },
  {
    title: "試行から学ぶ姿勢",
    description: "最初から正解を決めつけず、小さく試して周囲や利用者の反応を次の改善へ生かせます。",
    axes: ["ACTION_STYLE", "SATISFACTION_SOURCE"],
    sourceReportIds: [],
    evidenceIds: [],
  },
];

const weaknesses = [
  {
    title: "相談のタイミング",
    description: "完成度を高めようとして一人で考え込みやすいため、途中でも早めに共有することが課題です。",
    axes: ["ENERGY_SOURCE", "PREFERRED_ENVIRONMENT"],
    sourceReportIds: [],
    evidenceIds: [],
  },
  {
    title: "変化への見通しづくり",
    description: "予定や役割が急に変わる場面では負担を感じやすいため、目的と優先順位を最初に確認すると力を発揮できます。",
    axes: ["PREFERRED_ENVIRONMENT"],
    sourceReportIds: [],
    evidenceIds: [],
  },
];

async function main(): Promise<void> {
  const targetEmail = process.env.DEMO_USER_EMAIL?.trim();
  if (!targetEmail) {
    throw new Error("DEMO_USER_EMAILに、ログイン済みユーザーのメールアドレスを指定してください。");
  }

  const users = await prisma.user.findMany({
    where: { email: targetEmail },
    select: { id: true },
    take: 2,
  });
  if (users.length !== 1) {
    throw new Error(
      users.length === 0
        ? "DEMO_USER_EMAILに一致するユーザーがありません。先にGoogleログインしてください。"
        : "DEMO_USER_EMAILに一致するユーザーが複数あります。データ投入を中止しました。",
    );
  }

  const userId = users[0].id;
  const existing = await prisma.overallSelfAnalysisProfile.findUnique({ where: { userId } });
  if (existing) {
    throw new Error("対象ユーザーの総合プロフィールが既にあります。実データを保護するため投入しませんでした。");
  }

  await prisma.overallSelfAnalysisProfile.create({
    data: {
      userId,
      summary: "深く考える集中力と、試行を通じて改善する柔軟さをあわせ持つプロフィールです。",
      axisTrends,
      strengths,
      weaknesses,
      sourceReportIds: [],
      completedSessionCount: 2,
      userMessageCount: 12,
      confirmedExperienceCount: 3,
      isDataSparse: false,
      dataWarningReasons: [],
      freshness: "CURRENT",
    },
  });
  console.log("ダッシュボード用のデモプロフィールを投入しました。");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
