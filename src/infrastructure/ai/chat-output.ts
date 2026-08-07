import { filterAndRecoverMessageQuotes } from './quotes.ts';
import { OVERALL_SELF_ANALYSIS_AXES } from './overall-output.ts';
import type { ChatTurnInput, EvidenceCandidate, QuestionTarget } from './types.ts';

type JsonObject = Record<string, unknown>;
const POLES = new Set(['LEFT', 'RIGHT', 'BOTH', 'CONTEXT_DEPENDENT', 'UNKNOWN']);
const SUPPORT_TYPES = new Set(['SUPPORT', 'COUNTER', 'UNKNOWN']);
const QUESTION_TARGETS = new Set([
  ...OVERALL_SELF_ANALYSIS_AXES,
  'EXPERIENCE_DETAIL', 'CONTRADICTION', 'CONFIRMATION',
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return [...value.trim()].slice(0, max).join('');
}

export function stabilizeChatTurnCandidate(value: unknown, input: ChatTurnInput): void {
  if (!isObject(value)) return;
  const reply = text(value.reply, 2000);
  const questionCount = reply ? [...reply.matchAll(/[？?]/gu)].length : 0;
  const safeReply = questionCount === 1
    ? reply!
    : 'お話しいただきありがとうございます。もう少し具体的な場面を教えていただけますか？';
  const rawCandidates = Array.isArray(value.evidenceCandidates) ? value.evidenceCandidates : [];
  const evidenceCandidates = filterAndRecoverMessageQuotes(rawCandidates.slice(0, 20).flatMap((candidate): EvidenceCandidate[] => {
    if (!isObject(candidate)
      || typeof candidate.axis !== 'string' || !OVERALL_SELF_ANALYSIS_AXES.includes(candidate.axis as never)
      || typeof candidate.pole !== 'string' || !POLES.has(candidate.pole)
      || typeof candidate.supportType !== 'string' || !SUPPORT_TYPES.has(candidate.supportType)
      || typeof candidate.messageId !== 'string'
      || typeof candidate.quote !== 'string') return [];
    const statement = text(candidate.statement, 1000);
    const interpretation = text(candidate.interpretation, 2000);
    const quote = text(candidate.quote, 2000);
    if (!statement || !interpretation || !quote) return [];
    return [{
      axis: candidate.axis as EvidenceCandidate['axis'],
      pole: candidate.pole as EvidenceCandidate['pole'],
      statement,
      supportType: candidate.supportType as EvidenceCandidate['supportType'],
      messageId: candidate.messageId,
      quote,
      interpretation,
    }];
  }), input.messages);
  const missingAxes = Array.isArray(value.missingAxes)
    ? [...new Set(value.missingAxes.filter((axis): axis is ChatTurnInput['session']['missingAxes'][number] => (
      typeof axis === 'string' && OVERALL_SELF_ANALYSIS_AXES.includes(axis as never)
    )))]
    : input.session.missingAxes;
  const nextQuestionTarget = typeof value.nextQuestionTarget === 'string' && QUESTION_TARGETS.has(value.nextQuestionTarget)
    ? value.nextQuestionTarget as QuestionTarget
    : input.session.missingAxes[0] ?? 'EXPERIENCE_DETAIL';
  const normalized = {
    reply: safeReply,
    evidenceCandidates,
    missingAxes,
    nextQuestionTarget,
    experienceReady: value.experienceReady === true,
    completionIntent: value.completionIntent === 'SUGGESTED' ? 'SUGGESTED' : 'NONE',
  };
  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, normalized);
}
