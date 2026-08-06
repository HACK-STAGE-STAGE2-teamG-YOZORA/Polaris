import { prisma } from '@/lib/prisma';
import { internalError, iso } from '@/server/api';
import { checkLmStudio } from '@/server/system';

export async function GET(): Promise<Response> {
  try {
    const [database, ai] = await Promise.all([
      prisma.$queryRawUnsafe('SELECT 1')
        .then(() => ({ status: 'UP' as const }))
        .catch(() => ({ status: 'DOWN' as const, message: 'Database unavailable' })),
      checkLmStudio(),
    ]);
    const aiHealth = ai.status === 'CONNECTED'
      ? { status: 'UP' as const }
      : { status: 'DOWN' as const, message: ai.guidance[0] ?? ai.status };
    return Response.json({
      status: database.status === 'UP' && aiHealth.status === 'UP' ? 'OK' : 'DEGRADED',
      version: process.env.npm_package_version ?? '0.1.0',
      database,
      ai: aiHealth,
      timestamp: iso(new Date()),
    });
  } catch (error) {
    return internalError(error, 'ヘルスチェック');
  }
}
