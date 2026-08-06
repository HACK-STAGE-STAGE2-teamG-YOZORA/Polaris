import { prisma } from '@/lib/prisma';
import { countCodePoints, internalError, iso } from '@/server/api';
import { formatOverallProfile, formatSession } from '@/server/formatters';

export async function GET(): Promise<Response> {
  try {
    const [session, profile, documents] = await Promise.all([
      prisma.analysisSession.findFirst({
        where: { status: { in: ['ACTIVE', 'READY_TO_FINALIZE'] } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.overallSelfAnalysisProfile.findUnique({ where: { id: 'default' } }),
      prisma.esDocument.findMany({ take: 10, orderBy: { updatedAt: 'desc' } }),
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
