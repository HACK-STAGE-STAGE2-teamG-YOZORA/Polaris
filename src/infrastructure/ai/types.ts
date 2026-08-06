export type SelfAnalysisAxis =
  | "ENERGY_SOURCE"
  | "ACTION_STYLE"
  | "SATISFACTION_SOURCE"
  | "PREFERRED_ENVIRONMENT";

export type AxisPole =
  | "LEFT"
  | "RIGHT"
  | "BOTH"
  | "CONTEXT_DEPENDENT"
  | "UNKNOWN";

export type AxisPosition =
  | "LEFT"
  | "LEANS_LEFT"
  | "BALANCED_OR_BOTH"
  | "LEANS_RIGHT"
  | "RIGHT"
  | "CONTEXT_DEPENDENT"
  | "INSUFFICIENT_EVIDENCE";

export type ExperienceType =
  | "ENGAGED"
  | "ACHIEVEMENT"
  | "CHALLENGE"
  | "DRAINING_SUCCESS"
  | "TEAM_CONFLICT"
  | "OTHER";

export type QuestionTarget =
  | SelfAnalysisAxis
  | "EXPERIENCE_DETAIL"
  | "CONTRADICTION"
  | "CONFIRMATION";

export type EvidenceSupportType = "SUPPORT" | "COUNTER" | "UNKNOWN";

export type ConversationMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

export type ChatTurnInput = {
  session: {
    id: string;
    targetAxes: SelfAnalysisAxis[];
    coveredExperienceTypes: ExperienceType[];
    missingAxes: SelfAnalysisAxis[];
  };
  messages: ConversationMessage[];
  activeExperienceDraft?: Record<string, unknown>;
};

export type EvidenceCandidate = {
  axis: SelfAnalysisAxis;
  pole: AxisPole;
  statement: string;
  supportType: EvidenceSupportType;
  messageId: string;
  quote: string;
  interpretation: string;
};

export type ChatTurnOutput = {
  reply: string;
  evidenceCandidates: EvidenceCandidate[];
  missingAxes: SelfAnalysisAxis[];
  nextQuestionTarget: QuestionTarget;
  experienceReady: boolean;
  completionIntent: "NONE" | "SUGGESTED";
};

export type ExperienceDraftInput = {
  requestedType: ExperienceType;
  messages: ConversationMessage[];
};

export type ExperienceQuote = {
  messageId: string;
  quote: string;
};

export type ExperienceDraftOutput = {
  type: ExperienceType;
  title: string;
  situation: string;
  goal: string | null;
  role: string;
  options: string[];
  decision: string | null;
  decisionReason: string | null;
  actions: string[];
  result: string | null;
  positiveEmotion: string | null;
  negativeEmotion: string | null;
  energyChange: -2 | -1 | 0 | 1 | 2;
  environment: string[];
  evidenceQuotes: ExperienceQuote[];
  missingFields: string[];
};

export type ExperienceGroundingField =
  | "goal"
  | "options"
  | "decision"
  | "decisionReason";

export type ExperienceGroundingOutput = {
  assessments: Array<{
    field: ExperienceGroundingField;
    grounded: boolean;
    messageId: string | null;
    quote: string | null;
    explanation: string;
  }>;
};

export type ConfirmedExperience = ExperienceDraftOutput & {
  id: string;
  status: "CONFIRMED";
};

export type AxisEvidence = {
  id: string;
  experienceId: string;
  axis: SelfAnalysisAxis;
  pole: AxisPole;
  statement: string;
  supportType: EvidenceSupportType;
  quote: string;
  interpretation: string;
};

export type AxisAssessmentReference = {
  id: string;
  axis: SelfAnalysisAxis;
  position: AxisPosition;
  statement: string;
  userAssessment:
    | "UNREVIEWED"
    | "MATCHES"
    | "PARTIALLY_MATCHES"
    | "DOES_NOT_MATCH"
    | "NEEDS_EXPLORATION";
};

export type AxisAssessmentsInput = {
  sourceSessionId: string;
  userMessageCount: number;
  confirmedExperiences: ConfirmedExperience[];
  evidenceItems: AxisEvidence[];
  previousAssessments: AxisAssessmentReference[];
};

export type AxisAssessmentsOutput = {
  assessments: Array<{
    axis: SelfAnalysisAxis;
    suggestedPosition: AxisPosition;
    statement: string;
    leftEvidenceIds: string[];
    rightEvidenceIds: string[];
    bothEvidenceIds: string[];
    contextEvidenceIds: string[];
    counterEvidenceIds: string[];
    leftConditions: string[];
    rightConditions: string[];
    contextNotes: string[];
  }>;
  missingAxes: SelfAnalysisAxis[];
  contradictionsToExplore: string[];
};

export type SelfAnalysisReportInput = {
  sourceSessionId: string;
  userMessageCount: number;
  axisAssessments: AxisAssessmentReference[];
  confirmedExperiences: ConfirmedExperience[];
};

export type SelfAnalysisReportOutput = {
  summary: string;
  axisComments: Array<{
    axis: SelfAnalysisAxis;
    axisAssessmentId: string;
    comment: string;
  }>;
  mustConditions: CareerConditionOutput[];
  preferConditions: CareerConditionOutput[];
  avoidConditions: CareerConditionOutput[];
  verifyConditions: CareerConditionOutput[];
  nextExperiments: string[];
};

export type CareerConditionOutput = {
  statement: string;
  axisAssessmentIds: string[];
};

export type OverallSelfAnalysisInput = {
  completedSessionReports: Array<{
    id: string;
    summary: string;
    axes: Array<{
      axis: SelfAnalysisAxis;
      position: AxisPosition;
      statement: string;
      evidenceIds: string[];
      contextNotes: string[];
      userAssessment: AxisAssessmentReference["userAssessment"];
    }>;
  }>;
  confirmedExperiences: ConfirmedExperience[];
  evidenceItems: AxisEvidence[];
  sourceUserQuotes: Array<{ messageId: string; sessionId: string; quote: string }>;
};

export type OverallSelfAnalysisOutput = {
  summary: string;
  axisTrends: Array<{
    axis: SelfAnalysisAxis;
    suggestedPosition: AxisPosition;
    statement: string;
    sourceReportIds: string[];
    evidenceIds: string[];
    contextNotes: string[];
  }>;
  strengths: ProfileInsightOutput[];
  weaknesses: ProfileInsightOutput[];
};

export type ProfileInsightOutput = {
  title: string;
  description: string;
  axes: SelfAnalysisAxis[];
  sourceReportIds: string[];
  evidenceIds: string[];
};

export type CompanyFactsInput = {
  company: { id: string; name: string; targetRole?: string };
  source: {
    title: string;
    sourceUrl?: string;
    trustLevel: 'OFFICIAL' | 'USER_PROVIDED_UNVERIFIED';
    text: string;
  };
};

export type CompanyFactsOutput = {
  facts: Array<{ category: string; fact: string; evidenceQuote: string }>;
  unknownItems: string[];
};

export type CompanyRecommendationsInput = {
  selfAnalysisReport: {
    id: string;
    summary: string;
    axisSnapshots: unknown;
    mustConditions: unknown;
    preferConditions: unknown;
    avoidConditions: unknown;
    verifyConditions: unknown;
  };
  confirmedExperiences: Array<{
    id: string;
    title: string;
    type: string;
    situation: string;
    role: string;
    actions: string[];
    result: string | null;
  }>;
  targetRoles: string[];
  preferredLocations: string[];
  companies: Array<{
    id: string;
    name: string;
    targetRole: string | null;
    sources: Array<{
      id: string;
      url: string | null;
      facts: Array<{ id: string; category: string; fact: string; evidenceQuote: string }>;
    }>;
  }>;
};

export type CompanyRecommendationsOutput = {
  recommendations: Array<{
    companyId: string;
    slot: 'PRIMARY' | 'CHALLENGE' | 'UNEXPECTED';
    recommendedRole: string | null;
    rationale: string;
    connectedExperienceIds: string[];
    matchingConditions: string[];
    concerns: string[];
    unknowns: string[];
    verificationQuestions: string[];
    companySourceIds: string[];
  }>;
  excludedCompanies: Array<{ companyId: string; reason: string }>;
};

export type SourceEvidence = {
  sourceType: "EXPERIENCE" | "COMPANY_FACT";
  sourceId: string;
  quote: string;
};

export type EsAnalysisInput = {
  question: string;
  characterLimit: number;
  text: string;
  allConfirmedExperiences: Array<{
    id: string;
    confirmedFacts: string[];
    sourceQuotes: string[];
  }>;
  allowedCompanyFacts: Array<{
    id: string;
    category: string;
    fact: string;
    evidenceQuote: string;
    trustLevel: "OFFICIAL" | "USER_PROVIDED_UNVERIFIED";
  }>;
  allSessionReports: Array<Record<string, unknown>>;
  overallSelfAnalysisProfile?: Record<string, unknown>;
  preferredExperienceIds: string[];
};

export type EsAnalysisOutput = {
  questionCoverage: "ANSWERED" | "PARTIALLY_ANSWERED" | "NOT_ANSWERED";
  claims: Array<{
    sentence: string;
    text: string;
    type:
      | "PERSONAL_FACT"
      | "NUMBER"
      | "PERIOD"
      | "ROLE"
      | "RESULT"
      | "CAPABILITY"
      | "COMPANY_FACT"
      | "MOTIVATION"
      | "FUTURE_GOAL";
    suggestedStatus:
      | "VERIFIED"
      | "PARTIALLY_VERIFIED"
      | "NEEDS_CONFIRMATION"
      | "CONTRADICTED";
    evidence: SourceEvidence[];
    explanation: string;
  }>;
  issues: Array<{
    code:
      | "QUESTION_NOT_ANSWERED"
      | "UNSUPPORTED_PERSONAL_FACT"
      | "UNSUPPORTED_COMPANY_FACT"
      | "CONTRADICTION"
      | "ABSTRACT_EXPRESSION"
      | "REDUNDANT_EXPRESSION"
      | "CHARACTER_LIMIT_EXCEEDED"
      | "CHARACTER_LIMIT_UNDERUSED"
      | "VOICE_DEVIATION";
    severity: "ERROR" | "WARNING" | "INFO";
    message: string;
    sentence: string | null;
  }>;
};

export type EsRevisionInput = EsAnalysisInput & {
  latestAnalysis: EsAnalysisOutput;
  emphasis: string[];
  preserveExpressions: string[];
  forbiddenAdditions: string[];
};

export type EsRevisionOutput = {
  revisedText: string;
  usedExperienceIds: string[];
  usedSessionReportIds: string[];
  changes: Array<{
    before: string;
    after: string;
    reason: string;
    evidence: SourceEvidence[];
  }>;
  questionsForUser: string[];
};

export type PolarisAiConfig = {
  baseUrl: string;
  modelId: string;
  chatTemperature: number;
  structuredTemperature: number;
  chatMaxTokens: number;
  taskMaxTokens: number;
  chatTimeoutMs: number;
  taskTimeoutMs: number;
  esTimeoutMs: number;
  repairAttempts: number;
  contextLength: number;
  schemaReserveTokens: number;
  estimatedCharsPerToken: number;
};
