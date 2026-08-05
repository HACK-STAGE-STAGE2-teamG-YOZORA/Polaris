import { prisma } from '@/lib/prisma';
import type {
  AnalysisSessionStatus,
  AnalysisSessionResponse,
  DashboardResponse,
  EsDocumentStatus,
  EsDocumentSummary,
  ExperienceType,
  OverallSelfAnalysisProfileResponse,
  ResultFreshness,
  SelfAnalysisAxis,
} from '@/types/dashboard';

export async function GET(): Promise<Response> {
  try {
    // 1. 各主要エンティティを Promise.all で並列取得
    const [activeSessionRecord, overallProfileRecord, recentEsDocumentRecords] = await Promise.all([
      prisma.analysisSession.findFirst({
        where: {
          status: {
            in: ['ACTIVE', 'READY_TO_FINALIZE'],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      prisma.overallSelfAnalysisProfile.findFirst({
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      prisma.esDocument.findMany({
        take: 10,
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    // 2. activeSession の組み立て（存在する場合、統計情報を Promise.all で並列取得）
    let activeSession: AnalysisSessionResponse | null = null;

    if (activeSessionRecord) {
      const targetAxes = (activeSessionRecord.targetAxes as SelfAnalysisAxis[]) || [];

      const [userMessageCount, confirmedExperienceCount, coveredTypesRaw, assessedAxesRaw] =
        await Promise.all([
          prisma.message.count({
            where: {
              sessionId: activeSessionRecord.id,
              role: 'USER',
            },
          }),
          prisma.experience.count({
            where: {
              sourceSessionId: activeSessionRecord.id,
              status: 'CONFIRMED',
            },
          }),
          prisma.experience.findMany({
            where: {
              sourceSessionId: activeSessionRecord.id,
              status: 'CONFIRMED',
            },
            select: {
              type: true,
            },
            distinct: ['type'],
          }),
          prisma.axisAssessment.findMany({
            where: {
              sourceSessionId: activeSessionRecord.id,
            },
            select: {
              axis: true,
            },
          }),
        ]);

      const coveredExperienceTypes = coveredTypesRaw.map((e: { type: string }) => e.type as ExperienceType);
      const assessedAxesSet = new Set(assessedAxesRaw.map((a: { axis: string }) => a.axis));
      const missingAxes = targetAxes.filter(
        (axis: SelfAnalysisAxis) => !assessedAxesSet.has(axis)
      );

      activeSession = {
        id: activeSessionRecord.id,
        title: activeSessionRecord.title,
        status: activeSessionRecord.status as AnalysisSessionStatus,
        targetAxes,
        progress: {
          userMessageCount,
          confirmedExperienceCount,
          canGenerateResult: userMessageCount >= 1,
          coveredExperienceTypes,
          missingAxes,
        },
        createdAt: activeSessionRecord.createdAt instanceof Date ? activeSessionRecord.createdAt.toISOString() : new Date(activeSessionRecord.createdAt).toISOString(),
        updatedAt: activeSessionRecord.updatedAt instanceof Date ? activeSessionRecord.updatedAt.toISOString() : new Date(activeSessionRecord.updatedAt).toISOString(),
        completedAt: activeSessionRecord.completedAt
          ? (activeSessionRecord.completedAt instanceof Date ? activeSessionRecord.completedAt.toISOString() : new Date(activeSessionRecord.completedAt).toISOString())
          : null,
      };
    }

    // 3. overallProfile の組み立て
    let overallProfile: OverallSelfAnalysisProfileResponse | null = null;

    if (overallProfileRecord) {
      overallProfile = {
        id: overallProfileRecord.id,
        summary: overallProfileRecord.summary,
        axes: (overallProfileRecord.axisTrends as any) || [],
        strengths: (overallProfileRecord.strengths as any) || [],
        weaknesses: (overallProfileRecord.weaknesses as any) || [],
        dataSummary: {
          completedSessionCount: overallProfileRecord.completedSessionCount,
          userMessageCount: overallProfileRecord.userMessageCount,
          confirmedExperienceCount: overallProfileRecord.confirmedExperienceCount,
          isDataSparse: overallProfileRecord.isDataSparse,
          warningReasons: (overallProfileRecord.dataWarningReasons as any) || [],
        },
        sourceReportIds: (overallProfileRecord.sourceReportIds as any) || [],
        freshness: overallProfileRecord.freshness as ResultFreshness,
        generatedAt: overallProfileRecord.generatedAt instanceof Date ? overallProfileRecord.generatedAt.toISOString() : new Date(overallProfileRecord.generatedAt).toISOString(),
      };
    }

    // 4. recentEsDocuments の組み立て
    const recentEsDocuments: EsDocumentSummary[] = recentEsDocumentRecords.map((doc: any) => ({
      id: doc.id,
      companyId: doc.companyId ?? null,
      targetRole: doc.targetRole ?? null,
      question: doc.question,
      characterLimit: doc.characterLimit,
      characterCount: doc.originalText ? doc.originalText.length : 0,
      status: doc.status as EsDocumentStatus,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString(),
    }));

    const responseData: DashboardResponse = {
      activeSession,
      overallProfile,
      recentEsDocuments,
    };

    return Response.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return Response.json(
      {
        requestId: '',
        code: 'INTERNAL_ERROR',
        message: '予期しないサーバーエラーが発生しました。',
        retryable: false,
        details: [],
      },
      { status: 500 }
    );
  }
}
