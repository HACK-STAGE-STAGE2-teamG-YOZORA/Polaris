import { prisma } from '@/lib/prisma';
import { internalError, jsonBody, page, problem, readPagination, SELF_ANALYSIS_AXES } from '@/server/api';
import { defaultAxes, formatSession } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';
import type { SelfAnalysisAxis } from '@/types/dashboard';

const ACTIVE_STATUSES = ['ACTIVE', 'READY_TO_FINALIZE'] as const;
const SESSION_STATUSES = ['ACTIVE', 'READY_TO_FINALIZE', 'COMPLETED', 'ABANDONED'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const { cursor, limit } = readPagination(request);
    // 複数指定(?status=ACTIVE&status=READY_TO_FINALIZE)で「再開できるセッション一覧」を
    // 1回のリクエストで取得できるようにする。単一指定の既存呼び出しはそのまま動く
    const statuses = new URL(request.url).searchParams.getAll('status');
    if (statuses.some((status) => !SESSION_STATUSES.includes(status as never))) {
      return problem(422, 'VALIDATION_ERROR', 'status が不正です。');
    }
    const records = await prisma.analysisSession.findMany({
      where: { userId: auth.userId, ...(statuses.length > 0 ? { status: { in: statuses as (typeof SESSION_STATUSES)[number][] } } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
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
    // 複数セッションの同時進行を許可する。START_NEWは既存の進行中セッションを問わず常に新規作成し、
    // RESTART_ACTIVEだけが「進行中セッションを全部ABANDONEDにしてから作り直す」という明示的なリセット操作になる
    const created = await prisma.$transaction(async (tx) => {
      if (body.startMode === 'RESTART_ACTIVE') {
        await tx.analysisSession.updateMany({ where: { userId: auth.userId, status: { in: [...ACTIVE_STATUSES] } }, data: { status: 'ABANDONED' } });
      }
      return tx.analysisSession.create({ data: { userId: auth.userId, title, status: 'ACTIVE', targetAxes } });
    });
    return Response.json(await formatSession(created), { status: 201 });
  } catch (error) {
    return internalError(error, '自己分析セッションの作成');
  }
}
