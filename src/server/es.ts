import type { EsAnalysisInput, EsAnalysisOutput } from '@/infrastructure/ai/types';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { countCodePoints, iso, objectArray, stringArray } from './api';
import { esSubmissionReadiness } from './es-readiness';

type ClaimRecord = {
  id: string;
  sentence: string;
  claimText: string;
  claimType: string;
  status: string;
  explanation: string | null;
  startOffset: number | null;
  endOffset: number | null;
  evidence: Array<{ sourceType: string; sourceId: string; quote: string }>;
};

type AnalysisRecord = {
  id: string;
  esDocumentId: string;
  revisionId: string | null;
  sourceKind: string;
  freshness: string;
  characterCount: number;
  withinCharacterLimit: boolean;
  questionCoverage: string;
  submissionReadiness: string;
  issues: unknown;
  comments: unknown;
  createdAt: Date;
  claims: ClaimRecord[];
};

type RevisionRecord = {
  id: string;
  esDocumentId: string;
  basedOnAnalysisId: string;
  freshness: string;
  revisedText: string;
  usedExperienceIds: unknown;
  usedSessionReportIds: unknown;
  characterCount: number;
  verificationAnalysisId: string | null;
  createdAt: Date;
  changes: Array<{ id: string; beforeText: string; afterText: string; reason: string; evidence: unknown; decision: string }>;
  verificationAnalysis?: AnalysisRecord | null;
};

export function formatClaim(claim: ClaimRecord) {
  return {
    id: claim.id,
    sentence: claim.sentence,
    text: claim.claimText,
    type: claim.claimType,
    status: claim.status,
    evidence: claim.evidence.map((item) => ({ sourceType: item.sourceType, sourceId: item.sourceId, quote: item.quote })),
    explanation: claim.explanation,
    targetRange: claim.startOffset === null || claim.endOffset === null
      ? null
      : { startOffset: claim.startOffset, endOffset: claim.endOffset },
  };
}

export function formatAnalysis(analysis: AnalysisRecord) {
  return {
    id: analysis.id,
    esDocumentId: analysis.esDocumentId,
    revisionId: analysis.revisionId,
    sourceKind: analysis.sourceKind,
    freshness: analysis.freshness,
    characterCount: analysis.characterCount,
    withinCharacterLimit: analysis.withinCharacterLimit,
    questionCoverage: analysis.questionCoverage,
    submissionReadiness: analysis.submissionReadiness,
    claims: analysis.claims.map(formatClaim),
    issues: objectArray(analysis.issues),
    comments: objectArray(analysis.comments),
    createdAt: iso(analysis.createdAt),
  };
}

export function formatRevision(revision: RevisionRecord) {
  const unsupportedClaims = revision.verificationAnalysis?.claims.filter((claim) => claim.status !== 'VERIFIED').map(formatClaim) ?? [];
  return {
    id: revision.id,
    esDocumentId: revision.esDocumentId,
    basedOnAnalysisId: revision.basedOnAnalysisId,
    freshness: revision.freshness,
    revisedText: revision.revisedText,
    usedExperienceIds: stringArray(revision.usedExperienceIds),
    usedSessionReportIds: stringArray(revision.usedSessionReportIds),
    characterCount: revision.characterCount,
    changes: revision.changes.map((change) => ({
      id: change.id,
      before: change.beforeText,
      after: change.afterText,
      reason: change.reason,
      evidence: objectArray(change.evidence),
      decision: change.decision,
    })),
    unsupportedClaims,
    verificationAnalysisId: revision.verificationAnalysisId,
    createdAt: iso(revision.createdAt),
  };
}

export function formatEsSummary(document: {
  id: string; companyId: string | null; targetRole: string | null; question: string; characterLimit: number;
  originalText: string; status: string; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: document.id,
    companyId: document.companyId,
    targetRole: document.targetRole,
    question: document.question,
    characterLimit: document.characterLimit,
    characterCount: countCodePoints(document.originalText),
    status: document.status,
    createdAt: iso(document.createdAt),
    updatedAt: iso(document.updatedAt),
  };
}

export function formatEsDocument(document: Parameters<typeof formatEsSummary>[0] & {
  preferredExperienceIds: unknown;
  emphasis: unknown;
  analyses: AnalysisRecord[];
  revisions: RevisionRecord[];
}) {
  return {
    ...formatEsSummary(document),
    originalText: document.originalText,
    preferredExperienceIds: stringArray(document.preferredExperienceIds),
    emphasis: stringArray(document.emphasis),
    analyses: document.analyses.map(formatAnalysis),
    revisions: document.revisions.map(formatRevision),
  };
}

export const analysisInclude = {
  claims: { include: { evidence: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

export const revisionInclude = {
  changes: { orderBy: { createdAt: 'asc' as const } },
  verificationAnalysis: { include: analysisInclude },
} as const;

export const esDocumentInclude = {
  analyses: { include: analysisInclude, orderBy: { createdAt: 'desc' as const } },
  revisions: { include: revisionInclude, orderBy: { createdAt: 'desc' as const } },
} as const;

export async function validatePreferredExperiences(value: unknown): Promise<string[] | string> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string') || new Set(value).size !== value.length) {
    return 'preferredExperienceIds は重複のないID配列で指定してください。';
  }
  const count = await prisma.experience.count({ where: { id: { in: value }, status: 'CONFIRMED' } });
  return count === value.length ? value : 'preferredExperienceIds には確認済み経験だけを指定してください。';
}

export async function buildEsAnalysisInput(document: {
  companyId: string | null;
  question: string;
  characterLimit: number;
  preferredExperienceIds: unknown;
}, text: string): Promise<EsAnalysisInput> {
  const [experiences, facts, reports, overallProfile] = await Promise.all([
    prisma.experience.findMany({ where: { status: 'CONFIRMED' }, include: { quotes: true } }),
    document.companyId
      ? prisma.companyFact.findMany({ where: { source: { companyId: document.companyId } }, include: { source: true } })
      : Promise.resolve([]),
    prisma.selfAnalysisReport.findMany({ orderBy: { generatedAt: 'asc' } }),
    prisma.overallSelfAnalysisProfile.findUnique({ where: { id: 'default' } }),
  ]);
  return {
    question: document.question,
    characterLimit: document.characterLimit,
    text,
    allConfirmedExperiences: experiences.map((experience) => ({
      id: experience.id,
      confirmedFacts: [
        experience.title,
        experience.situation,
        experience.role,
        ...stringArray(experience.actions),
        ...stringArray(experience.options),
        ...stringArray(experience.environment),
        ...[experience.goal, experience.decision, experience.decisionReason, experience.result, experience.positiveEmotion, experience.negativeEmotion]
          .filter((item): item is string => typeof item === 'string' && item.length > 0),
      ],
      sourceQuotes: experience.quotes.map((quote) => quote.quote),
    })),
    allowedCompanyFacts: facts.map((fact) => ({
      id: fact.id,
      category: fact.category,
      fact: fact.fact,
      evidenceQuote: fact.evidenceQuote,
      trustLevel: fact.source.trustLevel,
    })),
    allSessionReports: reports.map((report) => ({
      id: report.id,
      sourceSessionId: report.sourceSessionId,
      summary: report.summary,
      axes: objectArray(report.axisSnapshots),
      mustConditions: objectArray(report.mustConditions),
      preferConditions: objectArray(report.preferConditions),
      avoidConditions: objectArray(report.avoidConditions),
      verifyConditions: objectArray(report.verifyConditions),
      freshness: report.isStale ? 'STALE' : 'CURRENT',
    })),
    ...(overallProfile ? {
      overallSelfAnalysisProfile: {
        summary: overallProfile.summary,
        axes: objectArray(overallProfile.axisTrends),
        strengths: objectArray(overallProfile.strengths),
        weaknesses: objectArray(overallProfile.weaknesses),
        freshness: overallProfile.freshness,
      },
    } : {}),
    preferredExperienceIds: stringArray(document.preferredExperienceIds),
  };
}

function codePointRange(text: string, sentence: string): { startOffset: number; endOffset: number } | null {
  const first = text.indexOf(sentence);
  if (first < 0 || text.indexOf(sentence, first + sentence.length) >= 0) return null;
  return {
    startOffset: countCodePoints(text.slice(0, first)),
    endOffset: countCodePoints(text.slice(0, first + sentence.length)),
  };
}

export function normalizeEsOutput(output: EsAnalysisOutput, input: EsAnalysisInput) {
  const factTrust = new Map(input.allowedCompanyFacts.map((fact) => [fact.id, fact.trustLevel]));
  const claims = output.claims.map((claim) => {
    const hasAllowedEvidence = claim.type === 'COMPANY_FACT'
      ? claim.evidence.some((item) => item.sourceType === 'COMPANY_FACT' && factTrust.get(item.sourceId) === 'OFFICIAL')
      : claim.evidence.some((item) => item.sourceType === 'EXPERIENCE');
    const status = !hasAllowedEvidence
      ? 'NEEDS_CONFIRMATION'
      : claim.suggestedStatus;
    return { ...claim, status, targetRange: codePointRange(input.text, claim.sentence) };
  });
  const issues = output.issues.map((issue) => ({
    ...issue,
    targetRange: issue.sentence ? codePointRange(input.text, issue.sentence) : null,
    relatedClaimIds: [] as string[],
  }));
  const characterCount = countCodePoints(input.text);
  const withinCharacterLimit = characterCount <= input.characterLimit;
  const submissionReadiness = esSubmissionReadiness({
    withinCharacterLimit,
    questionCoverage: output.questionCoverage,
    claimStatuses: claims.map((claim) => claim.status),
  });
  const comments = [
    ...claims.map((claim) => ({
      category: 'EVIDENCE_STATUS',
      message: claim.explanation,
      severity: claim.status === 'VERIFIED' ? 'INFO' : claim.status === 'CONTRADICTED' ? 'ERROR' : 'WARNING',
      targetRange: claim.targetRange,
      evidence: claim.evidence,
    })),
    ...issues.map((issue) => ({
      category: 'ISSUE',
      message: issue.message,
      severity: issue.severity,
      targetRange: issue.targetRange,
      evidence: [] as unknown[],
    })),
  ];
  return { claims, issues, comments, characterCount, withinCharacterLimit, submissionReadiness };
}

export function toAiAnalysis(analysis: AnalysisRecord): EsAnalysisOutput {
  return {
    questionCoverage: analysis.questionCoverage as EsAnalysisOutput['questionCoverage'],
    claims: analysis.claims.map((claim) => ({
      sentence: claim.sentence,
      text: claim.claimText,
      type: claim.claimType as EsAnalysisOutput['claims'][number]['type'],
      suggestedStatus: claim.status as EsAnalysisOutput['claims'][number]['suggestedStatus'],
      evidence: claim.evidence.map((item) => ({
        sourceType: item.sourceType as 'EXPERIENCE' | 'COMPANY_FACT', sourceId: item.sourceId, quote: item.quote,
      })),
      explanation: claim.explanation ?? '',
    })),
    issues: objectArray(analysis.issues).map((issue) => ({
      code: issue.code as EsAnalysisOutput['issues'][number]['code'],
      severity: issue.severity as EsAnalysisOutput['issues'][number]['severity'],
      message: String(issue.message ?? ''),
      sentence: typeof issue.sentence === 'string' ? issue.sentence : null,
    })),
  };
}

export async function persistAnalysis(
  tx: Prisma.TransactionClient,
  options: {
    esDocumentId: string;
    revisionId: string | null;
    sourceKind: 'ORIGINAL' | 'REVISION';
    input: EsAnalysisInput;
    output: EsAnalysisOutput;
  },
) {
  const normalized = normalizeEsOutput(options.output, options.input);
  return tx.esAnalysis.create({
    data: {
      esDocumentId: options.esDocumentId,
      revisionId: options.revisionId,
      sourceKind: options.sourceKind,
      freshness: 'CURRENT',
      characterCount: normalized.characterCount,
      withinCharacterLimit: normalized.withinCharacterLimit,
      questionCoverage: options.output.questionCoverage,
      submissionReadiness: normalized.submissionReadiness,
      issues: normalized.issues,
      comments: normalized.comments as Prisma.InputJsonValue,
      claims: {
        create: normalized.claims.map((claim) => ({
          sentence: claim.sentence,
          claimText: claim.text,
          claimType: claim.type,
          status: claim.status,
          explanation: claim.explanation,
          startOffset: claim.targetRange?.startOffset ?? null,
          endOffset: claim.targetRange?.endOffset ?? null,
          evidence: {
            create: claim.evidence.map((evidence) => ({
              sourceType: evidence.sourceType,
              sourceId: evidence.sourceId,
              quote: evidence.quote,
            })),
          },
        })),
      },
    },
    include: analysisInclude,
  });
}
