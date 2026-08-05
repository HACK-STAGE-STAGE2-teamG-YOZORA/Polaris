import { prisma } from '@/lib/prisma';
import type { CreateAnalysisSessionRequest } from '@/types/session';
import type { SelfAnalysisAxis } from '@/types/dashboard';

export async function POST(request: Request): Promise<Response> {
  try {
    let body: CreateAnalysisSessionRequest = {};
    try {
      body = (await request.json()) as CreateAnalysisSessionRequest;
    } catch {
      // 空のボディまたはJSONなしの場合はデフォルト値を使用
    }

    const startMode = body.startMode || 'START_NEW';
    const title = body.title || '自己分析';
    const targetAxes: SelfAnalysisAxis[] = body.targetAxes || [
      'ENERGY_SOURCE',
      'ACTION_STYLE',
      'SATISFACTION_SOURCE',
      'PREFERRED_ENVIRONMENT',
    ];

    // 進行中のセッションを検索
    const activeSession = await prisma.analysisSession.findFirst({
      where: {
        status: {
          in: ['ACTIVE', 'READY_TO_FINALIZE'],
        },
      },
    });

    if (activeSession) {
      if (startMode === 'START_NEW') {
        return Response.json(
          {
            code: 'CONFLICT',
            message: '進行中の自己分析セッションが存在します。新しいセッションを開始するには RESTART_ACTIVE を指定してください。',
            retryable: false,
          },
          { status: 409 }
        );
      } else if (startMode === 'RESTART_ACTIVE') {
        // 既存の進行中セッションを ABANDONED に更新
        await prisma.analysisSession.updateMany({
          where: {
            status: {
              in: ['ACTIVE', 'READY_TO_FINALIZE'],
            },
          },
          data: {
            status: 'ABANDONED',
          },
        });
      }
    }

    // 新規 AnalysisSession の作成
    const newSession = await prisma.analysisSession.create({
      data: {
        title,
        status: 'ACTIVE',
        targetAxes,
      },
    });

    const responsePayload = {
      id: newSession.id,
      title: newSession.title,
      status: newSession.status,
      targetAxes: (newSession.targetAxes as SelfAnalysisAxis[]) || targetAxes,
      progress: {
        userMessageCount: 0,
        confirmedExperienceCount: 0,
        canGenerateResult: false,
        coveredExperienceTypes: [],
        missingAxes: targetAxes,
      },
      createdAt: newSession.createdAt instanceof Date ? newSession.createdAt.toISOString() : new Date(newSession.createdAt).toISOString(),
      updatedAt: newSession.updatedAt instanceof Date ? newSession.updatedAt.toISOString() : new Date(newSession.updatedAt).toISOString(),
      completedAt: null,
    };

    return Response.json(responsePayload, { status: 201 });
  } catch (error) {
    console.error('Error creating analysis session:', error);
    return Response.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'セッション作成中にエラーが発生しました。',
      },
      { status: 500 }
    );
  }
}
