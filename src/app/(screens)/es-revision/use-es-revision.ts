import { useCallback, useEffect, useState } from "react";

import {
  analyzeEsDocument,
  createEsDocument,
  getEsDocument,
  getEsRevisionContext,
  reviseEsDocument,
  reviewEsRevisionChange,
  updateEsDocument,
  verifyEsRevision,
} from "@/lib/api/es-documents";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/api/cache";
import { listCompanies } from "@/lib/api/companies";
import { ApiError } from "@/lib/api/errors";
import type { CompanySummary } from "@/types/company";
import type {
  CreateEsDocumentRequest,
  EsAnalysis,
  EsDocument,
  EsDocumentSummary,
  EsRevision,
  EsRevisionContext,
  RevisionDecision,
} from "@/types/es-document";
import type { ExperienceResponse } from "@/types/experience";
import {
  determineRevisionWorkflowStage,
  fingerprintEsRequest,
  restoreEsWorkflow,
} from "./es-revision-logic";

export interface EsFormError {
  message: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
}

export type EsRevisionStep = "HUB" | "INPUT" | "ANALYSIS" | "RESULT" | "COMMENTS";
// 認証確認は集約APIの1回に含まれるため、読み込み中はLOADING_CONTEXTだけを使う。
// 未ログインは集約APIの401（AUTH_REQUIRED）で判定する
export type EsAccessStatus = "UNAUTHENTICATED" | "LOADING_CONTEXT" | "READY" | "ERROR";

export type EsRevisionProgressStage =
  | "CREATING_DOCUMENT"
  | "UPDATING_DOCUMENT"
  | "ANALYZING_ORIGINAL"
  | "REVISING"
  | "VERIFYING";

const PROGRESS_LABEL: Record<EsRevisionProgressStage, string> = {
  CREATING_DOCUMENT: "ES原文を保存しています…",
  UPDATING_DOCUMENT: "ES原文を更新しています…",
  ANALYZING_ORIGINAL: "原文を検査しています…",
  REVISING: "推敲しています…",
  VERIFYING: "推敲結果を再検査しています…",
};

interface UseEsRevisionState {
  accessStatus: EsAccessStatus;
  companies: CompanySummary[];
  experiences: ExperienceResponse[];
  documents: EsDocumentSummary[];
  step: EsRevisionStep;
  esDocument: EsDocument | null;
  originalAnalysis: EsAnalysis | null;
  esRevision: EsRevision | null;
  verifyAnalysis: EsAnalysis | null;
  requestFingerprint: string | null;
  progressStage: EsRevisionProgressStage | null;
  reviewingChangeId: string | null;
  loadingDocumentId: string | null;
  error: EsFormError | null;
}

const initialState: UseEsRevisionState = {
  accessStatus: "LOADING_CONTEXT",
  companies: [],
  experiences: [],
  documents: [],
  step: "HUB",
  esDocument: null,
  originalAnalysis: null,
  esRevision: null,
  verifyAnalysis: null,
  requestFingerprint: null,
  progressStage: null,
  reviewingChangeId: null,
  loadingDocumentId: null,
  error: null,
};

function toFieldErrors(details: { field?: string; reason?: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const detail of details) {
    if (detail.field && detail.reason) fieldErrors[detail.field] = detail.reason;
  }
  return fieldErrors;
}

function toFormError(err: unknown): EsFormError {
  if (!(err instanceof ApiError)) {
    return {
      message: "通信に失敗しました。ネットワーク状況を確認してください。",
      retryable: true,
      fieldErrors: {},
    };
  }

  const fieldErrors = toFieldErrors(err.response.details);
  switch (err.response.code) {
    case "VALIDATION_ERROR":
      return { message: err.response.message || "入力内容を確認してください。", retryable: false, fieldErrors };
    case "CONFLICT":
      return { message: "先に検査・推敲を完了させてください。", retryable: false, fieldErrors };
    case "AUTH_REQUIRED":
      return { message: "ログインが必要です。", retryable: false, fieldErrors };
    case "AI_INVALID_OUTPUT":
      return {
        message: "AIの出力形式に問題がありました。もう一度お試しください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_UNAVAILABLE":
      return {
        message: "LM Studioが起動していません。Local Serverとモデルの読み込み状態を確認してください。",
        retryable: true,
        fieldErrors,
      };
    case "AI_TIMEOUT":
      return {
        message: "AIの応答が時間内に返りませんでした。入力内容を保持したまま再試行できます。",
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

function isAuthRequiredError(err: unknown): boolean {
  return err instanceof ApiError && err.response.code === "AUTH_REQUIRED";
}

interface UseEsRevisionOptions {
  initialDocumentId?: string | null;
  startNew?: boolean;
}

function requestFromDocument(document: EsDocument): CreateEsDocumentRequest {
  return {
    companyId: document.companyId,
    targetRole: document.targetRole,
    question: document.question,
    characterLimit: document.characterLimit,
    originalText: document.originalText,
    preferredExperienceIds: document.preferredExperienceIds,
    emphasis: document.emphasis,
  };
}

export function useEsRevision(options: UseEsRevisionOptions = {}) {
  const [state, setState] = useState<UseEsRevisionState>(initialState);

  // 集約APIの応答で画面全体を組み立てる。初回表示とキャッシュなしの再読み込みで使う
  const applyContext = useCallback((context: EsRevisionContext): void => {
    const selectedDocument = context.selectedDocument;
    const restored = selectedDocument ? restoreEsWorkflow(selectedDocument) : null;
    setState((prev) => ({
      ...prev,
      accessStatus: "READY",
      companies: context.companies.items,
      experiences: context.experiences.items,
      documents: context.documents.items,
      step: restored ? restored.step : options.startNew ? "INPUT" : "HUB",
      esDocument: selectedDocument,
      originalAnalysis: restored?.originalAnalysis ?? null,
      esRevision: restored?.revision ?? null,
      verifyAnalysis: restored?.verificationAnalysis ?? null,
      requestFingerprint: selectedDocument
        ? fingerprintEsRequest(requestFromDocument(selectedDocument))
        : null,
      error: null,
    }));
  }, [options.startNew]);

  // 一覧だけを最新へ差し替える。キャッシュを表示したあとの背面での再取得で使い、
  // ユーザーが進めている手順（step）や編集中の文書は巻き戻さない
  const applyLists = useCallback((context: EsRevisionContext): void => {
    setState((prev) => ({
      ...prev,
      accessStatus: "READY",
      companies: context.companies.items,
      experiences: context.experiences.items,
      documents: context.documents.items,
    }));
  }, []);

  const loadScreenContext = useCallback(async (): Promise<void> => {
    const documentId = options.initialDocumentId ?? null;
    const cacheKey = CACHE_KEYS.esRevisionContext(documentId);
    const cached = readCache<EsRevisionContext>(cacheKey);
    // タブを戻ってきた場合は取得済みデータで即描画し、そのうえで背面から取り直す
    if (cached) applyContext(cached);
    else setState((prev) => ({ ...prev, accessStatus: "LOADING_CONTEXT", error: null }));

    try {
      // 企業・確認済み経験・ES一覧・（指定時は）文書詳細を1回の認証確認でまとめて取得する
      const context = await getEsRevisionContext(documentId);
      writeCache(cacheKey, context);
      if (cached) applyLists(context);
      else applyContext(context);
    } catch (err) {
      if (err instanceof ApiError && err.response.code === "AUTH_REQUIRED") {
        setState((prev) => ({ ...prev, accessStatus: "UNAUTHENTICATED", companies: [], experiences: [] }));
        return;
      }
      // キャッシュを表示できている場合は内容を残し、再取得の失敗だけを知らせる
      setState((prev) => ({
        ...prev,
        accessStatus: cached ? prev.accessStatus : "ERROR",
        error: toFormError(err),
      }));
    }
  }, [applyContext, applyLists, options.initialDocumentId]);

  useEffect(() => {
    void loadScreenContext();
  }, [loadScreenContext]);

  const startNewDocument = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: "INPUT",
      esDocument: null,
      originalAnalysis: null,
      esRevision: null,
      verifyAnalysis: null,
      requestFingerprint: null,
      progressStage: null,
      loadingDocumentId: null,
      error: null,
    }));
  }, []);

  const openDocument = useCallback(async (documentId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, loadingDocumentId: documentId, error: null }));
    try {
      const document = await getEsDocument(documentId);
      const restored = restoreEsWorkflow(document);
      setState((prev) => ({
        ...prev,
        loadingDocumentId: null,
        step: restored.step,
        esDocument: document,
        originalAnalysis: restored.originalAnalysis,
        esRevision: restored.revision,
        verifyAnalysis: restored.verificationAnalysis,
        requestFingerprint: fingerprintEsRequest(requestFromDocument(document)),
      }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
        loadingDocumentId: null,
        error: toFormError(err),
      }));
      return false;
    }
  }, []);

  const backToHub = useCallback(async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      step: "HUB",
      esDocument: null,
      originalAnalysis: null,
      esRevision: null,
      verifyAnalysis: null,
      requestFingerprint: null,
      progressStage: null,
      error: null,
    }));
    try {
      // ハブへ戻るときも集約APIを使い、認証確認とDBアクセスを1リクエストにまとめる
      const cacheKey = CACHE_KEYS.esRevisionContext(null);
      const context = await getEsRevisionContext(null);
      writeCache(cacheKey, context);
      applyLists(context);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
        error: toFormError(err),
      }));
    }
  }, [applyLists]);

  const editDocument = useCallback(() => {
    setState((prev) => ({ ...prev, step: "INPUT", error: null }));
  }, []);

  const refreshCompanies = useCallback(async (): Promise<boolean> => {
    try {
      const companyPage = await listCompanies();
      setState((prev) => ({ ...prev, companies: companyPage.items }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
        error: toFormError(err),
      }));
      return false;
    }
  }, []);

  const startAnalysis = useCallback(
    async (request: CreateEsDocumentRequest): Promise<boolean> => {
      const nextFingerprint = fingerprintEsRequest(request);
      let esDocument = state.esDocument;
      let originalAnalysis = state.originalAnalysis;
      let esRevision = state.esRevision;
      let stage = determineRevisionWorkflowStage(
        {
          hasDocument: esDocument !== null,
          hasOriginalAnalysis: originalAnalysis !== null,
          hasRevision: esRevision !== null,
          requestFingerprint: state.requestFingerprint,
        },
        nextFingerprint,
      );

      setState((prev) => ({ ...prev, error: null }));
      try {
        if (stage === "CREATE" || stage === "UPDATE") {
          setState((prev) => ({
            ...prev,
            progressStage: stage === "CREATE" ? "CREATING_DOCUMENT" : "UPDATING_DOCUMENT",
          }));
          esDocument = stage === "CREATE"
            ? await createEsDocument(request)
            : await updateEsDocument(esDocument!.id, request);
          originalAnalysis = null;
          esRevision = null;
          stage = "ANALYZE";
          setState((prev) => ({
            ...prev,
            esDocument,
            originalAnalysis: null,
            esRevision: null,
            verifyAnalysis: null,
            requestFingerprint: nextFingerprint,
          }));
        }

        if (stage === "ANALYZE") {
          setState((prev) => ({ ...prev, progressStage: "ANALYZING_ORIGINAL" }));
          originalAnalysis = await analyzeEsDocument(esDocument!.id);
          stage = "REVISE";
          setState((prev) => ({ ...prev, originalAnalysis }));
        }

        setState((prev) => ({
          ...prev,
          progressStage: null,
          esRevision: esRevision ?? prev.esRevision,
          esDocument: esDocument
            ? {
                ...esDocument,
                status: "ANALYZED",
                analyses: originalAnalysis
                  ? [originalAnalysis, ...esDocument.analyses.filter((item) => item.id !== originalAnalysis!.id)]
                  : esDocument.analyses,
              }
            : prev.esDocument,
          step: "ANALYSIS",
        }));
        return true;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
          progressStage: null,
          error: toFormError(err),
        }));
        return false;
      }
    },
    [state.esDocument, state.esRevision, state.originalAnalysis, state.requestFingerprint],
  );

  const requestRevision = useCallback(async (): Promise<boolean> => {
    if (!state.esDocument || !state.originalAnalysis) return false;
    if (state.esRevision) {
      setState((prev) => ({ ...prev, step: "RESULT", error: null }));
      return true;
    }

    setState((prev) => ({ ...prev, progressStage: "REVISING", error: null }));
    try {
      const esRevision = await reviseEsDocument(state.esDocument.id);
      setState((prev) => ({
        ...prev,
        progressStage: null,
        esRevision,
        esDocument: prev.esDocument
          ? {
              ...prev.esDocument,
              status: "REVISED",
              revisions: [esRevision, ...prev.esDocument.revisions.filter((item) => item.id !== esRevision.id)],
            }
          : null,
        step: "RESULT",
      }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
        progressStage: null,
        error: toFormError(err),
      }));
      return false;
    }
  }, [state.esDocument, state.esRevision, state.originalAnalysis]);

  const requestComments = useCallback(async (): Promise<boolean> => {
    const revision = state.esRevision;
    if (!revision) return false;

    setState((prev) => ({ ...prev, progressStage: "VERIFYING", error: null }));
    try {
      const verifyAnalysis = await verifyEsRevision(revision.id);
      setState((prev) => ({
        ...prev,
        progressStage: null,
        verifyAnalysis,
        esDocument: prev.esDocument
          ? {
              ...prev.esDocument,
              status: verifyAnalysis.submissionReadiness === "READY_TO_SUBMIT" ? "VERIFIED" : "REVISED",
              analyses: [verifyAnalysis, ...prev.esDocument.analyses.filter((item) => item.id !== verifyAnalysis.id)],
            }
          : null,
        step: "COMMENTS",
      }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
        progressStage: null,
        error: toFormError(err),
      }));
      return false;
    }
  }, [state.esRevision]);

  const reviewChange = useCallback(async (changeId: string, decision: RevisionDecision): Promise<boolean> => {
    const revision = state.esRevision;
    if (!revision) return false;
    setState((prev) => ({ ...prev, reviewingChangeId: changeId, error: null }));
    try {
      const updated = await reviewEsRevisionChange(revision.id, changeId, decision);
      setState((prev) => ({
        ...prev,
        reviewingChangeId: null,
        esRevision: prev.esRevision
          ? { ...prev.esRevision, changes: prev.esRevision.changes.map((change) => change.id === updated.id ? updated : change) }
          : null,
      }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        accessStatus: isAuthRequiredError(err) ? "UNAUTHENTICATED" : prev.accessStatus,
        reviewingChangeId: null,
        error: toFormError(err),
      }));
      return false;
    }
  }, [state.esRevision]);

  const submitting = state.progressStage !== null && state.progressStage !== "VERIFYING";
  const verifying = state.progressStage === "VERIFYING";

  return {
    accessStatus: state.accessStatus,
    companies: state.companies,
    experiences: state.experiences,
    documents: state.documents,
    step: state.step,
    esDocument: state.esDocument,
    originalAnalysis: state.originalAnalysis,
    esRevision: state.esRevision,
    verifyAnalysis: state.verifyAnalysis,
    error: state.error,
    submitting,
    verifying,
    reviewingChangeId: state.reviewingChangeId,
    loadingDocumentId: state.loadingDocumentId,
    progressLabel: state.progressStage ? PROGRESS_LABEL[state.progressStage] : null,
    startAnalysis,
    requestRevision,
    requestComments,
    reviewChange,
    startNewDocument,
    openDocument,
    backToHub,
    editDocument,
    refreshCompanies,
    reloadContext: loadScreenContext,
  };
}
