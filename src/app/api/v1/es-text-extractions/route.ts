import { internalError, problem } from '@/server/api';
import { EsTextExtractionError, extractEsText } from '@/server/es-text-extraction';
import { requireAuth } from '@/server/auth/require-auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return problem(422, 'VALIDATION_ERROR', 'multipart/form-dataでファイルを指定してください。');
    }
    const files = formData.getAll('file');
    const value = files[0];
    if (files.length !== 1 || !(value instanceof File)) {
      return problem(422, 'VALIDATION_ERROR', 'fileを1件指定してください。');
    }
    return Response.json(await extractEsText(value));
  } catch (error) {
    if (error instanceof EsTextExtractionError) {
      return problem(error.status, error.code, error.message);
    }
    return internalError(error, 'ES文章の抽出');
  }
}
