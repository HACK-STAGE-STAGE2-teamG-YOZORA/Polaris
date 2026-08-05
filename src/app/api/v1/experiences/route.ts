import { prisma } from '@/lib/prisma';
import type {
  CreateExperienceRequest,
  ExperienceResponse,
  ExperienceListResponse,
} from '@/types/experience';

// ────────────────────────────────────────
// Helper: DB レコード → レスポンス形式
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
// POST /api/v1/experiences
// AI生成の経験内容を DRAFT で保存する
// ────────────────────────────────────────
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateExperienceRequest;

    if (!body.type || !body.title || !body.situation || !body.role) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'type, title, situation, role は必須です。' },
        { status: 422 }
      );
    }

    // sourceMessageId が指定されている場合、存在確認
    if (body.sourceMessageId) {
      const msg = await prisma.message.findUnique({ where: { id: body.sourceMessageId } });
      if (!msg) {
        return Response.json(
          { code: 'NOT_FOUND', message: '指定された sourceMessageId のメッセージが存在しません。' },
          { status: 404 }
        );
      }
    }

    const newExp = await prisma.experience.create({
      data: {
        sourceSessionId: body.sourceSessionId ?? null,
        sourceMessageId: body.sourceMessageId ?? null,
        type: body.type,
        title: body.title,
        situation: body.situation,
        goal: body.goal ?? null,
        role: body.role,
        options: body.options ?? [],
        decision: body.decision ?? null,
        decisionReason: body.decisionReason ?? null,
        actions: body.actions ?? [],
        result: body.result ?? null,
        positiveEmotion: body.positiveEmotion ?? null,
        negativeEmotion: body.negativeEmotion ?? null,
        energyChange: body.energyChange ?? 0,
        environment: (body.environment ?? {}) as any,
        status: 'DRAFT',
        isTarget: body.isTarget ?? true,
      },
    });

    return Response.json(formatExperience(newExp), { status: 201 });
  } catch (error) {
    console.error('Error creating experience:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: '経験カード作成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────
// GET /api/v1/experiences
// 経験カード一覧取得（セッション跨ぎで永続）
// クエリ: ?sessionId=xxx&status=CONFIRMED&isTarget=true
// ────────────────────────────────────────
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const statusFilter = url.searchParams.get('status');
    const isTargetFilter = url.searchParams.get('isTarget');

    const where: Record<string, any> = {};

    if (sessionId) {
      where.sourceSessionId = sessionId;
    }
    if (statusFilter === 'DRAFT' || statusFilter === 'CONFIRMED') {
      where.status = statusFilter;
    }
    if (isTargetFilter === 'true') {
      where.isTarget = true;
    } else if (isTargetFilter === 'false') {
      where.isTarget = false;
    }

    const [records, total] = await Promise.all([
      prisma.experience.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.experience.count({ where }),
    ]);

    const response: ExperienceListResponse = {
      experiences: records.map(formatExperience),
      total,
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching experiences:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: '経験カード取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
