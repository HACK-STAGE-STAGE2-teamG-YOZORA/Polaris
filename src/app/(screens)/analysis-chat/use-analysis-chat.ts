import { useCallback, useEffect, useState } from "react";

import {
  confirmExperience,
  createAnalysisSession,
  createExperienceDraft,
  finalizeAnalysisSession,
  generateAxisAssessments,
  getCurrentAnalysisSession,
  listAnalysisMessages,
  listAxisAssessments,
  recomputeOverallSelfAnalysis,
  reviewAxisAssessment,
  sendAnalysisMessage,
} from "@/lib/api/analysis-sessions";
import { ApiError } from "@/lib/api/errors";
import type {
  AnalysisSession,
  ChatMessage,
  CompletionIntent,
  EvidenceCandidate,
  SelfAnalysisAxis,
} from "@/types/analysis-session";

// 画面表示用に整形したエラー情報。retryableはバナーの文言分岐、
// fieldErrorsは422のdetails[].fieldをフォームの該当項目へ紐付けるために使う
export interface ChatFormError {
  message: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
}

// この画面が持つ状態を1つにまとめたもの。UIコンポーネントは持たず、
// このフックだけがAPI呼び出しと状態更新の責務を持つ（ロジックとUIの分離）
interface UseAnalysisChatState {
  // GET /analysis-sessions/current の確認中かどうか（チャット開始選択の最初の分岐に使う）
  checkingCurrent: boolean;
  // GET /analysis-sessions/current で見つかった進行中セッション（続きから/初めからの選択材料）
  currentSession: AnalysisSession | null;
  // 「初めから」を選んだ、または進行中セッションが元々ない場合にtrue。
  // trueのあいだはSessionStartFormを表示する
  showNewSessionForm: boolean;
  // 実際にチャットが進行しているセッション（続きから、または新規作成後にセットされる）
  session: AnalysisSession | null;
  messages: ChatMessage[];
  evidenceCandidates: EvidenceCandidate[];
  experienceReady: boolean;
  missingAxes: SelfAnalysisAxis[];
  completionIntent: CompletionIntent;
  startingSession: boolean;
  loadingMessages: boolean;
  sending: boolean;
  generatingResult: boolean;
  assessments: any[];
  loadingAssessments: boolean;
  finalizingSession: boolean;
  error: ChatFormError | null;
}

const initialState: UseAnalysisChatState = {
  checkingCurrent: true,
  currentSession: null,
  showNewSessionForm: false,
  session: null,
  messages: [],
  evidenceCandidates: [],
  experienceReady: false,
  missingAxes: [],
  completionIntent: "NONE",
  startingSession: false,
  loadingMessages: false,
  sending: false,
  generatingResult: false,
  assessments: [],
  loadingAssessments: false,
  finalizingSession: false,
  error: null,
};

// ErrorDetail[] を { フィールド名: 理由 } のマップへ変換する。
// field/reasonが両方揃っているものだけを採用する
function toFieldErrors(details: { field?: string; reason?: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const detail of details) {
    if (detail.field && detail.reason) {
      fieldErrors[detail.field] = detail.reason;
    }
  }
  return fieldErrors;
}

// APIエラーをコード別に日本語メッセージへ変換する（docs/screen-api-map.md「5. 主要ローディング・失敗UI」に対応）
function toFormError(err: unknown): ChatFormError {
  if (!(err instanceof ApiError)) {
    // fetch自体が失敗した場合などApiErrorに正規化できなかったケース
    return {
      message: "通信に失敗しました。ネットワーク状況を確認してください。",
      retryable: true,
      fieldErrors: {},
    };
  }

  const fieldErrors = toFieldErrors(err.response.details);

  switch (err.response.code) {
    case "AI_UNAVAILABLE":
      // 503: LM Studio未起動・モデル未ロード
      return {
        message:
          "LM Studioが起動していません。Local Serverとモデルの読み込み状態を確認してください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_TIMEOUT":
      // 504: 入力内容は破棄しない（呼び出し元で入力欄をクリアしない）。自動リトライはしない
      return {
        message:
          "AIの応答が時間内に返りませんでした。入力内容はそのまま残っています。もう一度送信してください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_INVALID_OUTPUT":
      // 502(新規追加): AI出力が契約スキーマ/ドメイン規則に適合せず採用できなかった。
      // 出力は保存されないため、AI_TIMEOUTと同様に入力内容を保持したまま再試行させる
      return {
        message:
          "AIの出力を正しく解釈できませんでした。入力内容はそのまま残っています。もう一度送信してください。",
        retryable: true,
        fieldErrors,
      };
    case "CONFLICT":
      // 409: 既存の進行中セッションや状態不一致（例: START_NEW送信時に既に進行中セッションがある）
      return {
        message:
          err.response.message || "現在の状態では処理できません。画面を再読み込みしてください。",
        retryable: false,
        fieldErrors,
      };
    case "VALIDATION_ERROR":
      // 422: fieldErrorsを各フォーム項目に表示するのでバナー文言はサーバーのmessage優先
      return {
        message: err.response.message || "入力内容を確認してください。",
        retryable: false,
        fieldErrors,
      };
    default:
      return {
        message: err.response.message || "処理に失敗しました。",
        retryable: err.response.retryable,
        fieldErrors,
      };
  }
}

export function useAnalysisChat() {
  const [state, setState] = useState<UseAnalysisChatState>(initialState);

  // 画面表示時に一度だけ進行中セッションの有無を確認する。
  // これが「チャット開始選択」の起点になる（あればStartModeChoice、なければSessionStartFormを出す）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { session } = await getCurrentAnalysisSession();
        if (!cancelled) {
          setState((prev) => ({ ...prev, currentSession: session, checkingCurrent: false }));
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, checkingCurrent: false, error: toFormError(err) }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 「続きから」: 新規にPOSTはせず、/current で取得済みのセッションをそのまま使って会話履歴を読み込む
  const resumeCurrentSession = useCallback(async () => {
    const target = state.currentSession;
    if (!target) return;
    setState((prev) => ({ ...prev, session: target, loadingMessages: true, error: null }));
    try {
      const page = await listAnalysisMessages(target.id);
      setState((prev) => ({ ...prev, messages: page.items, loadingMessages: false }));
    } catch (err) {
      setState((prev) => ({ ...prev, loadingMessages: false, error: toFormError(err) }));
    }
  }, [state.currentSession]);

  // 「初めから」の選択。ここではまだAPIを呼ばず、新規セッション作成フォームを表示するだけにする
  const chooseStartNew = useCallback(() => {
    setState((prev) => ({ ...prev, showNewSessionForm: true }));
  }, []);

  // セッション開始（SessionStartForm送信時に呼ばれる）。
  // startModeは呼び出し元に選ばせず、進行中セッションの有無から自動で決める:
  //   進行中セッションなし         → START_NEW
  //   進行中セッションあり(初めから) → RESTART_ACTIVE（旧セッションはABANDONEDになる）
  const startSession = useCallback(
    async (title: string, targetAxes: SelfAnalysisAxis[]): Promise<boolean> => {
      setState((prev) => ({ ...prev, startingSession: true, error: null }));
      try {
        const session = await createAnalysisSession({
          startMode: state.currentSession ? "RESTART_ACTIVE" : "START_NEW",
          // 空文字ならタイトル未指定としてサーバー側のデフォルト（「自己分析」）に任せる
          title: title.trim() === "" ? undefined : title,
          // 未選択（0件）ならtargetAxesも省略し、サーバー側デフォルトの4軸全部に任せる
          targetAxes: targetAxes.length > 0 ? targetAxes : undefined,
        });
        setState((prev) => ({ ...prev, session, startingSession: false, loadingMessages: true }));

        const page = await listAnalysisMessages(session.id);
        setState((prev) => ({ ...prev, messages: page.items, loadingMessages: false }));
        return true;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          startingSession: false,
          loadingMessages: false,
          error: toFormError(err),
        }));
        return false;
      }
    },
    [state.currentSession],
  );

  // メッセージ送信。clientMessageIdは呼び出し側（page.tsx）で毎回新規発行してもらい、
  // ここではそのまま送信するだけにする（二重送信防止のIDはUI操作のタイミングに依存するため）
  const sendMessage = useCallback(
    async (content: string, clientMessageId: string): Promise<boolean> => {
      const session = state.session;
      if (!session) return false;

      setState((prev) => ({ ...prev, sending: true, error: null }));
      try {
        const turn = await sendAnalysisMessage(session.id, { content, clientMessageId });
        setState((prev) => {
          if (!prev.session) return prev;
          // docs/openapi.yaml AnalysisProgress.canGenerateResult の定義
          // 「USERメッセージが1件以上ならtrue」は決定的ルールなので、
          // セッション全体を再取得しなくてもここでローカルに先取り更新できる
          const nextUserMessageCount = prev.session.progress.userMessageCount + 1;
          return {
            ...prev,
            sending: false,
            // userMessageとassistantMessageを1往復分まとめて末尾に追加する
            messages: [...prev.messages, turn.userMessage, turn.assistantMessage],
            evidenceCandidates: turn.evidenceCandidates,
            experienceReady: turn.experienceReady,
            missingAxes: turn.missingAxes,
            // SUGGESTEDでもここではセッション状態を変更しない。画面側で案内を出すだけ
            completionIntent: turn.completionIntent,
            session: {
              ...prev.session,
              progress: {
                ...prev.session.progress,
                userMessageCount: nextUserMessageCount,
                canGenerateResult: nextUserMessageCount > 0,
              },
            },
          };
        });
        return true;
      } catch (err) {
        // 失敗時は入力内容(content)をここでは破棄しない。
        // 呼び出し側がfalseを見て入力欄のクリアを取りやめる
        setState((prev) => ({ ...prev, sending: false, error: toFormError(err) }));
        return false;
      }
    },
    [state.session],
  );

  // 軸分析一覧を取得する
  const fetchAssessments = useCallback(async (sessionId: string) => {
    setState((prev) => ({ ...prev, loadingAssessments: true }));
    try {
      const res = await listAxisAssessments(sessionId);
      setState((prev) => ({ ...prev, assessments: res.items, loadingAssessments: false }));
    } catch {
      setState((prev) => ({ ...prev, loadingAssessments: false }));
    }
  }, []);

  // 「この内容で結果を見る」を押した際の結果生成
  const generateResult = useCallback(async (): Promise<boolean> => {
    const session = state.session;
    if (!session) return false;

    setState((prev) => ({ ...prev, generatingResult: true, error: null }));
    try {
      // 確認済み体験カードが0件の場合、これまでの会話メッセージから体験カード案を作成して確定(CONFIRMED)にする
      if (session.progress.confirmedExperienceCount === 0 && state.messages.length > 0) {
        const userMsgIds = state.messages.filter((m) => m.role === "USER").map((m) => m.id);
        if (userMsgIds.length > 0) {
          try {
            // 体験カード案を作成
            const draft = await createExperienceDraft(session.id, "ENGAGED", userMsgIds);
            // 本人確認済み(CONFIRMED)にする
            if (draft?.id) {
              await confirmExperience(draft.id);
            }
          } catch (e) {
            // 体験カード自動抽出で例外が発生しても軸分析処理は続行
            console.warn("Auto experience extraction warning:", e);
          }
        }
      }

      const res = await generateAxisAssessments(session.id);
      setState((prev) => {
        if (!prev.session) return prev;
        return {
          ...prev,
          generatingResult: false,
          assessments: res.items ?? [],
          session: {
            ...prev.session,
            status: "READY_TO_FINALIZE",
            progress: {
              ...prev.session.progress,
              confirmedExperienceCount: Math.max(1, prev.session.progress.confirmedExperienceCount),
            },
          },
        };
      });
      // 生成された軸評価一覧を取得
      void fetchAssessments(session.id);
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, generatingResult: false, error: toFormError(err) }));
      return false;
    }
  }, [state.session, state.messages, fetchAssessments]);

  // セッションを復元・初期読み込みした際にすでにREADY_TO_FINALIZEなら軸データ取得
  useEffect(() => {
    if (state.session?.id && (state.session.status === "READY_TO_FINALIZE" || state.session.status === "COMPLETED")) {
      void fetchAssessments(state.session.id);
    }
  }, [state.session?.id, state.session?.status, fetchAssessments]);

  // 各軸に対するユーザーのレビュー（MATCHES等）
  const reviewAssessment = useCallback(
    async (
      id: string,
      assessment: "MATCHES" | "PARTIALLY_MATCHES" | "DOES_NOT_MATCH" | "NEEDS_EXPLORATION",
    ) => {
      try {
        await reviewAxisAssessment(id, assessment);
        if (state.session?.id) {
          void fetchAssessments(state.session.id);
        }
      } catch (err) {
        setState((prev) => ({ ...prev, error: toFormError(err) }));
      }
    },
    [state.session?.id, fetchAssessments],
  );

  // セッションを確定し、総合結果を計算してホームへ移動できるようにする
  const finalizeSession = useCallback(async (): Promise<boolean> => {
    const session = state.session;
    if (!session) return false;

    setState((prev) => ({ ...prev, finalizingSession: true, error: null }));
    try {
      // 軸のレビューが未実施の項目があれば、自動的に全軸 MATCHES で一括レビュー
      if (state.assessments && state.assessments.length > 0) {
        for (const item of state.assessments) {
          if (item.userAssessment === "UNREVIEWED") {
            await reviewAxisAssessment(item.id, "MATCHES");
          }
        }
      }

      await finalizeAnalysisSession(session.id);
      // ホーム画面の表示用の総合自己分析を再計算
      await recomputeOverallSelfAnalysis().catch(() => null);

      setState((prev) => ({
        ...prev,
        finalizingSession: false,
        session: prev.session ? { ...prev.session, status: "COMPLETED" } : null,
      }));
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, finalizingSession: false, error: toFormError(err) }));
      return false;
    }
  }, [state.session, state.assessments]);

  return {
    ...state,
    resumeCurrentSession,
    chooseStartNew,
    startSession,
    sendMessage,
    generateResult,
    fetchAssessments,
    reviewAssessment,
    finalizeSession,
  };
}
