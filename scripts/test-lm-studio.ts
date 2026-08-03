import { Chat, LMStudioClient } from "@lmstudio/sdk";

const httpBaseUrl =
  process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234";

const modelId = process.env.LM_STUDIO_MODEL_ID;

if (!modelId) {
  throw new Error("LM_STUDIO_MODEL_IDが.envに設定されていません。");
}

// LM Studio SDKはWebSocketで接続するため、httpをwsへ変換します。
const wsBaseUrl = httpBaseUrl.replace(/^http/, "ws");

const client = new LMStudioClient({
  baseUrl: wsBaseUrl,
});

try {
  console.log("LM Studioへ接続しています...");

  const model = await client.llm.model(modelId);

  const chat = Chat.from([
    {
      role: "system",
      content: `
あなたは日本語で就職活動の自己分析を支援するAIです。
必ず日本語で回答してください。
一度に尋ねる論点は一つだけです。
疑問符を含む文は一文だけにしてください。
ユーザーが話していない事実を作らないでください。
`,
    },
    {
      role: "user",
      content: "自己分析を始めたいです。",
    },
  ]);

  const result = await model.respond(chat, {
    temperature: 0.2,
    maxTokens: 500,
  });

  console.log("\nAIの回答:");
  console.log(result.content);
  console.log("\nSDK接続テスト成功");
} catch (error) {
  console.error("\nSDK接続テスト失敗");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client[Symbol.asyncDispose]();
}