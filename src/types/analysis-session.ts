// docs/openapi.yaml の /api/v1/analysis-sessions 系スキーマに対応する型定義（re-swagger版）。
// バックエンドの Route Handler が未実装のため、この型が現時点でのAPI契約を表す。

// 自己分析の4軸。ENERGY_SOURCE=Focus↔Connect、ACTION_STYLE=Plan↔Experiment、
// SATISFACTION_SOURCE=Mastery↔Impact、PREFERRED_ENVIRONMENT=Stable↔Dynamic
// (旧CAN/WANT/ENERGY/CONTEXTから改名された)
export type SelfAnalysisAxis =
  | "ENERGY_SOURCE"
  | "ACTION_STYLE"
  | "SATISFACTION_SOURCE"
  | "PREFERRED_ENVIRONMENT";

// ABANDONEDは「初めから」で中断されたセッション。通常の再開候補（続きから）には出さない
export type AnalysisSessionStatus = "ACTIVE" | "READY_TO_FINALIZE" | "COMPLETED" | "ABANDONED";

export type ExperienceType =
  | "ENGAGED"
  | "ACHIEVEMENT"
  | "CHALLENGE"
  | "DRAINING_SUCCESS"
  | "TEAM_CONFLICT"
  | "OTHER";

// 「経験カード3件必須(minimumExperienceCount)」の制約は廃止された。
// canGenerateResultは「対象セッションのUSERメッセージが1件以上ならtrue」という
// 決定的ルールで決まり、確認済み経験数は条件にしない
export interface AnalysisProgress {
  userMessageCount: number;
  confirmedExperienceCount: number;
  canGenerateResult: boolean;
  coveredExperienceTypes: ExperienceType[];
  missingAxes: SelfAnalysisAxis[];
}

export interface AnalysisSession {
  id: string;
  title: string;
  status: AnalysisSessionStatus;
  // 旧focusAreasから改名。このセッションで扱う4軸のうちの対象
  targetAxes: SelfAnalysisAxis[];
  progress: AnalysisProgress;
  // 日時はUTC ISO 8601で返る。表示時だけ formatLocalDateTime でローカル時刻へ変換する
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// GET /analysis-sessions のレスポンス（今回のスコープでは未使用）
export interface AnalysisSessionPage {
  items: AnalysisSession[];
  nextCursor?: string;
}

// GET /analysis-sessions/current のレスポンス。
// 「チャット開始選択」画面が進行中セッションの有無を確認するために使う。
// 進行中セッションがなければ session=null
export interface CurrentAnalysisSessionResponse {
  session: AnalysisSession | null;
}

// START_NEW: 進行中セッションがある場合は409。
// RESTART_ACTIVE: 進行中セッションをABANDONEDにしてから新規セッションを作る
export type StartMode = "START_NEW" | "RESTART_ACTIVE";

// POST /analysis-sessions のリクエストボディ。startModeは必須（新規追加）。
// title/targetAxesは省略可能（サーバー側でデフォルト適用）
export interface CreateAnalysisSessionRequest {
  startMode: StartMode;
  title?: string;
  targetAxes?: SelfAnalysisAxis[];
}

export type MessageRole = "USER" | "ASSISTANT";

// 4軸名がQuestionTargetにも反映されている
export type QuestionTarget =
  | "ENERGY_SOURCE"
  | "ACTION_STYLE"
  | "SATISFACTION_SOURCE"
  | "PREFERRED_ENVIRONMENT"
  | "EXPERIENCE_DETAIL"
  | "CONTRADICTION"
  | "CONFIRMATION";

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  questionTarget?: QuestionTarget;
  createdAt: string;
}

// GET /analysis-sessions/{sessionId}/messages のレスポンス
export interface MessagePage {
  items: ChatMessage[];
  nextCursor?: string;
}

// POST /analysis-sessions/{sessionId}/messages のリクエストボディ。
// clientMessageId は二重送信防止用の冪等キー（同じIDの再送は同じ保存済み結果を返す）
export interface SendMessageRequest {
  content: string;
  clientMessageId?: string;
}

export type EvidenceSupportType = "SUPPORT" | "COUNTER" | "UNKNOWN";

// 根拠がその軸のどちら寄りかを示す。BOTHは両極、CONTEXT_DEPENDENTは状況依存、UNKNOWNは不明
export type AxisPole = "LEFT" | "RIGHT" | "BOTH" | "CONTEXT_DEPENDENT" | "UNKNOWN";

// AIが会話から抽出した根拠候補。ユーザー確認前の未確定情報。
// 旧categoryはaxis+pole（軸名＋その軸内でのどちら寄りか）に分割された
export interface EvidenceCandidate {
  axis: SelfAnalysisAxis;
  pole: AxisPole;
  statement: string;
  supportType: EvidenceSupportType;
  quote: string;
  messageId: string;
  interpretation: string;
}

// SUGGESTEDはAIが終了候補と判断したことを示すだけで、セッション状態は自動で変わらない。
// 本人確認後に別画面（終了確認、今回のスコープ外）からfinalizeを呼ぶ
export type CompletionIntent = "NONE" | "SUGGESTED";

// POST /analysis-sessions/{sessionId}/messages のレスポンス（1往復分の会話）
export interface ChatTurnResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  evidenceCandidates: EvidenceCandidate[];
  experienceReady: boolean;
  // 旧missingAreasから改名
  missingAxes: SelfAnalysisAxis[];
  completionIntent: CompletionIntent;
}
