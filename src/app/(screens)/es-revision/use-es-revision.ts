import { useCallback, useState } from "react";

import {
  analyzeEsDocument,
  createEsDocument,
  reviseEsDocument,
  verifyEsRevision,
} from "@/lib/api/es-documents";
import { ApiError } from "@/lib/api/errors";
import type {
  CreateEsDocumentRequest,
  EsAiCommentCategory,
  EsAnalysis,
  EsDocument,
  EsIssueSeverity,
  EsRevision,
  SubmissionReadiness,
} from "@/types/es-document";

export type { SubmissionReadiness } from "@/types/es-document";

// 画面表示用に整形したエラー情報。retryableはバナーの文言分岐、
// fieldErrorsは422のdetails[].fieldをフォームの該当項目へ紐付けるために使う
export interface EsFormError {
  message: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
}

// 3画面の現在位置。ES入力 → 添削結果 → AIコメント の一方向の遷移だけを持つ
export type EsRevisionStep = "INPUT" | "RESULT" | "COMMENTS";

// ES作成→原文分析→推敲→再検査の4段階。ローディング表示の出し分けに使う
export type EsRevisionProgressStage =
  | "CREATING_DOCUMENT"
  | "ANALYZING_ORIGINAL"
  | "REVISING"
  | "VERIFYING";

const PROGRESS_LABEL: Record<EsRevisionProgressStage, string> = {
  CREATING_DOCUMENT: "ES原文を保存しています…",
  ANALYZING_ORIGINAL: "原文を検査しています…",
  REVISING: "推敲しています…",
  VERIFYING: "推敲結果を再検査しています…",
};

export type EsCommentCategory = EsAiCommentCategory;
export type EsCommentSeverity = EsIssueSeverity;

export interface EsComment {
  id: string;
  category: EsCommentCategory;
  severity: EsCommentSeverity;
  message: string;
}

interface UseEsRevisionState {
  step: EsRevisionStep;
  esDocument: EsDocument | null;
  esRevision: EsRevision | null;
  verifyAnalysis: EsAnalysis | null;
  // 4段階(作成→原文分析→推敲→再検査)のうち現在実行中のもの。何も実行中でなければnull
  progressStage: EsRevisionProgressStage | null;
  error: EsFormError | null;
}

const initialState: UseEsRevisionState = {
  step: "INPUT",
  esDocument: null,
  esRevision: null,
  verifyAnalysis: null,
  progressStage: null,
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

// APIエラーをコード別に日本語メッセージへ変換する
function toFormError(err: unknown): EsFormError {
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
    case "VALIDATION_ERROR":
      // 422: fieldErrorsを各フォーム項目に表示するのでバナー文言はサーバーのmessage優先
      return {
        message: err.response.message || "入力内容を確認してください。",
        retryable: false,
        fieldErrors,
      };
    case "CONFLICT":
      // 409: 検査・添削の順序不整合など
      return {
        message: "先に検査・添削を完了させてください。",
        retryable: false,
        fieldErrors,
      };
    case "AI_INVALID_OUTPUT":
      // 502: AI出力が契約スキーマ/ドメイン規則に適合せず採用できなかった
      return {
        message: "AIの出力形式に問題がありました。もう一度お試しください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_UNAVAILABLE":
      // 503: LM Studio未起動・モデル未ロード
      return {
        message: "LM Studioが起動していません。Local Serverとモデルの読み込み状態を確認してください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_TIMEOUT":
      // 504: 入力内容は破棄しない。自動リトライはしない
      return {
        message:
          "AIの応答が時間内に返りませんでした。入力内容はそのまま残っています。もう一度お試しください。",
        retryable: true,
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

// APIレスポンスのcomments(根拠状態・指摘・改善理由)を画面表示用に整形する。
// EsAiCommentにはidがないため表示用に連番で採番する
function toEsComments(analysis: EsAnalysis | null): EsComment[] {
  if (!analysis) return [];
  return analysis.comments.map((comment, index) => ({
    id: `comment-${index}`,
    category: comment.category,
    severity: comment.severity,
    message: comment.message,
  }));
}

export function useEsRevision() {
  const [state, setState] = useState<UseEsRevisionState>(initialState);

  // 「添削する」: ES文書作成 → 原文分析 → 推敲案の作成、の3段階をまとめて実行する
  const startRevision = useCallback(
    async (request: CreateEsDocumentRequest): Promise<boolean> => {
      setState((prev) => ({ ...prev, progressStage: "CREATING_DOCUMENT", error: null }));
      try {
        const esDocument = await createEsDocument(request);
        setState((prev) => ({ ...prev, esDocument, progressStage: "ANALYZING_ORIGINAL" }));

        await analyzeEsDocument(esDocument.id);
        setState((prev) => ({ ...prev, progressStage: "REVISING" }));

        const esRevision = await reviseEsDocument(esDocument.id);
        setState((prev) => ({
          ...prev,
          progressStage: null,
          esRevision,
          step: "RESULT",
        }));
        return true;
      } catch (err) {
        setState((prev) => ({ ...prev, progressStage: null, error: toFormError(err) }));
        return false;
      }
    },
    [],
  );

  // 「コメントをもらう」: 推敲後の文章を再検査する(4段階目)
  const requestComments = useCallback(async (): Promise<boolean> => {
    const revision = state.esRevision;
    if (!revision) return false;

    setState((prev) => ({ ...prev, progressStage: "VERIFYING", error: null }));
    try {
      const verifyAnalysis = await verifyEsRevision(revision.id);
      setState((prev) => ({ ...prev, progressStage: null, verifyAnalysis, step: "COMMENTS" }));
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, progressStage: null, error: toFormError(err) }));
      return false;
    }
  }, [state.esRevision]);

  const submitting = state.progressStage !== null && state.progressStage !== "VERIFYING";
  const verifying = state.progressStage === "VERIFYING";
  const progressLabel = state.progressStage ? PROGRESS_LABEL[state.progressStage] : null;
  const comments = toEsComments(state.verifyAnalysis);
  // 提出可否はフロントで合成せず、APIレスポンスのsubmissionReadinessをそのまま使う
  const submissionReadiness: SubmissionReadiness | null =
    state.verifyAnalysis?.submissionReadiness ?? null;

  return {
    step: state.step,
    esDocument: state.esDocument,
    esRevision: state.esRevision,
    verifyAnalysis: state.verifyAnalysis,
    error: state.error,
    submitting,
    verifying,
    progressLabel,
    comments,
    submissionReadiness,
    startRevision,
    requestComments,
  };
}
