import { internalError } from '@/server/api';
import { checkLmStudio } from '@/server/system';

export async function GET(): Promise<Response> {
  try {
    return Response.json(await checkLmStudio());
  } catch (error) {
    return internalError(error, 'LM Studio状態の取得');
  }
}
