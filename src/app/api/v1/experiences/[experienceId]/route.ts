import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, problem } from '@/server/api';
import {
  EXPERIENCE_CONTENT_FIELDS,
  deleteExperienceEvidence,
  replacePromotedEvidence,
  staleDependentResults,
  validateExperienceFields,
} from '@/server/experience-service';
import { formatExperience } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

type Context = { params: Promise<{ experienceId: string }> };

const includeQuotes = { quotes: { select: { messageId: true, quote: true } } } as const;

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { experienceId } = await context.params;
    const experience = await prisma.experience.findFirst({ where: { id: experienceId, userId: auth.userId }, include: includeQuotes });
    if (!experience) return problem(404, 'NOT_FOUND', '指定された体験カードがありません。');
    return Response.json(formatExperience(experience));
  } catch (error) {
    return internalError(error, '体験カードの取得');
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { experienceId } = await context.params;
    const body = await jsonBody(request);
    if (!body || Object.keys(body).length === 0) {
      return problem(422, 'VALIDATION_ERROR', '更新項目を1つ以上指定してください。');
    }
    const allowed = new Set<string>([...EXPERIENCE_CONTENT_FIELDS, 'status']);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      return problem(422, 'VALIDATION_ERROR', '未定義の更新項目が含まれています。');
    }
    if (body.status !== undefined && body.status !== 'DRAFT' && body.status !== 'CONFIRMED') {
      return problem(422, 'VALIDATION_ERROR', 'status が不正です。');
    }
    const validationError = validateExperienceFields(body, { partial: true });
    if (validationError) return problem(422, 'VALIDATION_ERROR', validationError);

    const existing = await prisma.experience.findFirst({ where: { id: experienceId, userId: auth.userId }, include: includeQuotes });
    if (!existing) return problem(404, 'NOT_FOUND', '指定された体験カードがありません。');
    const contentChanged = EXPERIENCE_CONTENT_FIELDS.some((field) => Object.hasOwn(body, field));
    const nextStatus = body.status === 'CONFIRMED'
      ? 'CONFIRMED'
      : body.status === 'DRAFT' || (existing.status === 'CONFIRMED' && contentChanged)
        ? 'DRAFT'
        : existing.status;
    const merged = { ...existing, ...body, status: nextStatus } as unknown as Record<string, unknown>;
    if (nextStatus === 'CONFIRMED') {
      const confirmError = validateExperienceFields(merged, { partial: false });
      if (confirmError) return problem(422, 'VALIDATION_ERROR', confirmError);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      for (const field of EXPERIENCE_CONTENT_FIELDS) if (Object.hasOwn(body, field)) updateData[field] = body[field];
      updateData.status = nextStatus;
      updateData.confirmedAt = nextStatus === 'CONFIRMED' ? existing.confirmedAt ?? new Date() : null;
      const updated = await tx.experience.update({
        where: { id: experienceId },
        data: updateData as never,
        include: includeQuotes,
      });
      const staledAssessments = contentChanged || nextStatus !== existing.status
        ? await staleDependentResults(tx, existing.sourceSessionId, auth.userId)
        : [];
      if (nextStatus === 'CONFIRMED' && (contentChanged || existing.status !== 'CONFIRMED')) {
        await replacePromotedEvidence(tx, updated);
      } else if (nextStatus === 'DRAFT' && existing.status === 'CONFIRMED') {
        await deleteExperienceEvidence(tx, experienceId);
      }
      return { updated, staledAssessments };
    });

    return Response.json({
      experience: formatExperience(result.updated),
      staledAssessments: result.staledAssessments,
    });
  } catch (error) {
    return internalError(error, '体験カードの更新');
  }
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { experienceId } = await context.params;
    const existing = await prisma.experience.findFirst({ where: { id: experienceId, userId: auth.userId } });
    if (!existing) return problem(404, 'NOT_FOUND', '指定された体験カードがありません。');
    await prisma.$transaction(async (tx) => {
      await staleDependentResults(tx, existing.sourceSessionId, auth.userId);
      await deleteExperienceEvidence(tx, experienceId);
      await tx.experience.delete({ where: { id: experienceId } });
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return internalError(error, '体験カードの削除');
  }
}
