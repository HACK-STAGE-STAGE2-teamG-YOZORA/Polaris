import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import { prisma } from '@/lib/prisma';
import { aiError, EXPERIENCE_TYPES, internalError, jsonBody, problem } from '@/server/api';
import { formatExperience } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { sessionId } = await context.params;
    const body = await jsonBody(request);
    const experienceType = body?.experienceType;
    const messageIds = body?.messageIds;
    if (!EXPERIENCE_TYPES.includes(experienceType as (typeof EXPERIENCE_TYPES)[number])) {
      return problem(422, 'VALIDATION_ERROR', 'experienceType が不正です。');
    }
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !messageIds.every((id) => typeof id === 'string') || new Set(messageIds).size !== messageIds.length) {
      return problem(422, 'VALIDATION_ERROR', 'messageIds は重複のない1件以上のID配列で指定してください。');
    }
    const session = await prisma.analysisSession.findFirst({ where: { id: sessionId, userId: auth.userId } });
    if (!session) return problem(404, 'NOT_FOUND', '指定されたセッションがありません。');
    if (session.status !== 'ACTIVE' && session.status !== 'READY_TO_FINALIZE') {
      return problem(409, 'CONFLICT', '完了または破棄されたセッションから体験案は作成できません。');
    }
    const messages = await prisma.message.findMany({ where: { id: { in: messageIds }, sessionId } });
    if (messages.length !== messageIds.length) {
      return problem(422, 'VALIDATION_ERROR', '同じセッションに存在しない messageId が含まれています。');
    }
    const ordered = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (!ordered.some((message) => message.role === 'USER')) {
      return problem(422, 'VALIDATION_ERROR', 'USER メッセージを1件以上含めてください。');
    }

    ai = new LmStudioPolarisAiGateway();
    const draft = await ai.extractExperience({
      requestedType: experienceType as never,
      messages: ordered.map((message) => ({ id: message.id, role: message.role, content: message.content })),
    });
    const selectedUsers = new Set(ordered.filter((message) => message.role === 'USER').map((message) => message.id));
    const quotes = draft.evidenceQuotes.filter((quote) => selectedUsers.has(quote.messageId));
    const sourceMessageId = quotes.at(-1)?.messageId ?? ordered.filter((message) => message.role === 'USER').at(-1)!.id;
    const experience = await prisma.experience.create({
      data: {
        userId: auth.userId,
        sourceSessionId: sessionId,
        sourceMessageId,
        type: draft.type,
        title: draft.title,
        situation: draft.situation,
        goal: draft.goal,
        role: draft.role,
        options: draft.options,
        decision: draft.decision,
        decisionReason: draft.decisionReason,
        actions: draft.actions,
        result: draft.result,
        positiveEmotion: draft.positiveEmotion,
        negativeEmotion: draft.negativeEmotion,
        energyChange: draft.energyChange,
        environment: draft.environment,
        status: 'DRAFT',
        quotes: { create: quotes.map((quote) => ({ messageId: quote.messageId, quote: quote.quote })) },
      },
      include: { quotes: { select: { messageId: true, quote: true } } },
    });
    return Response.json(formatExperience(experience), { status: 201 });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '体験カード案の作成');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
