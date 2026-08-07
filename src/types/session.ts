import type { SelfAnalysisAxis } from './dashboard';

export type MessageRole = 'USER' | 'ASSISTANT';
export type QuestionTarget =
  | SelfAnalysisAxis
  | 'EXPERIENCE_DETAIL'
  | 'CONTRADICTION'
  | 'CONFIRMATION';

export interface CreateAnalysisSessionRequest {
  startMode: 'START_NEW' | 'RESTART_ACTIVE';
  title?: string;
  targetAxes?: SelfAnalysisAxis[];
}

export interface SendMessageRequest {
  content: string;
  clientMessageId?: string;
}

export interface ChatMessageResponse {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  questionTarget: QuestionTarget | null;
  createdAt: string;
}

export interface ChatTurnResponse {
  userMessage: ChatMessageResponse;
  assistantMessage: ChatMessageResponse;
  evidenceCandidates: unknown[];
  experienceReady: boolean;
  missingAxes: SelfAnalysisAxis[];
  completionIntent: 'NONE' | 'SUGGESTED';
}
