import { prisma } from '../../../../../../lib/prisma.ts';
import type { SendMessageRequest, ChatMessageResponse } from '../../../../../../types/session.ts';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } }
): Promise<Response> {
  try {
    const params = await context.params;
    const { sessionId } = params;

    // 1. セッションの存在確認
    const session = await prisma.analysisSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return Response.json(
        { code: 'NOT_FOUND', message: '指定されたセッションが存在しません。' },
        { status: 404 }
      );
    }

    const body: SendMessageRequest = (await request.json()) as SendMessageRequest;

    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return Response.json(
        { code: 'VALIDATION_ERROR', message: 'content は必須項目です。' },
        { status: 422 }
      );
    }

    const role = body.role || 'USER';
    const content = body.content;
    const clientMessageId = body.clientMessageId || null;

    // 2. 二重送信防止チェック (clientMessageId による確認)
    if (clientMessageId) {
      const existing = await prisma.message.findUnique({
        where: { clientMessageId },
      });
      if (existing) {
        return Response.json(formatMessage(existing), { status: 200 });
      }
    }

    // 3. 二重送信防止チェック (直前のメッセージの role & content 重複確認)
    const lastMessage = await prisma.message.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    if (lastMessage && lastMessage.role === role && lastMessage.content === content) {
      return Response.json(formatMessage(lastMessage), { status: 200 });
    }

    // 4. メッセージの新規保存
    const newMessage = await prisma.message.create({
      data: {
        sessionId,
        role,
        content,
        questionTarget: body.questionTarget || null,
        evidenceCandidates: body.evidenceCandidates || null,
        clientMessageId,
      },
    });

    return Response.json(formatMessage(newMessage), { status: 201 });
  } catch (error) {
    console.error('Error saving chat message:', error);
    return Response.json(
      { code: 'INTERNAL_ERROR', message: 'メッセージ保存中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

function formatMessage(msg: any): ChatMessageResponse {
  return {
    id: msg.id,
    sessionId: msg.sessionId,
    role: msg.role,
    content: msg.content,
    questionTarget: msg.questionTarget || null,
    evidenceCandidates: msg.evidenceCandidates || null,
    clientMessageId: msg.clientMessageId || null,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString(),
  };
}
