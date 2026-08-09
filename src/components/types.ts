export type AnalysisSession = {
  id: string;
  title: string;
  status: 'ACTIVE' | 'READY_TO_FINALIZE' | 'COMPLETED' | 'ABANDONED';
  progress: {
    userMessageCount: number;
    confirmedExperienceCount: number;
    missingAxes: string[];
    canGenerateResult: boolean;
  };
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  questionTarget: string | null;
  createdAt: string;
};

export type Experience = {
  id: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  type: string;
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
  energyChange: number;
  environment: string[];
  evidenceQuotes: Array<{ messageId: string; quote: string }>;
  status: 'DRAFT' | 'CONFIRMED';
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AxisAssessment = {
  id: string;
  sourceSessionId: string;
  axis: string;
  position: string;
  displayStatement: string;
  status: string;
  userAssessment: string;
  userNote: string | null;
  isStale: boolean;
  leftEvidence: Array<{ id: string; quote: string; statement: string }>;
  rightEvidence: Array<{ id: string; quote: string; statement: string }>;
  bothEvidence: Array<{ id: string; quote: string; statement: string }>;
  contextEvidence: Array<{ id: string; quote: string; statement: string }>;
  counterEvidence: Array<{ id: string; quote: string; statement: string }>;
};

export type EsDocument = {
  id: string;
  companyId: string | null;
  targetRole: string | null;
  question: string;
  characterLimit: number;
  originalText: string;
  characterCount: number;
  preferredExperienceIds: string[];
  emphasis: string[];
  status: string;
  analyses: EsAnalysis[];
  revisions: EsRevision[];
  createdAt: string;
  updatedAt: string;
};

export type EsAnalysis = {
  id: string;
  esDocumentId: string;
  revisionId: string | null;
  sourceKind: 'ORIGINAL' | 'REVISION';
  freshness: string;
  characterCount: number;
  withinCharacterLimit: boolean;
  questionCoverage: string;
  submissionReadiness: string;
  claims: Array<{ id: string; sentence: string; text: string; type: string; status: string; explanation: string | null }>;
  issues: Array<{ code: string; severity: string; message: string; sentence: string | null }>;
  comments: Array<{ category: string; message: string; severity: string }>;
};

export type EsRevision = {
  id: string;
  esDocumentId: string;
  basedOnAnalysisId: string;
  freshness: string;
  revisedText: string;
  characterCount: number;
  usedExperienceIds: string[];
  usedSessionReportIds: string[];
  changes: Array<{ id: string; before: string; after: string; reason: string; decision: string }>;
  unsupportedClaims: EsAnalysis['claims'];
  verificationAnalysisId: string | null;
};

export type Dashboard = {
  activeSession: AnalysisSession | null;
  overallProfile: null | {
    summary: string;
    axes: Array<{ axis: string; position: string; statement: string; evidenceCount?: number }>;
    strengths: Array<{ title: string; description: string }>;
    weaknesses: Array<{ title: string; description: string }>;
    dataSummary: {
      completedSessionCount: number;
      userMessageCount: number;
      confirmedExperienceCount: number;
      isDataSparse: boolean;
      warningReasons: string[];
    };
    freshness: string;
  };
  recentEsDocuments: Array<{
    id: string;
    question: string;
    characterLimit: number;
    characterCount: number;
    status: string;
    updatedAt: string;
  }>;
};
