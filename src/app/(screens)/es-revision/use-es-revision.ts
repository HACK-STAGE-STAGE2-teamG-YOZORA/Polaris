import { useCallback, useEffect, useState } from "react";

import {
  analyzeEsDocument,
  createEsDocument,
  reviseEsDocument,
  reviewEsRevisionChange,
  updateEsDocument,
  verifyEsRevision,
} from "@/lib/api/es-documents";
import { getAuthSession } from "@/lib/api/auth";
import { listCompanies } from "@/lib/api/companies";
import { ApiError } from "@/lib/api/errors";
import { listConfirmedExperiences } from "@/lib/api/experiences";
import type { CompanySummary } from "@/types/company";
import type {
  CreateEsDocumentRequest,
  EsAnalysis,
  EsDocument,
  EsRevision,
  RevisionDecision,
} from "@/types/es-document";
import type { ExperienceResponse } from "@/types/experience";
import {
  determineRevisionWorkflowStage,
  fingerprintEsRequest,
} from "./es-revision-logic";

export interface EsFormError {
  message: string;
  retryable: boolean;
  fieldErrors: Record<string, string>;
}

export type EsRevisionStep = "INPUT" | "ANALYSIS" | "RESULT" | "COMMENTS";
export type EsAccessStatus = "CHECKING" | "UNAUTHENTICATED" | "LOADING_CONTEXT" | "READY" | "ERROR";

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
  step: EsRevisionStep;
  esDocument: EsDocument | null;
  originalAnalysis: EsAnalysis | null;
  esRevision: EsRevision | null;
  verifyAnalysis: EsAnalysis | null;
  requestFingerprint: string | null;
  progressStage: EsRevisionProgressStage | null;
  reviewingChangeId: string | null;
  error: EsFormError | null;
}

const initialState: UseEsRevisionState = {
  accessStatus: "CHECKING",
  companies: [],
  experiences: [],
  step: "INPUT",
  esDocument: null,
  originalAnalysis: null,
  esRevision: null,
  verifyAnalysis: null,
  requestFingerprint: null,
  progressStage: null,
  reviewingChangeId: null,
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

export function useEsRevision() {
  const [state, setState] = useState<UseEsRevisionState>(initialState);

  const loadScreenContext = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, accessStatus: "CHECKING", error: null }));
    try {
      const session = await getAuthSession();
      if (!session.authenticated || !session.user) {
        setState((prev) => ({ ...prev, accessStatus: "UNAUTHENTICATED", companies: [], experiences: [] }));
        return;
      }

      setState((prev) => ({ ...prev, accessStatus: "LOADING_CONTEXT" }));
      const [companyPage, experiencePage] = await Promise.all([
        listCompanies(),
        listConfirmedExperiences(),
      ]);
      setState((prev) => ({
        ...prev,
        accessStatus: "READY",
        companies: companyPage.items,
        experiences: experiencePage.items,
        error: null,
      }));
    } catch (err) {
      if (err instanceof ApiError && err.response.code === "AUTH_REQUIRED") {
        setState((prev) => ({ ...prev, accessStatus: "UNAUTHENTICATED", companies: [], experiences: [] }));
        return;
      }
      setState((prev) => ({ ...prev, accessStatus: "ERROR", error: toFormError(err) }));
    }
  }, []);

  useEffect(() => {
    void loadScreenContext();
  }, [loadScreenContext]);

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
      setState((prev) => ({ ...prev, progressStage: null, esRevision, step: "RESULT" }));
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
      setState((prev) => ({ ...prev, progressStage: null, verifyAnalysis, step: "COMMENTS" }));
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
    step: state.step,
    esDocument: state.esDocument,
    originalAnalysis: state.originalAnalysis,
    esRevision: state.esRevision,
    verifyAnalysis: state.verifyAnalysis,
    error: state.error,
    submitting,
    verifying,
    reviewingChangeId: state.reviewingChangeId,
    progressLabel: state.progressStage ? PROGRESS_LABEL[state.progressStage] : null,
    startAnalysis,
    requestRevision,
    requestComments,
    reviewChange,
    reloadContext: loadScreenContext,
  };
}
