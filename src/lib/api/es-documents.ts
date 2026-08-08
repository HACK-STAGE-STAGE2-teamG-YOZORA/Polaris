import { throwIfError } from "./errors";
import type {
  CreateEsDocumentRequest,
  CreateEsRevisionRequest,
  EsAnalysis,
  EsDocument,
  EsRevision,
  EsTextExtraction,
  RevisionChange,
  RevisionDecision,
  UpdateEsDocumentRequest,
} from "@/types/es-document";

const BASE_URL = "/api/v1";

// POST /api/v1/es-documents
export async function createEsDocument(request: CreateEsDocumentRequest): Promise<EsDocument> {
  const res = await fetch(`${BASE_URL}/es-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  await throwIfError(res);
  return (await res.json()) as EsDocument;
}

// PATCH /api/v1/es-documents/{esDocumentId}
// 作成後の分析・推敲に失敗し、ユーザーが入力を変更して再試行する場合に同じ下書きを更新する。
export async function updateEsDocument(
  esDocumentId: string,
  request: UpdateEsDocumentRequest,
): Promise<EsDocument> {
  const res = await fetch(`${BASE_URL}/es-documents/${esDocumentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  await throwIfError(res);
  return (await res.json()) as EsDocument;
}

// POST /api/v1/es-documents/{esDocumentId}/analyses
export async function analyzeEsDocument(esDocumentId: string): Promise<EsAnalysis> {
  const res = await fetch(`${BASE_URL}/es-documents/${esDocumentId}/analyses`, {
    method: "POST",
  });
  await throwIfError(res);
  return (await res.json()) as EsAnalysis;
}

// POST /api/v1/es-text-extractions
// アップロード元ファイルは保存せず、確認前の抽出文をその場で返す(docs/openapi.yaml参照)
export async function extractEsText(file: File): Promise<EsTextExtraction> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/es-text-extractions`, {
    method: "POST",
    body: formData,
  });
  await throwIfError(res);
  return (await res.json()) as EsTextExtraction;
}

// POST /api/v1/es-documents/{esDocumentId}/revisions
// requestBodyはopenapi.yaml上required:falseのため省略可能
export async function reviseEsDocument(
  esDocumentId: string,
  request?: CreateEsRevisionRequest,
): Promise<EsRevision> {
  const res = await fetch(`${BASE_URL}/es-documents/${esDocumentId}/revisions`, {
    method: "POST",
    headers: request ? { "Content-Type": "application/json" } : undefined,
    body: request ? JSON.stringify(request) : undefined,
  });
  await throwIfError(res);
  return (await res.json()) as EsRevision;
}

// POST /api/v1/es-revisions/{revisionId}/verify
export async function verifyEsRevision(revisionId: string): Promise<EsAnalysis> {
  const res = await fetch(`${BASE_URL}/es-revisions/${revisionId}/verify`, {
    method: "POST",
  });
  await throwIfError(res);
  return (await res.json()) as EsAnalysis;
}

// PATCH /api/v1/es-revisions/{revisionId}/changes/{changeId}
export async function reviewEsRevisionChange(
  revisionId: string,
  changeId: string,
  decision: RevisionDecision,
): Promise<RevisionChange> {
  const res = await fetch(`${BASE_URL}/es-revisions/${revisionId}/changes/${changeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  await throwIfError(res);
  return (await res.json()) as RevisionChange;
}
