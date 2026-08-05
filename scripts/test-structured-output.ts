import { Chat, LMStudioClient } from "@lmstudio/sdk";

const httpBaseUrl =
  process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234";

const modelId = process.env.LM_STUDIO_MODEL_ID;

if (!modelId) {
  throw new Error("LM_STUDIO_MODEL_IDが.envに設定されていません。");
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "nextQuestion", "focusArea"],
  properties: {
    reply: {
      type: "string",
      description: "ユーザーの発言を短く受け止める文章。質問を書かない。",
    },
    nextQuestion: {
      type: "string",
      description: "自己分析を深掘りする日本語の質問を一つだけ書く。",
    },
    focusArea: {
      type: "string",
      enum: ["CAN", "WANT", "ENERGY", "CONTEXT"],
    },
  },
} as const;

const wsBaseUrl = httpBaseUrl.replace(/^http/, "ws");

const client = new LMStudioClient({
  baseUrl: wsBaseUrl,
});

try {
  console.log("Structured Outputを生成しています...");

  const model = await client.llm.model(modelId);

  const chat = Chat.from([
    {
      role: "system",
      content: `
あなたは日本語で就職活動の自己分析を支援するAIです。

次のルールを守ってください。
- replyには質問を書かず、ユーザーの発言を短く受け止める
- nextQuestionには質問を一つだけ書く
- ユーザーが話していない事実を追加しない
- focusAreaはCAN、WANT、ENERGY、CONTEXTから選ぶ
`,
    },
    {
      role: "user",
      content: "大学の授業でWebアプリを作りました。",
    },
  ]);

  const result = await model.respond(chat, {
    structured: {
      type: "json",
      jsonSchema: outputSchema,
    },
    temperature: 0.1,
    maxTokens: 500,
  });

  // JSONとして解析できなければ、ここでエラーになります。
  const output: unknown = JSON.parse(result.content);

  console.log("\nAIのJSON出力:");
  console.log(JSON.stringify(output, null, 2));
  console.log("\nStructured Outputテスト成功");
} catch (error) {
  console.error("\nStructured Outputテスト失敗");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client[Symbol.asyncDispose]();
}