import type { AnalysisSessionStatus, SelfAnalysisAxis } from './dashboard';

export type MessageRole = 'USER' | 'ASSISTANT';

export type QuestionTarget =
  | 'ENERGY_SOURCE'
  | 'ACTION_STYLE'
  | 'SATISFACTION_SOURCE'
  | 'PREFERRED_ENVIRONMENT'
  | 'EXPERIENCE_DETAIL'
  | 'CONTRADICTION'
  | 'CONFIRMATION';

export interface CreateAnalysisSessionRequest {
  startMode?: 'START_NEW' | 'RESTART_ACTIVE';
  title?: string;
  targetAxes?: SelfAnalysisAxis[];
}

export interface SendMessageRequest {
  role?: MessageRole;
  content: string;
  clientMessageId?: string;
  questionTarget?: QuestionTarget;
  evidenceCandidates?: any;
}

export interface UpdateAnalysisSessionStatusRequest {
  status: AnalysisSessionStatus;
  title?: string;
  /** FAILED 遷移時にサーバーログへ記録するエラー理由（任意）。レスポンスには含まれない。 */
  failureReason?: string;
}

export interface ChatMessageResponse {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  questionTarget?: QuestionTarget | null;
  evidenceCandidates?: any;
  clientMessageId?: string | null;
  createdAt: string;
}
