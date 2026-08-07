import type { PolarisAiConfig } from "./types.ts";
import { normalizeLocalLmStudioBaseUrl } from './local-endpoint.ts';

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`${name}には数値を設定してください。`);
  }

  return value;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Math.trunc(readNumber(name, fallback));

  if (value < 1) {
    throw new Error(`${name}には1以上の整数を設定してください。`);
  }

  return value;
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = readNumber(name, fallback);
  if (value <= 0) {
    throw new Error(`${name}には0より大きい数値を設定してください。`);
  }
  return value;
}

export function loadPolarisAiConfig(): PolarisAiConfig {
  const modelId = process.env.LM_STUDIO_MODEL_ID;

  if (!modelId) {
    throw new Error("LM_STUDIO_MODEL_IDが.envに設定されていません。");
  }

  return {
    baseUrl: normalizeLocalLmStudioBaseUrl(process.env.LM_STUDIO_BASE_URL),
    modelId,
    chatTemperature: readNumber("AI_CHAT_TEMPERATURE", 0.6),
    structuredTemperature: readNumber(
      "AI_STRUCTURED_TEMPERATURE",
      0.1,
    ),
    chatMaxTokens: Math.trunc(readNumber("AI_CHAT_MAX_TOKENS", 1200)),
    taskMaxTokens: Math.trunc(
      readNumber("AI_MAX_OUTPUT_TOKENS", 4096),
    ),
    chatTimeoutMs: readPositiveInteger("AI_CHAT_TIMEOUT_MS", 60_000),
    taskTimeoutMs: readPositiveInteger("AI_TASK_TIMEOUT_MS", 120_000),
    repairAttempts: Math.max(
      0,
      Math.trunc(readNumber("AI_JSON_REPAIR_MAX_ATTEMPTS", 1)),
    ),
    contextLength: readPositiveInteger('LM_STUDIO_CONTEXT_LENGTH', 16_384),
    schemaReserveTokens: readPositiveInteger('AI_SCHEMA_RESERVE_TOKENS', 1_500),
    estimatedCharsPerToken: readPositiveNumber('AI_ESTIMATED_CHARS_PER_TOKEN', 2),
  };
}
