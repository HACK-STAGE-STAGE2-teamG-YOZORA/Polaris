import { prisma } from '@/lib/prisma';
import { internalError, page, problem } from '@/server/api';
import { companyInclude, formatCompanySummary } from '@/server/company';
import { esDocumentInclude, formatEsDocument, formatEsSummary } from '@/server/es';
import { formatExperience } from '@/server/formatters';
import { requireAuth } from '@/server/auth/require-auth';

// ES添削画面の初期表示で必要な一覧をまとめて返す集約API。
// 企業・確認済み経験・ES一覧を個別APIで取ると、Route Handlerごとにセッション検証が走り
// タブ移動のたびに待ち時間が増えるため、認証確認を1回にまとめる（ホームのGET /dashboardと同じ考え方）。
// 既存の個別APIは他画面が使うため残す。

// 根拠候補として渡す確認済み経験の件数上限。GET /experiences?status=CONFIRMED&limit=100 と揃える
const CONFIRMED_EXPERIENCE_LIMIT = 100;

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    const documentId = new URL(request.url).searchParams.get('documentId');

    // docs/implementation-rules.md のとおり、すべてのクエリを認証ユーザーのuserIdで絞る
    const [companies, experiences, documents, selectedDocument] = await Promise.all([
      prisma.company.findMany({
        where: { userId: auth.userId },
        include: companyInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.experience.findMany({
        where: { userId: auth.userId, status: 'CONFIRMED' },
        include: { quotes: { select: { messageId: true, quote: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: CONFIRMED_EXPERIENCE_LIMIT + 1,
      }),
      prisma.esDocument.findMany({
        where: { userId: auth.userId },
        orderBy: { updatedAt: 'desc' },
      }),
      documentId
        ? prisma.esDocument.findFirst({
            where: { id: documentId, userId: auth.userId },
            include: esDocumentInclude,
          })
        : Promise.resolve(null),
    ]);

    // 別ユーザーが所有する文書もfindFirstがnullを返すため404になる（ADR-052）
    if (documentId && !selectedDocument) {
      return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    }

    return Response.json({
      companies: { items: companies.map(formatCompanySummary) },
      experiences: page(experiences.map(formatExperience), CONFIRMED_EXPERIENCE_LIMIT),
      documents: { items: documents.map(formatEsSummary) },
      selectedDocument: selectedDocument ? formatEsDocument(selectedDocument) : null,
    });
  } catch (error) {
    return internalError(error, 'ES添削画面の初期表示データ取得');
  }
}
