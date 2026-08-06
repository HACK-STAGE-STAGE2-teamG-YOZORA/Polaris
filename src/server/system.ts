import { iso } from './api';

export type LmStudioStatus = {
  status: 'CONNECTED' | 'SERVER_UNREACHABLE' | 'MODEL_NOT_LOADED' | 'INVALID_RESPONSE';
  baseUrl: string;
  modelId?: string;
  contextLength?: number;
  checkedAt: string;
  guidance: string[];
};

export async function checkLmStudio(): Promise<LmStudioStatus> {
  const baseUrl = (process.env.LM_STUDIO_BASE_URL ?? 'http://127.0.0.1:1234').replace(/\/$/, '');
  const configuredModel = process.env.LM_STUDIO_MODEL_ID;
  const checkedAt = iso(new Date());
  try {
    const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (!response.ok) {
      return { status: 'INVALID_RESPONSE', baseUrl, checkedAt, guidance: ['LM Studio のローカルサーバー設定を確認してください。'] };
    }
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as { data?: unknown }).data)) {
      return { status: 'INVALID_RESPONSE', baseUrl, checkedAt, guidance: ['OpenAI互換の /v1/models 応答を確認してください。'] };
    }
    const models = (payload as { data: Array<Record<string, unknown>> }).data;
    const selected = configuredModel
      ? models.find((model) => model.id === configuredModel)
      : models[0];
    if (!selected) {
      return {
        status: 'MODEL_NOT_LOADED',
        baseUrl,
        ...(configuredModel ? { modelId: configuredModel } : {}),
        checkedAt,
        guidance: ['LM Studio でモデルをロードし、LM_STUDIO_MODEL_ID を一致させてください。'],
      };
    }
    const contextLength = typeof selected.context_length === 'number' ? selected.context_length : undefined;
    return {
      status: 'CONNECTED',
      baseUrl,
      modelId: String(selected.id),
      ...(contextLength ? { contextLength } : {}),
      checkedAt,
      guidance: [],
    };
  } catch {
    return {
      status: 'SERVER_UNREACHABLE',
      baseUrl,
      checkedAt,
      guidance: ['LM Studio を起動し、ローカルサーバーを開始してください。'],
    };
  }
}
