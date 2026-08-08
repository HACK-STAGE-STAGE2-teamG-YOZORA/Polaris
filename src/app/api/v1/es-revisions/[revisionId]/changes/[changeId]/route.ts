import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, objectArray, problem } from '@/server/api';
import { requireAuth } from '@/server/auth/require-auth';

type Context = { params: Promise<{ revisionId: string; changeId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { revisionId, changeId } = await context.params;
    const body = await jsonBody(request);
    if (!body || !['PENDING', 'ACCEPTED', 'REJECTED'].includes(String(body.decision))) {
      return problem(422, 'VALIDATION_ERROR', 'decision は PENDING、ACCEPTED、REJECTED のいずれかです。');
    }
    const change = await prisma.revisionChange.findFirst({
      where: { id: changeId, esRevisionId: revisionId, revision: { document: { userId: auth.userId } } },
    });
    if (!change) return problem(404, 'NOT_FOUND', '指定された推敲変更がありません。');
    const updated = await prisma.revisionChange.update({
      where: { id: changeId },
      data: { decision: body.decision as 'PENDING' | 'ACCEPTED' | 'REJECTED' },
    });
    return Response.json({
      id: updated.id,
      before: updated.beforeText,
      after: updated.afterText,
      reason: updated.reason,
      evidence: objectArray(updated.evidence),
      decision: updated.decision,
    });
  } catch (error) {
    return internalError(error, 'ES推敲変更のレビュー');
  }
}
