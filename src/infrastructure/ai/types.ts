export type HypothesisCategory =
  | "CAN"
  | "WANT"
  | "ENERGY"
  | "CONTEXT";

export type ExperienceType =
  | "ENGAGED"
  | "ACHIEVEMENT"
  | "CHALLENGE"
  | "DRAINING_SUCCESS"
  | "TEAM_CONFLICT"
  | "OTHER";

export type QuestionTarget =
  | HypothesisCategory
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
    focusAreas: HypothesisCategory[];
    coveredExperienceTypes: ExperienceType[];
    missingAreas: HypothesisCategory[];
  };
  messages: ConversationMessage[];
  activeExperienceDraft?: Record<string, unknown>;
};

export type EvidenceCandidate = {
  category: HypothesisCategory;
  statement: string;
  supportType: EvidenceSupportType;
  messageId: string;
  quote: string;
  interpretation: string;
};

export type ChatTurnOutput = {
  reply: string;
  evidenceCandidates: EvidenceCandidate[];
  missingAreas: HypothesisCategory[];
  nextQuestionTarget: QuestionTarget;
  experienceReady: boolean;
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

export type EvidenceItem = {
  id: string;
  experienceId: string;
  category: HypothesisCategory;
  statement: string;
  supportType: EvidenceSupportType;
  quote: string;
  interpretation: string;
};

export type CareerHypothesisReference = {
  id: string;
  category: HypothesisCategory;
  statement: string;
  userAssessment:
    | "UNREVIEWED"
    | "MATCHES"
    | "PARTIALLY_MATCHES"
    | "DOES_NOT_MATCH"
    | "NEEDS_EXPLORATION";
};

export type HypothesesInput = {
  confirmedExperiences: ConfirmedExperience[];
  evidenceItems: EvidenceItem[];
  previousHypotheses: CareerHypothesisReference[];
};

export type HypothesesOutput = {
  hypotheses: Array<{
    category: HypothesisCategory;
    statement: string;
    supportingEvidenceIds: string[];
    counterEvidenceIds: string[];
    enablingConditions: string[];
    riskConditions: string[];
  }>;
  missingAreas: HypothesisCategory[];
  contradictionsToExplore: string[];
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
  allowedExperiences: Array<{
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
  confirmedHypothesesForVoice: CareerHypothesisReference[];
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
  repairAttempts: number;
};
