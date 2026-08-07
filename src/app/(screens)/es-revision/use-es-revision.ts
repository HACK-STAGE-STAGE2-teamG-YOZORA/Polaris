import { useCallback, useState } from "react";

import { createEsDocument, reviseEsDocument, verifyEsRevision } from "@/lib/api/es-documents";
import { ApiError } from "@/lib/api/errors";
import type {
  ClaimStatus,
  CreateEsDocumentRequest,
  EsAnalysis,
  EsDocument,
  EsRevision,
} from "@/types/es-document";

// 画面表示用に整形したエラー情報。retryableはバナーの文言分岐、
// fieldErrorsは422のdetails[].fieldをフォームの該当項目へ紐付けるために使う
export interface EsFormError {
  message: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
}

// 3画面の現在位置。ES入力 → 添削結果 → AIコメント の一方向の遷移だけを持つ
export type EsRevisionStep = "INPUT" | "RESULT" | "COMMENTS";

// openapi.yamlのEsAnalysisにはcomments配列が存在しないため、
// claims(根拠状態)・issues(指摘)・changes(推敲理由)から画面表示用に合成する
export type EsCommentCategory = "EVIDENCE_STATUS" | "ISSUE" | "IMPROVEMENT_REASON";
export type EsCommentSeverity = "ERROR" | "WARNING" | "INFO";

export interface EsComment {
  id: string;
  category: EsCommentCategory;
  severity: EsCommentSeverity;
  message: string;
}

// 数値スコアではなく、設問回答状況・文字数・主張ごとの根拠状態から判定する提出準備状況
export type SubmissionReadiness = "READY_TO_SUBMIT" | "NEEDS_REVIEW";

interface UseEsRevisionState {
  step: EsRevisionStep;
  esDocument: EsDocument | null;
  esRevision: EsRevision | null;
  verifyAnalysis: EsAnalysis | null;
  // 「添削する」(ES文書作成 → 推敲を1操作にまとめて呼ぶ)の実行中フラグ
  submitting: boolean;
  // 「コメントをもらう」(再検査)の実行中フラグ
  verifying: boolean;
  error: EsFormError | null;
}

const initialState: UseEsRevisionState = {
  step: "INPUT",
  esDocument: null,
  esRevision: null,
  verifyAnalysis: null,
  submitting: false,
  verifying: false,
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

function claimSeverity(status: ClaimStatus): EsCommentSeverity {
  switch (status) {
    case "CONTRADICTED":
      return "ERROR";
    case "NEEDS_CONFIRMATION":
    case "PARTIALLY_VERIFIED":
      return "WARNING";
    case "VERIFIED":
      return "INFO";
  }
}

function claimStatusLabel(status: ClaimStatus): string {
  switch (status) {
    case "VERIFIED":
      return "根拠が確認できています";
    case "PARTIALLY_VERIFIED":
      return "根拠が一部のみ確認できています";
    case "NEEDS_CONFIRMATION":
      return "根拠の確認が必要です";
    case "CONTRADICTED":
      return "既存の情報と矛盾しています";
  }
}

// claims(根拠状態)・issues(指摘)・changes(推敲理由)から吹き出し表示用コメントを組み立てる
function buildComments(analysis: EsAnalysis | null, revision: EsRevision | null): EsComment[] {
  const comments: EsComment[] = [];

  if (analysis) {
    analysis.issues.forEach((issue, index) => {
      comments.push({
        id: `issue-${index}`,
        category: "ISSUE",
        severity: issue.severity,
        message: issue.message,
      });
    });

    analysis.claims.forEach((claim) => {
      const explanation = claim.explanation ? ` — ${claim.explanation}` : "";
      comments.push({
        id: `claim-${claim.id}`,
        category: "EVIDENCE_STATUS",
        severity: claimSeverity(claim.status),
        message: `「${claim.text}」: ${claimStatusLabel(claim.status)}${explanation}`,
      });
    });
  }

  if (revision) {
    revision.changes.forEach((change) => {
      comments.push({
        id: `change-${change.id}`,
        category: "IMPROVEMENT_REASON",
        severity: "INFO",
        message: change.reason,
      });
    });
  }

  return comments;
}

// スコアは使わず、設問回答状況・文字数上限・主張ごとの根拠状態から提出準備状況を判定する
function deriveSubmissionReadiness(analysis: EsAnalysis): SubmissionReadiness {
  const hasBlockingIssue = analysis.issues.some((issue) => issue.severity === "ERROR");
  const hasUnresolvedClaim = analysis.claims.some(
    (claim) => claim.status === "CONTRADICTED" || claim.status === "NEEDS_CONFIRMATION",
  );

  const isReady =
    analysis.questionCoverage === "ANSWERED" &&
    analysis.withinCharacterLimit &&
    !hasBlockingIssue &&
    !hasUnresolvedClaim;

  return isReady ? "READY_TO_SUBMIT" : "NEEDS_REVIEW";
}

export function useEsRevision() {
  const [state, setState] = useState<UseEsRevisionState>(initialState);

  // 「添削する」: ES文書作成 → 続けて推敲案の作成までを1操作としてまとめる
  const startRevision = useCallback(
    async (request: CreateEsDocumentRequest): Promise<boolean> => {
      setState((prev) => ({ ...prev, submitting: true, error: null }));
      try {
        const esDocument = await createEsDocument(request);
        const esRevision = await reviseEsDocument(esDocument.id);
        setState((prev) => ({
          ...prev,
          submitting: false,
          esDocument,
          esRevision,
          step: "RESULT",
        }));
        return true;
      } catch (err) {
        setState((prev) => ({ ...prev, submitting: false, error: toFormError(err) }));
        return false;
      }
    },
    [],
  );

  // 「コメントをもらう」: 推敲後の文章を再検査する
  const requestComments = useCallback(async (): Promise<boolean> => {
    const revision = state.esRevision;
    if (!revision) return false;

    setState((prev) => ({ ...prev, verifying: true, error: null }));
    try {
      const verifyAnalysis = await verifyEsRevision(revision.id);
      setState((prev) => ({ ...prev, verifying: false, verifyAnalysis, step: "COMMENTS" }));
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, verifying: false, error: toFormError(err) }));
      return false;
    }
  }, [state.esRevision]);

  const comments = buildComments(state.verifyAnalysis, state.esRevision);
  const submissionReadiness = state.verifyAnalysis
    ? deriveSubmissionReadiness(state.verifyAnalysis)
    : null;

  return {
    ...state,
    comments,
    submissionReadiness,
    startRevision,
    requestComments,
  };
}
