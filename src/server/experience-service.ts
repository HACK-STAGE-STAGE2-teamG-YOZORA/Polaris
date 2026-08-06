import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { EXPERIENCE_TYPES, isPlainObject } from './api';

export const EXPERIENCE_CONTENT_FIELDS = [
  'type',
  'title',
  'situation',
  'goal',
  'role',
  'options',
  'decision',
  'decisionReason',
  'actions',
  'result',
  'positiveEmotion',
  'negativeEmotion',
  'energyChange',
  'environment',
] as const;

export function validateExperienceFields(
  value: Record<string, unknown>,
  options: { partial: boolean },
): string | null {
  if (!options.partial || value.type !== undefined) {
    if (!EXPERIENCE_TYPES.includes(value.type as (typeof EXPERIENCE_TYPES)[number])) return 'type が不正です。';
  }
  for (const [field, max] of [['title', 120], ['situation', 3000], ['role', 1000]] as const) {
    if (!options.partial || value[field] !== undefined) {
      if (typeof value[field] !== 'string' || value[field].trim().length === 0 || value[field].length > max) {
        return `${field} は1〜${max}文字で指定してください。`;
      }
    }
  }
  for (const field of ['goal', 'decision', 'decisionReason', 'result', 'positiveEmotion', 'negativeEmotion'] as const) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') {
      return `${field} は文字列または null で指定してください。`;
    }
  }
  if (!options.partial || value.actions !== undefined) {
    if (!isStringArray(value.actions) || value.actions.length === 0) return 'actions は1件以上の文字列配列で指定してください。';
  }
  if (value.options !== undefined && !isStringArray(value.options)) {
    return 'options は文字列配列で指定してください。';
  }
  if ((!options.partial || value.environment !== undefined) && !isStringArray(value.environment)) {
    return 'environment は文字列配列で指定してください。';
  }
  if (!options.partial || value.energyChange !== undefined) {
    if (!Number.isInteger(value.energyChange) || Number(value.energyChange) < -2 || Number(value.energyChange) > 2) {
      return 'energyChange は -2〜2 の整数で指定してください。';
    }
  }
  return null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function validateExperienceSource(
  sourceSessionId: unknown,
  sourceMessageId: unknown,
): Promise<{ sourceSessionId: string | null; sourceMessageId: string | null } | string> {
  if (sourceSessionId !== undefined && typeof sourceSessionId !== 'string') return 'sourceSessionId が不正です。';
  if (sourceMessageId !== undefined && typeof sourceMessageId !== 'string') return 'sourceMessageId が不正です。';
  const sessionId = typeof sourceSessionId === 'string' ? sourceSessionId : null;
  const messageId = typeof sourceMessageId === 'string' ? sourceMessageId : null;
  if (messageId && !sessionId) return 'sourceMessageId を指定する場合は sourceSessionId も必要です。';

  if (sessionId) {
    const session = await prisma.analysisSession.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!session) return 'sourceSessionId に該当するセッションがありません。';
  }
  if (messageId) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.role !== 'USER' || message.sessionId !== sessionId) {
      return 'sourceMessageId は同じセッションの USER メッセージを指定してください。';
    }
  }
  return { sourceSessionId: sessionId, sourceMessageId: messageId };
}

export async function staleDependentResults(
  tx: Prisma.TransactionClient,
  sourceSessionId: string | null,
) {
  const activeAssessments = sourceSessionId
    ? await tx.axisAssessment.findMany({
        where: { sourceSessionId, isStale: false },
        select: { id: true, axis: true, sourceSessionId: true },
      })
    : [];
  if (sourceSessionId) {
    await tx.axisAssessment.updateMany({ where: { sourceSessionId, isStale: false }, data: { isStale: true } });
    await tx.selfAnalysisReport.updateMany({ where: { sourceSessionId, isStale: false }, data: { isStale: true } });
  }
  await tx.overallSelfAnalysisProfile.updateMany({ where: { freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
  await tx.esAnalysis.updateMany({ where: { freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
  await tx.esRevision.updateMany({ where: { freshness: 'CURRENT' }, data: { freshness: 'STALE' } });
  return activeAssessments;
}

export async function replacePromotedEvidence(
  tx: Prisma.TransactionClient,
  experience: { id: string; sourceSessionId: string | null; sourceMessageId: string | null; quotes: Array<{ messageId: string; quote: string }> },
): Promise<void> {
  await deleteExperienceEvidence(tx, experience.id);
  if (!experience.sourceSessionId || (experience.quotes.length === 0 && !experience.sourceMessageId)) return;

  const allowedMessageIds = new Set(experience.quotes.map((item) => item.messageId));
  if (experience.sourceMessageId) allowedMessageIds.add(experience.sourceMessageId);
  const userMessages = new Map(
    (await tx.message.findMany({
      where: { sessionId: experience.sourceSessionId, role: 'USER' },
      select: { id: true, content: true },
    })).map((message) => [message.id, message.content]),
  );
  const assistantMessages = await tx.message.findMany({
    where: { sessionId: experience.sourceSessionId, role: 'ASSISTANT' },
    select: { evidenceCandidates: true },
  });

  const seen = new Set<string>();
  for (const assistant of assistantMessages) {
    const candidates = Array.isArray(assistant.evidenceCandidates) ? assistant.evidenceCandidates : [];
    for (const raw of candidates) {
      if (!isPlainObject(raw)) continue;
      const { messageId, quote, axis, pole, statement, supportType, interpretation } = raw;
      if (
        typeof messageId !== 'string' || typeof quote !== 'string' || typeof axis !== 'string' ||
        typeof pole !== 'string' || typeof statement !== 'string' || typeof supportType !== 'string' ||
        typeof interpretation !== 'string' || !allowedMessageIds.has(messageId) ||
        !userMessages.get(messageId)?.includes(quote)
      ) continue;
      const key = `${messageId}\u0000${axis}\u0000${pole}\u0000${supportType}\u0000${quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await tx.axisEvidenceItem.create({
        data: {
          experienceId: experience.id,
          messageId,
          axis: axis as never,
          pole: pole as never,
          statement,
          supportType: supportType as never,
          quote,
          interpretation,
        },
      });
    }
  }
}

export async function deleteExperienceEvidence(
  tx: Prisma.TransactionClient,
  experienceId: string,
): Promise<void> {
  const evidence = await tx.axisEvidenceItem.findMany({ where: { experienceId }, select: { id: true } });
  if (evidence.length > 0) {
    await tx.axisAssessmentEvidence.deleteMany({ where: { evidenceId: { in: evidence.map((item) => item.id) } } });
    await tx.axisEvidenceItem.deleteMany({ where: { experienceId } });
  }
}
