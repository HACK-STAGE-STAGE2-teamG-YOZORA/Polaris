import { prisma } from '@/lib/prisma';
import type {
  UpdateExperienceRequest,
  ExperienceResponse,
  StaleAssessmentInfo,
  UpdateExperienceResponse,
} from '@/types/experience';
import type { SelfAnalysisAxis } from '@/types/dashboard';

// ────────────────────────────────────────
// Helper
// ────────────────────────────────────────
function formatExperience(exp: any): ExperienceResponse {
  return {
    id: exp.id,
    sourceSessionId: exp.sourceSessionId ?? null,
    sourceMessageId: exp.sourceMessageId ?? null,
    type: exp.type,
    title: exp.title,
    situation: exp.situation,
    goal: exp.goal ?? null,
    role: exp.role,
    options: Array.isArray(exp.options) ? exp.options : [],
    decision: exp.decision ?? null,
    decisionReason: exp.decisionReason ?? null,
    actions: Array.isArray(exp.actions) ? exp.actions : [],
    result: exp.result ?? null,
    positiveEmotion: exp.positiveEmotion ?? null,
    negativeEmotion: exp.negativeEmotion ?? null,
    energyChange: exp.energyChange ?? 0,
    environment: typeof exp.environment === 'object' ? exp.environment : {},
    status: exp.status,
    isTarget: exp.isTarget ?? true,
    confirmedAt: exp.confirmedAt
      ? (exp.confirmedAt instanceof Date ? exp.confirmedAt.toISOString() : new Date(exp.confirmedAt).toISOString())
      : null,
    createdAt: exp.createdAt instanceof Date ? exp.createdAt.toISOString() : new Date(exp.createdAt).toISOString(),
    updatedAt: exp.updatedAt instanceof Date ? exp.updatedAt.toISOString() : new Date(exp.updatedAt).toISOString(),
  };
}

// ────────────────────────────────────────
// PATCH /api/v1/experiences/[experienceId]
// 内容修正 + CONFIRMED 更新
// ※ 変更時に紐づく AxisAssessment を STALE 化
// ────────────────────────────────────────
export async function PATCH(
  request: Request,
  context: { params: Promise<{ experienceId: string }> | { experienceId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { experienceId } = params;

    // 1. 経験カードの存在確認
    const existing = await prisma.experience.findUnique({ where: { id: experienceId } });
    if (!existing) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定された経験カードが存在しません。' },
        { status: 404 }
      );
    }

    const body = (await request.json()) as UpdateExperienceRequest;

    // 2. 更新データ組み立て
    const updateData: Record<string, any> = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.situation !== undefined) updateData.situation = body.situation;
    if (body.goal !== undefined) updateData.goal = body.goal;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.options !== undefined) updateData.options = body.options;
    if (body.decision !== undefined) updateData.decision = body.decision;
    if (body.decisionReason !== undefined) updateData.decisionReason = body.decisionReason;
    if (body.actions !== undefined) updateData.actions = body.actions;
    if (body.result !== undefined) updateData.result = body.result;
    if (body.positiveEmotion !== undefined) updateData.positiveEmotion = body.positiveEmotion;
    if (body.negativeEmotion !== undefined) updateData.negativeEmotion = body.negativeEmotion;
    if (body.energyChange !== undefined) updateData.energyChange = body.energyChange;
    if (body.environment !== undefined) updateData.environment = body.environment;
    if (body.isTarget !== undefined) updateData.isTarget = body.isTarget;

    // CONFIRMED への更新
    if (body.status === 'CONFIRMED' && existing.status !== 'CONFIRMED') {
      updateData.status = 'CONFIRMED';
      updateData.confirmedAt = new Date();
    } else if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // 3. 経験カード更新
    const updated = await prisma.experience.update({
      where: { id: experienceId },
      data: updateData,
    });

    // 4. STALE 化処理
    //    この経験カードの sourceSessionId に紐づく AxisAssessment を STALE に
    //    （内容が変わったため過去の分析結果が無効になる）
    let staledAssessments: StaleAssessmentInfo[] = [];

    if (existing.sourceSessionId) {
      // 既存の非 STALE な AxisAssessment を取得
      const activeAssessments = await prisma.axisAssessment.findMany({
        where: {
          sourceSessionId: existing.sourceSessionId,
          isStale: false,
        },
      });

      if (activeAssessments.length > 0) {
        await prisma.axisAssessment.updateMany({
          where: { sourceSessionId: existing.sourceSessionId },
          data: { isStale: true },
        });

        staledAssessments = activeAssessments.map((a: any) => ({
          id: a.id,
          axis: a.axis as SelfAnalysisAxis,
          sourceSessionId: a.sourceSessionId,
        }));
      }
    }

    const response: UpdateExperienceResponse = {
      experience: formatExperience(updated),
      staledAssessments,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    console.error('Error updating experience:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: '経験カード更新中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
