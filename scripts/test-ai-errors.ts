import { randomUUID } from "node:crypto";
import { withE2eServer, type ApiResult } from "./e2e-harness.ts";

type JsonObject = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, label: string): JsonObject {
  assert(typeof value === "object" && value !== null && !Array.isArray(value), `${label}がobjectではありません。`);
  return value as JsonObject;
}

function assertProblem(result: ApiResult, status: number, code: string, label: string): void {
  assert(result.status === status, `${label}: HTTP ${status}ではなく${result.status}でした。\n${JSON.stringify(result.body, null, 2)}`);
  assert(result.contentType?.includes("application/problem+json"), `${label}: Problem Details形式ではありません。`);
  const body = object(result.body, label);
  assert(body.code === code, `${label}: codeが${code}ではありません。`);
  assert(typeof body.requestId === "string" && /^[0-9a-f-]{36}$/iu.test(body.requestId), `${label}: requestIdがUUIDではありません。`);
  assert(body.retryable === true, `${label}: retryableがtrueではありません。`);
  assert(Array.isArray(body.details), `${label}: detailsが配列ではありません。`);
}

async function verifyAiFailure(
  label: string,
  overrides: Record<string, string>,
  expectedStatus: number,
  expectedCode: string,
): Promise<void> {
  await withE2eServer(async ({ request }) => {
    const sessionResult = await request("/api/v1/analysis-sessions", {
      method: "POST",
      body: { startMode: "START_NEW", title: label },
    });
    assert(sessionResult.status === 201, `${label}: セッション作成に失敗しました。`);
    const session = object(sessionResult.body, `${label}.session`);
    assert(typeof session.id === "string", `${label}: session.idがありません。`);

    const result = await request(`/api/v1/analysis-sessions/${session.id}/messages`, {
      method: "POST",
      body: { content: "自己分析を始めます。", clientMessageId: randomUUID() },
    });
    assertProblem(result, expectedStatus, expectedCode, label);

    const historyResult = await request(`/api/v1/analysis-sessions/${session.id}/messages`);
    assert(historyResult.status === 200, `${label}: 会話履歴を取得できません。`);
    const history = object(historyResult.body, `${label}.history`);
    assert(Array.isArray(history.items) && history.items.length === 0, `${label}: AI失敗時に部分的なメッセージが保存されました。`);
  }, overrides);
  console.log(`${label}: ${expectedStatus} ${expectedCode} と非保存を確認`);
}

await verifyAiFailure(
  "AI timeout",
  { AI_CHAT_TIMEOUT_MS: "1" },
  504,
  "AI_TIMEOUT",
);

await verifyAiFailure(
  "AI invalid output",
  { AI_CHAT_MAX_TOKENS: "1", AI_JSON_REPAIR_MAX_ATTEMPTS: "0" },
  502,
  "AI_INVALID_OUTPUT",
);

await verifyAiFailure(
  "AI unavailable",
  { LM_STUDIO_MODEL_ID: `polaris-missing-model-${randomUUID()}` },
  503,
  "AI_UNAVAILABLE",
);

console.log("AI異常系E2Eテスト成功");
