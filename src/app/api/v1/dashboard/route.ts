import { prisma } from '@/lib/prisma';
import { countCodePoints, internalError, iso } from '@/server/api';
import { formatOverallProfile, formatSession } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const [session, profile, documents] = await Promise.all([
      prisma.analysisSession.findFirst({
        where: { userId: auth.userId, status: { in: ['ACTIVE', 'READY_TO_FINALIZE'] } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.overallSelfAnalysisProfile.findUnique({ where: { userId: auth.userId } }),
      prisma.esDocument.findMany({ where: { userId: auth.userId }, take: 10, orderBy: { updatedAt: 'desc' } }),
    ]);
    return Response.json({
      activeSession: session ? await formatSession(session) : null,
      overallProfile: profile ? formatOverallProfile(profile) : null,
      recentEsDocuments: documents.map((document) => ({
        id: document.id,
        companyId: document.companyId,
        targetRole: document.targetRole,
        question: document.question,
        characterLimit: document.characterLimit,
        characterCount: countCodePoints(document.originalText),
        status: document.status,
        createdAt: iso(document.createdAt),
        updatedAt: iso(document.updatedAt),
      })),
    });
  } catch (error) {
    return internalError(error, 'ダッシュボードの取得');
  }
}
