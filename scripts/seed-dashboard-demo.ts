import { createRequire } from "node:module";

type Statement = {
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): unknown;
};

type SqliteDatabase = {
  prepare(sql: string): Statement;
  close(): void;
};

const Database = createRequire(import.meta.url)("better-sqlite3") as new (path: string) => SqliteDatabase;
const databaseUrl = process.env.DATABASE_URL ?? "file:./data/polaris.db";

if (!databaseUrl.startsWith("file:")) {
  throw new Error("DATABASE_URLにはSQLiteのfile: URLを指定してください。");
}

const database = new Database(databaseUrl.replace(/^file:/u, ""));
const existing = database.prepare("SELECT id FROM overall_self_analysis_profiles WHERE id = ?").get("default");

if (existing) {
  database.close();
  throw new Error("総合プロフィールが既にあります。実データを保護するため、デモデータは投入しませんでした。");
}

const now = new Date().toISOString();
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

try {
  database.prepare(`INSERT INTO overall_self_analysis_profiles
    (id, summary, axis_trends_json, strengths_json, weaknesses_json, source_report_ids_json,
     completed_session_count, user_message_count, confirmed_experience_count, is_data_sparse,
     data_warning_reasons_json, freshness, generated_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      "default",
      "深く考える集中力と、試行を通じて改善する柔軟さをあわせ持つプロフィールです。",
      JSON.stringify(axisTrends),
      JSON.stringify(strengths),
      JSON.stringify(weaknesses),
      JSON.stringify([]),
      2,
      12,
      3,
      0,
      JSON.stringify([]),
      "CURRENT",
      now,
      now,
    );
  console.log("ダッシュボード用のデモプロフィールを投入しました。");
} finally {
  database.close();
}
