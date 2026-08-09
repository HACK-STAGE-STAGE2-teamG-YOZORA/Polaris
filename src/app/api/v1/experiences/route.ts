import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, page, problem, readPagination } from '@/server/api';
import { validateExperienceFields, validateExperienceSource } from '@/server/experience-service';
import { formatExperience } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { cursor, limit } = readPagination(request);
    const status = new URL(request.url).searchParams.get('status');
    if (status && status !== 'DRAFT' && status !== 'CONFIRMED') {
      return problem(422, 'VALIDATION_ERROR', 'status が不正です。');
    }
    const records = await prisma.experience.findMany({
      where: { userId: auth.userId, ...(status ? { status: status as 'DRAFT' | 'CONFIRMED' } : {}) },
      include: { quotes: { select: { messageId: true, quote: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return Response.json(page(records.map(formatExperience), limit));
  } catch (error) {
    return internalError(error, '体験カード一覧の取得');
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const body = await jsonBody(request);
    if (!body) return problem(422, 'VALIDATION_ERROR', 'JSONオブジェクトを指定してください。');
    const validationError = validateExperienceFields(body, { partial: false });
    if (validationError) return problem(422, 'VALIDATION_ERROR', validationError);
    const source = await validateExperienceSource(body.sourceSessionId, body.sourceMessageId, auth.userId);
    if (typeof source === 'string') return problem(422, 'VALIDATION_ERROR', source);

    const experience = await prisma.experience.create({
      data: {
        userId: auth.userId,
        ...source,
        type: body.type as never,
        title: (body.title as string).trim(),
        situation: (body.situation as string).trim(),
        goal: (body.goal as string | null | undefined) ?? null,
        role: (body.role as string).trim(),
        options: (body.options as string[] | undefined) ?? [],
        decision: (body.decision as string | null | undefined) ?? null,
        decisionReason: (body.decisionReason as string | null | undefined) ?? null,
        actions: body.actions as string[],
        result: (body.result as string | null | undefined) ?? null,
        positiveEmotion: (body.positiveEmotion as string | null | undefined) ?? null,
        negativeEmotion: (body.negativeEmotion as string | null | undefined) ?? null,
        energyChange: body.energyChange as number,
        environment: body.environment as string[],
        status: 'DRAFT',
      },
      include: { quotes: { select: { messageId: true, quote: true } } },
    });
    return Response.json(formatExperience(experience), { status: 201 });
  } catch (error) {
    return internalError(error, '体験カードの作成');
  }
}
