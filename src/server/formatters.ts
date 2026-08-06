import { prisma } from '@/lib/prisma';
import type { AnalysisSessionResponse, SelfAnalysisAxis } from '@/types/dashboard';
import type { ExperienceResponse } from '@/types/experience';
import type { ChatMessageResponse } from '@/types/session';
import { iso, nullableIso, objectArray, SELF_ANALYSIS_AXES, stringArray } from './api';

export async function formatSession(session: {
  id: string;
  title: string;
  status: string;
  targetAxes: unknown;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): Promise<AnalysisSessionResponse> {
  const targetAxes = stringArray(session.targetAxes) as SelfAnalysisAxis[];
  const [userMessageCount, confirmedExperiences, evidencedAxes] = await Promise.all([
    prisma.message.count({ where: { sessionId: session.id, role: 'USER' } }),
    prisma.experience.findMany({
      where: { sourceSessionId: session.id, status: 'CONFIRMED' },
      select: { type: true },
    }),
    prisma.axisEvidenceItem.findMany({
      where: { experience: { sourceSessionId: session.id, status: 'CONFIRMED' }, supportType: 'SUPPORT' },
      select: { axis: true },
    }),
  ]);
  const coveredAxes = new Set(evidencedAxes.map((item) => item.axis));
  return {
    id: session.id,
    title: session.title,
    status: session.status as AnalysisSessionResponse['status'],
    targetAxes,
    progress: {
      userMessageCount,
      confirmedExperienceCount: confirmedExperiences.length,
      canGenerateResult: userMessageCount >= 1,
      coveredExperienceTypes: [...new Set(confirmedExperiences.map((item) => item.type))],
      missingAxes: targetAxes.filter((axis) => !coveredAxes.has(axis)),
    },
    createdAt: iso(session.createdAt),
    updatedAt: iso(session.updatedAt),
    completedAt: nullableIso(session.completedAt),
  };
}

export function formatMessage(message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  questionTarget: string | null;
  createdAt: Date;
}): ChatMessageResponse {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role as ChatMessageResponse['role'],
    content: message.content,
    questionTarget: message.questionTarget as ChatMessageResponse['questionTarget'],
    createdAt: iso(message.createdAt),
  };
}

export function formatExperience(experience: {
  id: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  type: string;
  title: string;
  situation: string;
  goal: string | null;
  role: string;
  options: unknown;
  decision: string | null;
  decisionReason: string | null;
  actions: unknown;
  result: string | null;
  positiveEmotion: string | null;
  negativeEmotion: string | null;
  energyChange: number;
  environment: unknown;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  quotes?: Array<{ messageId: string; quote: string }>;
}): ExperienceResponse {
  return {
    id: experience.id,
    sourceSessionId: experience.sourceSessionId,
    sourceMessageId: experience.sourceMessageId,
    type: experience.type as ExperienceResponse['type'],
    title: experience.title,
    situation: experience.situation,
    goal: experience.goal,
    role: experience.role,
    options: stringArray(experience.options),
    decision: experience.decision,
    decisionReason: experience.decisionReason,
    actions: stringArray(experience.actions),
    result: experience.result,
    positiveEmotion: experience.positiveEmotion,
    negativeEmotion: experience.negativeEmotion,
    energyChange: experience.energyChange,
    environment: stringArray(experience.environment),
    evidenceQuotes: experience.quotes?.map((quote) => ({ messageId: quote.messageId, quote: quote.quote })) ?? [],
    status: experience.status as ExperienceResponse['status'],
    confirmedAt: nullableIso(experience.confirmedAt),
    createdAt: iso(experience.createdAt),
    updatedAt: iso(experience.updatedAt),
  };
}

export function formatAxisAssessment(assessment: {
  id: string;
  sourceSessionId: string;
  axis: string;
  position: string;
  aiStatement: string;
  displayStatement: string;
  status: string;
  leftConditions: unknown;
  rightConditions: unknown;
  contextNotes: unknown;
  userAssessment: string;
  userNote: string | null;
  isStale: boolean;
  createdAt: Date;
  updatedAt: Date;
  evidenceLinks?: Array<{
    evidence: {
      id: string;
      experienceId: string;
      messageId: string | null;
      axis: string;
      pole: string;
      supportType: string;
      statement: string;
      quote: string;
      interpretation: string;
    };
  }>;
}) {
  const evidence = (assessment.evidenceLinks ?? []).map((link) => ({
    id: link.evidence.id,
    experienceId: link.evidence.experienceId,
    messageId: link.evidence.messageId,
    axis: link.evidence.axis,
    pole: link.evidence.pole,
    supportType: link.evidence.supportType,
    statement: link.evidence.statement,
    quote: link.evidence.quote,
    interpretation: link.evidence.interpretation,
  }));
  const byPole = (pole: string) => evidence.filter((item) => item.pole === pole && item.supportType === 'SUPPORT');
  return {
    id: assessment.id,
    sourceSessionId: assessment.sourceSessionId,
    axis: assessment.axis,
    position: assessment.position,
    aiStatement: assessment.aiStatement,
    displayStatement: assessment.displayStatement,
    status: assessment.status,
    leftEvidence: byPole('LEFT'),
    rightEvidence: byPole('RIGHT'),
    bothEvidence: byPole('BOTH'),
    contextEvidence: byPole('CONTEXT_DEPENDENT'),
    counterEvidence: evidence.filter((item) => item.supportType === 'COUNTER'),
    leftConditions: stringArray(assessment.leftConditions),
    rightConditions: stringArray(assessment.rightConditions),
    contextNotes: stringArray(assessment.contextNotes),
    userAssessment: assessment.userAssessment,
    userNote: assessment.userNote,
    isStale: assessment.isStale,
    createdAt: iso(assessment.createdAt),
    updatedAt: iso(assessment.updatedAt),
  };
}

export function formatReport(report: {
  id: string;
  sourceSessionId: string;
  summary: string;
  axisSnapshots: unknown;
  mustConditions: unknown;
  preferConditions: unknown;
  avoidConditions: unknown;
  verifyConditions: unknown;
  nextExperiments: unknown;
  userMessageCount: number;
  confirmedExperienceCount: number;
  isStale: boolean;
  generatedAt: Date;
}) {
  return {
    id: report.id,
    sourceSessionId: report.sourceSessionId,
    summary: report.summary,
    axes: objectArray(report.axisSnapshots),
    mustConditions: objectArray(report.mustConditions),
    preferConditions: objectArray(report.preferConditions),
    avoidConditions: objectArray(report.avoidConditions),
    verifyConditions: objectArray(report.verifyConditions),
    nextExperiments: stringArray(report.nextExperiments),
    userMessageCount: report.userMessageCount,
    confirmedExperienceCount: report.confirmedExperienceCount,
    freshness: report.isStale ? 'STALE' : 'CURRENT',
    generatedAt: iso(report.generatedAt),
  };
}

export function formatReportSummary(report: {
  id: string;
  sourceSessionId: string;
  summary: string;
  userMessageCount: number;
  confirmedExperienceCount: number;
  isStale: boolean;
  generatedAt: Date;
}) {
  return {
    id: report.id,
    sourceSessionId: report.sourceSessionId,
    summary: report.summary,
    userMessageCount: report.userMessageCount,
    confirmedExperienceCount: report.confirmedExperienceCount,
    freshness: report.isStale ? 'STALE' : 'CURRENT',
    generatedAt: iso(report.generatedAt),
  };
}

export function defaultAxes(): SelfAnalysisAxis[] {
  return [...SELF_ANALYSIS_AXES];
}

export function formatOverallProfile(profile: {
  id: string;
  summary: string;
  axisTrends: unknown;
  strengths: unknown;
  weaknesses: unknown;
  sourceReportIds: unknown;
  completedSessionCount: number;
  userMessageCount: number;
  confirmedExperienceCount: number;
  isDataSparse: boolean;
  dataWarningReasons: unknown;
  freshness: string;
  generatedAt: Date;
}) {
  return {
    id: profile.id,
    summary: profile.summary,
    axes: objectArray(profile.axisTrends),
    strengths: objectArray(profile.strengths),
    weaknesses: objectArray(profile.weaknesses),
    dataSummary: {
      completedSessionCount: profile.completedSessionCount,
      userMessageCount: profile.userMessageCount,
      confirmedExperienceCount: profile.confirmedExperienceCount,
      isDataSparse: profile.isDataSparse,
      warningReasons: stringArray(profile.dataWarningReasons),
    },
    sourceReportIds: stringArray(profile.sourceReportIds),
    freshness: profile.freshness,
    generatedAt: iso(profile.generatedAt),
  };
}
