import { useCallback, useEffect, useState } from "react";

import {
  createAnalysisSession,
  createExperienceDraft,
  finalizeAnalysisSession,
  generateAxisAssessments,
  getCurrentAnalysisSession,
  listAnalysisMessages,
  recomputeOverallSelfAnalysis,
  sendAnalysisMessage,
} from "@/lib/api/analysis-sessions";
import { listAxisAssessments, reviewAxisAssessment } from "@/lib/api/axis-assessments";
import { ApiError } from "@/lib/api/errors";
import { updateExperience } from "@/lib/api/experiences";
import type {
  AnalysisSession,
  ChatMessage,
  CompletionIntent,
  EvidenceCandidate,
  SelfAnalysisAxis,
} from "@/types/analysis-session";
import type { AxisAssessment, UserAssessment } from "@/types/axis-assessment";
import type { ErrorCode } from "@/types/error";
import type {
  ExperienceResponse,
  ExperienceType,
  UpdateExperienceRequest,
} from "@/types/experience";

// 画面表示用に整形したエラー情報。retryableはバナーの文言分岐、
// fieldErrorsは422のdetails[].fieldをフォームの該当項目へ紐付けるために使う。
// codeはAI_UNAVAILABLE時に起動確認画面への導線を出すなど、コード別の追加案内に使う
export interface ChatFormError {
  code: ErrorCode;
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
  assessments: AxisAssessment[];
  loadingAssessments: boolean;
  // PATCH /axis-assessments/{id} 実行中の軸ID。連打とボタンの二重操作を防ぐ
  reviewingAxisId: string | null;
  finalizingSession: boolean;
  // 確認待ちの経験カード案。nullなら確認フォームを表示しない
  draftExperience: ExperienceResponse | null;
  creatingDraft: boolean;
  savingDraft: boolean;
  // 経験カードの保存結果を伝える短い文言（「確認済みにしました」など）
  draftNotice: string | null;
  // finalize自体は成功したが総合プロフィールの再集計に失敗した場合に立てる。
  // docs/implementation-rules.md のとおりレポートは戻さず、ホームから再集計させる
  recomputeFailed: boolean;
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
  reviewingAxisId: null,
  finalizingSession: false,
  draftExperience: null,
  creatingDraft: false,
  savingDraft: false,
  draftNotice: null,
  recomputeFailed: false,
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
      code: "INTERNAL_ERROR",
      message: "通信に失敗しました。ネットワーク状況を確認してください。",
      retryable: true,
      fieldErrors: {},
    };
  }

  const code = err.response.code;
  const fieldErrors = toFieldErrors(err.response.details);

  switch (code) {
    case "AI_UNAVAILABLE":
      // 503: LM Studio未起動・モデル未ロード
      return {
        code,
        message:
          "LM Studioが起動していません。Local Serverとモデルの読み込み状態を確認してください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_TIMEOUT":
      // 504: 入力内容は破棄しない（呼び出し元で入力欄をクリアしない）。自動リトライはしない
      return {
        code,
        message:
          "AIの応答が時間内に返りませんでした。入力内容はそのまま残っています。もう一度送信してください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_INVALID_OUTPUT":
      // 502(新規追加): AI出力が契約スキーマ/ドメイン規則に適合せず採用できなかった。
      // 出力は保存されないため、AI_TIMEOUTと同様に入力内容を保持したまま再試行させる
      return {
        code,
        message:
          "AIの出力を正しく解釈できませんでした。入力内容はそのまま残っています。もう一度送信してください。",
        retryable: true,
        fieldErrors,
      };
    case "CONFLICT":
      // 409: 既存の進行中セッションや状態不一致（例: 未評価の軸が残ったままのfinalize）
      return {
        code,
        message:
          err.response.message || "現在の状態では処理できません。画面を再読み込みしてください。",
        retryable: false,
        fieldErrors,
      };
    case "VALIDATION_ERROR":
      // 422: fieldErrorsを各フォーム項目に表示するのでバナー文言はサーバーのmessage優先
      return {
        code,
        message: err.response.message || "入力内容を確認してください。",
        retryable: false,
        fieldErrors,
      };
    default:
      return {
        code,
        message: err.response.message || "処理に失敗しました。",
        retryable: err.response.retryable,
        fieldErrors,
      };
  }
}

// ホームの「続きから」「初めから」から遷移してきた場合に、開始選択を省略して
// そのモードで始めるための指定（docs/screen-api-map.md「2. ホーム表示状態」）
export type InitialStartMode = "resume" | "new";

export function useAnalysisChat(initialStartMode?: InitialStartMode) {
  const [state, setState] = useState<UseAnalysisChatState>(initialState);

  // 画面表示時に一度だけ進行中セッションの有無を確認する。
  // これが「チャット開始選択」の起点になる（あればStartModeChoice、なければSessionStartFormを出す）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { session } = await getCurrentAnalysisSession();
        if (cancelled) return;

        // 「初めから」で来た場合は選択画面を飛ばして新規作成フォームを出す。
        // 進行中セッションのABANDONED化はフォーム送信時なので、ここでは破棄しない
        if (initialStartMode === "new") {
          setState((prev) => ({
            ...prev,
            currentSession: session,
            checkingCurrent: false,
            showNewSessionForm: true,
          }));
          return;
        }

        // 「続きから」で来た場合は、そのまま会話履歴の読み込みまで進める
        if (initialStartMode === "resume" && session) {
          setState((prev) => ({
            ...prev,
            currentSession: session,
            checkingCurrent: false,
            session,
            loadingMessages: true,
          }));
          const page = await listAnalysisMessages(session.id);
          if (!cancelled) {
            setState((prev) => ({ ...prev, messages: page.items, loadingMessages: false }));
          }
          return;
        }

        setState((prev) => ({ ...prev, currentSession: session, checkingCurrent: false }));
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            checkingCurrent: false,
            loadingMessages: false,
            error: toFormError(err),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStartMode]);

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

  // 経験カード案を作る。AIの抽出結果は必ずDRAFTで返るため、
  // ここでは確定させず確認フォーム（ExperienceCardForm）へ渡す
  const createDraft = useCallback(
    async (experienceType: ExperienceType): Promise<boolean> => {
      const session = state.session;
      if (!session) return false;

      const userMessageIds = state.messages
        .filter((message) => message.role === "USER")
        .map((message) => message.id);
      if (userMessageIds.length === 0) return false;

      setState((prev) => ({ ...prev, creatingDraft: true, draftNotice: null, error: null }));
      try {
        const draft = await createExperienceDraft(session.id, experienceType, userMessageIds);
        setState((prev) => ({ ...prev, creatingDraft: false, draftExperience: draft }));
        return true;
      } catch (err) {
        setState((prev) => ({ ...prev, creatingDraft: false, error: toFormError(err) }));
        return false;
      }
    },
    [state.session, state.messages],
  );

  // 確認フォームからの保存。status=CONFIRMEDのときだけ正式根拠になるので、
  // 確認済みになった場合だけ進捗の確認済み経験数を増やす
  const saveDraft = useCallback(
    async (body: UpdateExperienceRequest): Promise<boolean> => {
      const draft = state.draftExperience;
      if (!draft) return false;

      setState((prev) => ({ ...prev, savingDraft: true, error: null }));
      try {
        const { experience } = await updateExperience(draft.id, body);
        const confirmed = experience.status === "CONFIRMED";
        setState((prev) => ({
          ...prev,
          savingDraft: false,
          draftExperience: confirmed ? null : experience,
          draftNotice: confirmed
            ? "経験カードを確認済みにしました。"
            : "下書きとして保存しました。経験一覧からいつでも確認できます。",
          session:
            confirmed && prev.session
              ? {
                  ...prev.session,
                  progress: {
                    ...prev.session.progress,
                    confirmedExperienceCount: prev.session.progress.confirmedExperienceCount + 1,
                  },
                }
              : prev.session,
        }));
        return true;
      } catch (err) {
        setState((prev) => ({ ...prev, savingDraft: false, error: toFormError(err) }));
        return false;
      }
    },
    [state.draftExperience],
  );

  // 確認フォームを閉じる。カード自体はDRAFTとして残るので経験一覧から再開できる
  const dismissDraft = useCallback(() => {
    setState((prev) => ({
      ...prev,
      draftExperience: null,
      draftNotice: "下書きのまま保留しました。経験一覧から続きを編集できます。",
    }));
  }, []);

  // 軸分析一覧を取得する
  const fetchAssessments = useCallback(async (sessionId: string) => {
    setState((prev) => ({ ...prev, loadingAssessments: true }));
    try {
      const { items } = await listAxisAssessments({ sessionId });
      setState((prev) => ({ ...prev, assessments: items, loadingAssessments: false }));
    } catch {
      setState((prev) => ({ ...prev, loadingAssessments: false }));
    }
  }, []);

  // 「この内容で結果を見る」を押した際の結果生成。
  // 確認済み経験が0件でもUSER回答1件以上あれば生成できる（根拠のない軸はINSUFFICIENT_EVIDENCEになる）
  const generateResult = useCallback(async (): Promise<boolean> => {
    const session = state.session;
    if (!session) return false;

    setState((prev) => ({ ...prev, generatingResult: true, error: null }));
    try {
      const { items } = await generateAxisAssessments(session.id);
      setState((prev) => {
        if (!prev.session) return prev;
        return {
          ...prev,
          generatingResult: false,
          assessments: items,
          session: { ...prev.session, status: "READY_TO_FINALIZE" },
        };
      });
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, generatingResult: false, error: toFormError(err) }));
      return false;
    }
  }, [state.session]);

  // セッションを復元・初期読み込みした際にすでに生成済みなら軸データを取得する
  useEffect(() => {
    if (
      state.session?.id &&
      (state.session.status === "READY_TO_FINALIZE" || state.session.status === "COMPLETED")
    ) {
      void fetchAssessments(state.session.id);
    }
  }, [state.session?.id, state.session?.status, fetchAssessments]);

  // 各軸への本人評価。本人が選んだ値だけを保存し、未評価のまま自動で埋めない
  // （docs/product-scope.md「未評価の軸をAIの確定所見として保存しない」）
  const reviewAssessment = useCallback(
    async (axisAssessmentId: string, assessment: UserAssessment): Promise<boolean> => {
      setState((prev) => ({ ...prev, reviewingAxisId: axisAssessmentId, error: null }));
      try {
        const updated = await reviewAxisAssessment(axisAssessmentId, { assessment });
        setState((prev) => ({
          ...prev,
          reviewingAxisId: null,
          assessments: prev.assessments.map((item) => (item.id === updated.id ? updated : item)),
        }));
        return true;
      } catch (err) {
        setState((prev) => ({ ...prev, reviewingAxisId: null, error: toFormError(err) }));
        return false;
      }
    },
    [],
  );

  // セッションを確定し、ホームの総合傾向へ反映する。
  // 4軸すべての本人評価が終わっていない場合、サーバーは409を返す
  const finalizeSession = useCallback(async (): Promise<boolean> => {
    const session = state.session;
    if (!session) return false;

    setState((prev) => ({ ...prev, finalizingSession: true, recomputeFailed: false, error: null }));
    try {
      await finalizeAnalysisSession(session.id);
      // 再計算はfinalizeとは別処理。失敗しても確定済みレポートは戻さず、
      // ホーム側に STALE として再集計ボタンを出させる
      const recomputed = await recomputeOverallSelfAnalysis().then(
        () => true,
        () => false,
      );

      setState((prev) => ({
        ...prev,
        finalizingSession: false,
        recomputeFailed: !recomputed,
        session: prev.session ? { ...prev.session, status: "COMPLETED" } : null,
      }));
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, finalizingSession: false, error: toFormError(err) }));
      return false;
    }
  }, [state.session]);

  // 本人評価がまだの軸。1つでも残っているあいだはfinalizeできない
  const unreviewedAxes = state.assessments.filter((item) => item.userAssessment === "UNREVIEWED");
  // 評価後に会話を続けた軸。再生成しないとfinalizeできない
  const hasStaleAssessment = state.assessments.some((item) => item.isStale);

  return {
    ...state,
    unreviewedAxes,
    hasStaleAssessment,
    canFinalize:
      state.assessments.length > 0 && unreviewedAxes.length === 0 && !hasStaleAssessment,
    resumeCurrentSession,
    chooseStartNew,
    startSession,
    sendMessage,
    createDraft,
    saveDraft,
    dismissDraft,
    generateResult,
    fetchAssessments,
    reviewAssessment,
    finalizeSession,
  };
}
