import { LmStudioPolarisAiGateway, PolarisAiError } from '@/infrastructure/ai/lm-studio-ai-gateway';
import type { InterviewQuestionsInput } from '@/infrastructure/ai/types';
import { prisma } from '@/lib/prisma';
import { aiError, internalError, jsonBody, problem, stringArray } from '@/server/api';

function optionalId(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function count(value: unknown, fallback: number): number | null {
  const selected = value === undefined ? fallback : value;
  return Number.isInteger(selected) && Number(selected) >= 1 && Number(selected) <= 10
    ? Number(selected)
    : null;
}

export async function POST(request: Request): Promise<Response> {
  let ai: LmStudioPolarisAiGateway | undefined;
  try {
    const body = await jsonBody(request);
    if (!body) return problem(422, 'VALIDATION_ERROR', 'JSONオブジェクトを指定してください。');

    const selfAnalysisReportId = optionalId(body.selfAnalysisReportId);
    const requestedCompanyId = optionalId(body.companyId);
    const esDocumentId = optionalId(body.esDocumentId);
    if (selfAnalysisReportId === undefined && body.selfAnalysisReportId !== undefined) {
      return problem(422, 'VALIDATION_ERROR', 'selfAnalysisReportId が不正です。');
    }
    if (requestedCompanyId === undefined && body.companyId !== undefined) {
      return problem(422, 'VALIDATION_ERROR', 'companyId が不正です。');
    }
    if (esDocumentId === undefined && body.esDocumentId !== undefined) {
      return problem(422, 'VALIDATION_ERROR', 'esDocumentId が不正です。');
    }
    if (body.targetRole !== undefined && body.targetRole !== null
      && (typeof body.targetRole !== 'string' || body.targetRole.length > 300)) {
      return problem(422, 'VALIDATION_ERROR', 'targetRole は300文字以下で指定してください。');
    }
    const deepDiveCount = count(body.deepDiveCount, 5);
    const reverseQuestionCount = count(body.reverseQuestionCount, 5);
    if (deepDiveCount === null || reverseQuestionCount === null) {
      return problem(422, 'VALIDATION_ERROR', '質問数は1〜10の整数で指定してください。');
    }

    let experienceIds: string[] | undefined;
    if (body.experienceIds !== undefined) {
      if (!Array.isArray(body.experienceIds)
        || body.experienceIds.length < 1
        || body.experienceIds.length > 20
        || body.experienceIds.some((id) => typeof id !== 'string')
        || new Set(body.experienceIds).size !== body.experienceIds.length) {
        return problem(422, 'VALIDATION_ERROR', 'experienceIds は1〜20件の重複しないID配列で指定してください。');
      }
      experienceIds = body.experienceIds as string[];
    }

    const report = selfAnalysisReportId
      ? await prisma.selfAnalysisReport.findUnique({ where: { id: selfAnalysisReportId } })
      : await prisma.selfAnalysisReport.findFirst({ where: { isStale: false }, orderBy: { generatedAt: 'desc' } });
    if (!report) return problem(409, 'CONFLICT', '面接質問に使用できる自己分析レポートがありません。');
    if (report.isStale) return problem(409, 'CONFLICT', '指定された自己分析レポートは古いため再生成が必要です。');

    const esDocument = esDocumentId
      ? await prisma.esDocument.findUnique({ where: { id: esDocumentId } })
      : null;
    if (esDocumentId && !esDocument) return problem(404, 'NOT_FOUND', '指定されたES文書がありません。');
    if (requestedCompanyId && esDocument?.companyId && requestedCompanyId !== esDocument.companyId) {
      return problem(422, 'VALIDATION_ERROR', 'ES文書と異なる企業は指定できません。');
    }
    const companyId = requestedCompanyId ?? esDocument?.companyId ?? null;
    const company = companyId
      ? await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          sources: {
            where: { trustLevel: 'OFFICIAL' },
            include: { facts: true },
            orderBy: { retrievedAt: 'desc' },
            take: 3,
          },
        },
      })
      : null;
    if (companyId && !company) return problem(404, 'NOT_FOUND', '指定された企業がありません。');
    if (company && !company.sources.some((source) => source.facts.length > 0)) {
      return problem(409, 'CONFLICT', '逆質問の根拠に使える公式企業事実がありません。');
    }

    const experiences = await prisma.experience.findMany({
      where: {
        status: 'CONFIRMED',
        ...(experienceIds ? { id: { in: experienceIds } } : {}),
      },
      orderBy: { confirmedAt: 'desc' },
      take: 20,
    });
    if (experienceIds && experiences.length !== experienceIds.length) {
      return problem(422, 'VALIDATION_ERROR', 'experienceIds に未確認または存在しない経験が含まれます。');
    }
    if (experiences.length === 0) {
      return problem(409, 'CONFLICT', '深掘り質問の根拠に使える確認済み経験がありません。');
    }

    const input: InterviewQuestionsInput = {
      selfAnalysisReport: {
        id: report.id,
        summary: report.summary,
        mustConditions: report.mustConditions,
        preferConditions: report.preferConditions,
        avoidConditions: report.avoidConditions,
        verifyConditions: report.verifyConditions,
      },
      confirmedExperiences: experiences.map((experience) => ({
        id: experience.id,
        title: experience.title,
        situation: experience.situation,
        role: experience.role,
        actions: stringArray(experience.actions),
        result: experience.result,
      })),
      company: company ? {
        id: company.id,
        name: company.name,
        targetRole: company.targetRole,
        sources: company.sources.filter((source) => source.facts.length > 0).map((source) => ({
          id: source.id,
          facts: source.facts.map((fact) => ({
            id: fact.id,
            category: fact.category,
            fact: fact.fact,
            evidenceQuote: fact.evidenceQuote,
          })),
        })),
      } : null,
      esDocument: esDocument ? {
        id: esDocument.id,
        question: esDocument.question,
        text: esDocument.originalText,
      } : null,
      targetRole: typeof body.targetRole === 'string'
        ? body.targetRole
        : esDocument?.targetRole ?? company?.targetRole ?? null,
      deepDiveCount,
      reverseQuestionCount,
    };

    ai = new LmStudioPolarisAiGateway();
    const output = await ai.generateInterviewQuestions(input);
    return Response.json({
      selfAnalysisReportId: report.id,
      companyId,
      esDocumentId: esDocument?.id ?? null,
      targetRole: input.targetRole,
      ...output,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof PolarisAiError) return aiError(error);
    return internalError(error, '面接質問の生成');
  } finally {
    if (ai) await ai[Symbol.asyncDispose]();
  }
}
