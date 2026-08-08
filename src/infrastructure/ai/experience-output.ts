import { filterAndRecoverMessageQuotes, recoverExactQuote } from './quotes.ts';
import type {
  ConversationMessage,
  ExperienceDraftInput,
  ExperienceGroundingField,
} from './types.ts';

type JsonObject = Record<string, unknown>;

const NULLABLE_FIELDS = ['goal', 'decision', 'decisionReason', 'result', 'positiveEmotion', 'negativeEmotion'] as const;
const ARRAY_FIELDS = ['options', 'actions', 'environment'] as const;
const MISSING_FIELDS = new Set([
  'situation', 'goal', 'role', 'options', 'decision', 'decisionReason', 'actions', 'result',
  'positiveEmotion', 'negativeEmotion', 'energyChange', 'environment',
]);
const GROUNDING_FIELDS = ['goal', 'options', 'decision', 'decisionReason'] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clipped(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return [...value.trim()].slice(0, max).join('');
}

function stringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const normalized = clipped(item, max);
    return normalized ? [normalized] : [];
  }))];
}

export function stabilizeExperienceDraftCandidate(value: unknown, input: ExperienceDraftInput): void {
  if (!isObject(value)) return;
  const userMessages = input.messages.filter((message) => message.role === 'USER');
  const latest = userMessages.at(-1);
  const missing = new Set(stringArray(value.missingFields, 100).filter((field) => MISSING_FIELDS.has(field)));
  const title = clipped(value.title, 120) ?? '要確認の経験';
  const situation = clipped(value.situation, 3000) ?? clipped(latest?.content, 3000) ?? '状況は未確認です。';
  const role = clipped(value.role, 1000) ?? '本人の役割は未確認です。';
  if (!clipped(value.situation, 3000)) missing.add('situation');
  if (!clipped(value.role, 1000)) missing.add('role');

  const arrays = Object.fromEntries(ARRAY_FIELDS.map((field) => [
    field,
    stringArray(value[field], field === 'environment' ? 500 : field === 'options' ? 1000 : 2000),
  ])) as Record<(typeof ARRAY_FIELDS)[number], string[]>;
  if (arrays.actions.length === 0) {
    arrays.actions = ['具体的な行動は未確認です。'];
    missing.add('actions');
  }

  const rawQuotes = Array.isArray(value.evidenceQuotes)
    ? value.evidenceQuotes.filter((quote): quote is { messageId: string; quote: string } => (
      isObject(quote) && typeof quote.messageId === 'string' && typeof quote.quote === 'string'
    )).map((quote) => ({ messageId: quote.messageId, quote: [...quote.quote].slice(0, 2000).join('') }))
    : [];
  const evidenceQuotes = filterAndRecoverMessageQuotes(rawQuotes, input.messages);
  if (evidenceQuotes.length === 0 && latest) {
    evidenceQuotes.push({ messageId: latest.id, quote: [...latest.content].slice(0, 2000).join('') });
  }

  const normalized: JsonObject = {
    type: input.requestedType,
    title,
    situation,
    goal: clipped(value.goal, 2000),
    role,
    options: arrays.options,
    decision: clipped(value.decision, 2000),
    decisionReason: clipped(value.decisionReason, 2000),
    actions: arrays.actions,
    result: clipped(value.result, 3000),
    positiveEmotion: clipped(value.positiveEmotion, 2000),
    negativeEmotion: clipped(value.negativeEmotion, 2000),
    energyChange: Number.isInteger(value.energyChange) && Number(value.energyChange) >= -2 && Number(value.energyChange) <= 2 ? value.energyChange : 0,
    environment: arrays.environment,
    evidenceQuotes,
    missingFields: [...missing],
  };
  if (normalized.energyChange === 0 && value.energyChange !== 0) missing.add('energyChange');
  for (const field of NULLABLE_FIELDS) if (normalized[field] === null) missing.add(field);
  for (const field of ['options', 'environment'] as const) if ((normalized[field] as unknown[]).length === 0) missing.add(field);
  normalized.missingFields = [...missing];

  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, normalized);
}

export function stabilizeExperienceGroundingCandidate(value: unknown, messages: ConversationMessage[]): void {
  if (!isObject(value)) return;
  const candidates = Array.isArray(value.assessments) ? value.assessments.filter(isObject) : [];
  value.assessments = GROUNDING_FIELDS.map((field: ExperienceGroundingField) => {
    const candidate = candidates.find((item) => item.field === field);
    const message = typeof candidate?.messageId === 'string'
      ? messages.find((item) => item.id === candidate.messageId && item.role === 'USER')
      : undefined;
    const quote = message && typeof candidate?.quote === 'string'
      ? recoverExactQuote(message.content, candidate.quote)
      : null;
    return {
      field,
      grounded: quote !== null,
      messageId: quote ? message!.id : null,
      quote: quote ? [...quote].slice(0, 2000).join('') : null,
      explanation: clipped(candidate?.explanation, 1000) ?? (quote ? 'ユーザー発言で確認できました。' : 'ユーザー発言では確認できませんでした。'),
    };
  });
  for (const key of Object.keys(value)) if (key !== 'assessments') delete value[key];
}
