import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, page, problem, readPagination, SELF_ANALYSIS_AXES } from '@/server/api';
import { defaultAxes, formatSession } from '@/server/formatters';
import type { SelfAnalysisAxis } from '@/types/dashboard';

const ACTIVE_STATUSES = ['ACTIVE', 'READY_TO_FINALIZE'] as const;
const SESSION_STATUSES = ['ACTIVE', 'READY_TO_FINALIZE', 'COMPLETED', 'ABANDONED'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const { cursor, limit } = readPagination(request);
    const status = new URL(request.url).searchParams.get('status');
    if (status && !SESSION_STATUSES.includes(status as never)) {
      return problem(422, 'VALIDATION_ERROR', 'status が不正です。');
    }
    const records = await prisma.analysisSession.findMany({
      where: status ? { status: status as (typeof SESSION_STATUSES)[number] } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return Response.json(page(await Promise.all(records.map(formatSession)), limit));
  } catch (error) {
    return internalError(error, '自己分析セッション一覧の取得');
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await jsonBody(request);
    if (!body || (body.startMode !== 'START_NEW' && body.startMode !== 'RESTART_ACTIVE')) {
      return problem(422, 'VALIDATION_ERROR', 'startMode は START_NEW または RESTART_ACTIVE で指定してください。');
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '自己分析';
    if (!title || title.length > 100) return problem(422, 'VALIDATION_ERROR', 'title は1〜100文字で指定してください。');
    const targetAxes = (body.targetAxes ?? defaultAxes()) as SelfAnalysisAxis[];
    if (!Array.isArray(targetAxes) || targetAxes.length === 0 || new Set(targetAxes).size !== targetAxes.length || targetAxes.some((axis) => !SELF_ANALYSIS_AXES.includes(axis))) {
      return problem(422, 'VALIDATION_ERROR', 'targetAxes に不正または重複した軸があります。');
    }
    const created = await prisma.$transaction(async (tx) => {
      const active = await tx.analysisSession.findFirst({ where: { status: { in: [...ACTIVE_STATUSES] } } });
      if (active && body.startMode === 'START_NEW') return null;
      if (active) {
        await tx.analysisSession.updateMany({ where: { status: { in: [...ACTIVE_STATUSES] } }, data: { status: 'ABANDONED' } });
      }
      return tx.analysisSession.create({ data: { title, status: 'ACTIVE', targetAxes } });
    });
    if (!created) return problem(409, 'CONFLICT', '進行中のセッションがあります。続けるか RESTART_ACTIVE を指定してください。');
    return Response.json(await formatSession(created), { status: 201 });
  } catch (error) {
    return internalError(error, '自己分析セッションの作成');
  }
}
