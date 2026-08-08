import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, jsonBody, objectArray, page, problem, readPagination, stringArray } from '@/server/api';
import { formatMessage } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';
import type { SelfAnalysisAxis } from '@/types/dashboard';

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { sessionId } = await context.params;
    const session = await prisma.analysisSession.findFirst({ where: { id: sessionId, userId: auth.userId }, select: { id: true } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    const { cursor, limit } = readPagination(request);
    const records = await prisma.message.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return Response.json(page(records.map(formatMessage), limit));
  } catch (error) {
    return internalError(error, '会話履歴の取得');
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { sessionId } = await context.params;
    const body = await jsonBody(request);
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const clientMessageId = typeof body?.clientMessageId === 'string' ? body.clientMessageId : undefined;
    if (!content || content.length > 10_000) {
      return problem(422, 'VALIDATION_ERROR', 'content は1〜10000文字で指定してください。');
    }
    if (body?.clientMessageId !== undefined && !clientMessageId) {
      return problem(422, 'VALIDATION_ERROR', 'clientMessageId が不正です。');
    }
    const session = await prisma.analysisSession.findFirst({ where: { id: sessionId, userId: auth.userId } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    if (session.status !== 'ACTIVE' && session.status !== 'READY_TO_FINALIZE') {
      return problem(409, 'CONFLICT', '完了または破棄されたセッションには送信できません。');
    }

    if (clientMessageId) {
      const existingUser = await prisma.message.findFirst({ where: { clientMessageId, sessionId } });
      if (existingUser) {
        if (existingUser.sessionId !== sessionId || existingUser.role !== 'USER' || existingUser.content !== content) {
          return problem(409, 'CONFLICT', 'clientMessageId は別の送信で使用されています。');
        }
        const assistant = await prisma.message.findFirst({
          where: { sessionId, role: 'ASSISTANT', createdAt: { gte: existingUser.createdAt } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        if (!assistant) return problem(409, 'CONFLICT', '前回のAI応答が未完了です。再試行してください。', { retryable: true });
        const metadata = typeof assistant.turnMetadata === 'object' && assistant.turnMetadata !== null && !Array.isArray(assistant.turnMetadata)
          ? assistant.turnMetadata as Record<string, unknown>
          : {};
        return Response.json({
          userMessage: formatMessage(existingUser),
          assistantMessage: formatMessage(assistant),
          evidenceCandidates: objectArray(assistant.evidenceCandidates),
          experienceReady: metadata.experienceReady === true,
          missingAxes: stringArray(metadata.missingAxes),
          completionIntent: metadata.completionIntent === 'SUGGESTED' ? 'SUGGESTED' : 'NONE',
        });
      }
    }

    const history = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    const [confirmedExperiences, evidencedAxes] = await Promise.all([
      prisma.experience.findMany({ where: { sourceSessionId: sessionId, status: 'CONFIRMED' }, select: { type: true } }),
      prisma.axisEvidenceItem.findMany({
        where: { experience: { sourceSessionId: sessionId, status: 'CONFIRMED' }, supportType: 'SUPPORT' },
        select: { axis: true },
      }),
    ]);
    const userMessageId = crypto.randomUUID();
    const targetAxes = stringArray(session.targetAxes) as SelfAnalysisAxis[];
    const coveredAxes = new Set(evidencedAxes.map((item) => item.axis));
    const missingAxes = targetAxes.filter((axis) => !coveredAxes.has(axis));
    ai = new LmStudioPolarisAiGateway();
    const turn = await ai.createChatTurn({
      session: {
        id: sessionId,
        targetAxes,
        coveredExperienceTypes: [...new Set(confirmedExperiences.map((item) => item.type))],
        missingAxes,
      },
      messages: [
        ...history.map((message) => ({ id: message.id, role: message.role, content: message.content })),
        { id: userMessageId, role: 'USER' as const, content },
      ],
    });

    const saved = await prisma.$transaction(async (tx) => {
      const userMessage = await tx.message.create({
        data: { id: userMessageId, sessionId, role: 'USER', content, clientMessageId: clientMessageId ?? null },
      });
      const assistantMessage = await tx.message.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: turn.reply,
          questionTarget: turn.nextQuestionTarget,
          evidenceCandidates: turn.evidenceCandidates,
          turnMetadata: {
            experienceReady: turn.experienceReady,
            missingAxes,
            completionIntent: turn.completionIntent,
          },
        },
      });
      if (session.status === 'READY_TO_FINALIZE') {
        await tx.analysisSession.update({ where: { id: sessionId }, data: { status: 'ACTIVE' } });
        await tx.axisAssessment.updateMany({
          where: { sourceSessionId: sessionId, isStale: false },
          data: { isStale: true },
        });
      }
      return { userMessage, assistantMessage };
    });
    return Response.json({
      userMessage: formatMessage(saved.userMessage),
      assistantMessage: formatMessage(saved.assistantMessage),
      evidenceCandidates: turn.evidenceCandidates,
      experienceReady: turn.experienceReady,
      missingAxes,
      completionIntent: turn.completionIntent,
    });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, 'チャット送信');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
