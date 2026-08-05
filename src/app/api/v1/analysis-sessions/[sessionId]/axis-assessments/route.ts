import { prisma } from '../../../../../../lib/prisma.ts';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { sessionId } = params;

    const session = await prisma.analysisSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定されたセッションが存在しません。' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const validAxes = ['ENERGY_SOURCE', 'ACTION_STYLE', 'SATISFACTION_SOURCE', 'PREFERRED_ENVIRONMENT'];
    if (!body.axis || !validAxes.includes(body.axis)) {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: `axis は ${validAxes.join(', ')} のいずれかです。` },
        { status: 422 }
      );
    }

    const created = await prisma.axisAssessment.create({
      data: {
        sourceSessionId: sessionId,
        axis: body.axis,
        position: body.position || 'INSUFFICIENT_EVIDENCE',
        aiStatement: body.aiStatement || '',
        displayStatement: body.displayStatement || '',
        status: body.status || 'INSUFFICIENT_EVIDENCE',
        leftConditions: body.leftConditions || [],
        rightConditions: body.rightConditions || [],
        contextNotes: body.contextNotes || [],
        internalConfidence: body.internalConfidence || null,
      },
    });

    return Response.json(
      {
        id: created.id,
        sourceSessionId: created.sourceSessionId,
        axis: created.axis,
        position: created.position,
        aiStatement: created.aiStatement,
        displayStatement: created.displayStatement,
        status: created.status,
        leftConditions: created.leftConditions,
        rightConditions: created.rightConditions,
        contextNotes: created.contextNotes,
        userAssessment: created.userAssessment,
        userNote: created.userNote,
        internalConfidence: created.internalConfidence,
        isStale: created.isStale,
        createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : new Date(created.createdAt).toISOString(),
        updatedAt: created.updatedAt instanceof Date ? created.updatedAt.toISOString() : new Date(created.updatedAt).toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating axis assessment:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'AxisAssessment 作成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
