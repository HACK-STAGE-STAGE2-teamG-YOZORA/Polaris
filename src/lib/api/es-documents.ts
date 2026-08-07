import { throwIfError } from "./errors";
import type {
  CreateEsDocumentRequest,
  CreateEsRevisionRequest,
  EsAnalysis,
  EsDocument,
  EsRevision,
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
