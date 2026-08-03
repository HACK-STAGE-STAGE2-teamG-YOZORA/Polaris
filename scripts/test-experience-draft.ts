import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { Chat, LMStudioClient } from "@lmstudio/sdk";

const nodeRequire = createRequire(import.meta.url);
const { Ajv2020 } = nodeRequire("ajv/dist/2020.js");
const addFormats = nodeRequire("ajv-formats");

type JsonObject = Record<string, any>;

type InputMessage = {
  id: string;
  content: string;
};

type ExperienceDraft = {
  type: string;
  evidenceQuotes: Array<{
    messageId: string;
    quote: string;
  }>;
  [key: string]: unknown;
};

async function readJson(relativePath: string): Promise<JsonObject> {
  const text = await readFile(
    new URL(relativePath, import.meta.url),
    "utf8",
  );

  return JSON.parse(text) as JsonObject;
}

/**
 * LM Studioが文法へ変換できない制約だけを、
 * AI生成用Schemaから取り除きます。
 *
 * 保存前には元の厳密なSchemaで再検証します。
 */
function simplifyForLmStudio(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(simplifyForLmStudio);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const object = value as JsonObject;

  const unsupportedKeywords = [
    "format",
    "uniqueItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "description",
  ];

  for (const keyword of unsupportedKeywords) {
    delete object[keyword];
  }

  Object.values(object).forEach(simplifyForLmStudio);
}

/**
 * Qwenが引用内に余分な空白を追加した場合、
 * 元メッセージから完全一致する原文を復元します。
 *
 * 内容そのものが変わっていた場合は復元せず、エラーにします。
 */
function recoverExactQuote(
  source: string,
  candidate: string,
): string | null {
  if (source.includes(candidate)) {
    return candidate;
  }

  const characters = [...candidate].filter(
    (character) => !/\s/u.test(character),
  );

  if (characters.length === 0) {
    return null;
  }

  const escapeRegExp = (character: string) =>
    character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pattern = characters
    .map(escapeRegExp)
    .join("\\s*");

  const match = source.match(new RegExp(pattern, "u"));

  return match?.[0] ?? null;
}

const httpBaseUrl =
  process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234";

const modelId = process.env.LM_STUDIO_MODEL_ID;

if (!modelId) {
  throw new Error("LM_STUDIO_MODEL_IDが設定されていません。");
}

// 既存の正式なSchemaを読み込みます。
const commonSchema = await readJson(
  "../contracts/ai/common.schema.json",
);

const strictSchema = await readJson(
  "../contracts/ai/experience-draft-output.schema.json",
);

// LM Studioへ渡すSchemaを複製します。
const generationSchema = structuredClone(strictSchema);

// LM Studioには不要なメタデータを削除します。
delete generationSchema.$schema;
delete generationSchema.$id;
delete generationSchema.title;

// 別ファイル参照を、LM Studio用Schemaへ埋め込みます。
generationSchema.properties.type = structuredClone(
  commonSchema.$defs.experienceType,
);

generationSchema.properties.evidenceQuotes.items =
  structuredClone(commonSchema.$defs.messageQuote);

simplifyForLmStudio(generationSchema);

// -2から2だけを生成できるようにします。
generationSchema.properties.energyChange.enum = [
  -2,
  -1,
  0,
  1,
  2,
];

// 保存前の厳密な検証器です。
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

addFormats(ajv);
ajv.addSchema(commonSchema);

const validateStrictOutput = ajv.compile(strictSchema);

const requestedType = "ENGAGED";

const inputMessages: InputMessage[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    content:
      "大学2年の授業で、4人チームで6週間かけてWebアプリを開発しました。" +
      "私はリーダーとバックエンドを担当しました。" +
      "期限内に提出して発表を成功させることが目標でした。" +
      "均等分担と得意分野別分担を検討し、遅延を避けるため得意分野別に分担して毎週進捗確認する方針を選びました。" +
      "私はAPI設計、タスク分解、週2回の進捗確認を行いました。" +
      "期限内に完成し、授業の発表代表に選ばれました。" +
      "途中は遅れが不安でしたが、完成時はとても達成感があり、かなり元気が出ました。",
  },
];

const inputText = inputMessages
  .map(
    (message) =>
      `messageId: ${message.id}\n本文: ${message.content}`,
  )
  .join("\n\n");

const wsBaseUrl = httpBaseUrl.replace(/^http/, "ws");

const client = new LMStudioClient({
  baseUrl: wsBaseUrl,
});

try {
  console.log("経験カードを生成しています...");

  const model = await client.llm.model(modelId);

  const chat = Chat.from([
    {
      role: "system",
      content: `
あなたはユーザーの会話から経験カードを作る抽出器です。

必ず次のキーをすべて出力してください。
type, title, situation, goal, role, options,
decision, decisionReason, actions, result,
positiveEmotion, negativeEmotion, energyChange,
environment, evidenceQuotes, missingFields

ルール:
- 入力本文に書かれている事実だけを使用する
- 入力にない数字、役割、行動、結果、理由を作らない
- 結果を過去の目標だったように書き換えない
- 本文に値がある項目を空文字や空配列にしない
- 不明な項目はnullまたは空配列にする
- 不明な項目名をmissingFieldsへ入れる
- typeにはrequestedTypeをそのまま設定する
- evidenceQuotesのmessageIdは入力のIDを使う
- quoteは元の本文から変更せずコピーする

energyChange:
- かなり元気が増えた: 2
- 少し元気が増えた: 1
- 変化なし、または不明: 0
- 少し元気が減った: -1
- かなり元気が減った: -2
`,
    },
    {
      role: "user",
      content: `
requestedType: ${requestedType}

${inputText}
`,
    },
  ]);

  const result = await model.respond(chat, {
    structured: {
      type: "json",
      jsonSchema: generationSchema,
    },
    temperature: 0.1,
    maxTokens: 4096,
  });

  const parsed: unknown = JSON.parse(result.content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI出力がオブジェクトではありません。");
  }

  const draft = parsed as ExperienceDraft;

  if (!Array.isArray(draft.evidenceQuotes)) {
    throw new Error("evidenceQuotesが配列ではありません。");
  }

  // 引用元のメッセージを確認し、空白差だけなら原文を復元します。
  for (const evidence of draft.evidenceQuotes) {
    const sourceMessage = inputMessages.find(
      (message) => message.id === evidence.messageId,
    );

    if (!sourceMessage) {
      throw new Error(
        `存在しないmessageIdです: ${evidence.messageId}`,
      );
    }

    const exactQuote = recoverExactQuote(
      sourceMessage.content,
      evidence.quote,
    );

    if (!exactQuote) {
      throw new Error(
        `原文に存在しない引用です: ${evidence.quote}`,
      );
    }

    evidence.quote = exactQuote;
  }

  if (draft.type !== requestedType) {
    throw new Error(
      `typeが一致しません: ${draft.type}`,
    );
  }

  // 正式なSchemaで保存前検証します。
  if (!validateStrictOutput(draft)) {
    throw new Error(
      [
        "正式なSchemaに適合しません。",
        ajv.errorsText(validateStrictOutput.errors, {
          separator: "\n",
        }),
      ].join("\n"),
    );
  }

  console.log("\n検証済み経験カード:");
  console.log(JSON.stringify(draft, null, 2));
  console.log("\n経験カード生成テスト成功");
} catch (error) {
  console.error("\n経験カード生成テスト失敗");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client[Symbol.asyncDispose]();
}