import type {
  CreateDocumentResponse,
  DocumentAccessResponse,
  DocumentDetails,
  DocumentListResponse,
  GrantAccessRequest,
  UpdateDocumentRequest,
} from "@doc-editor/shared";
import { requestJson } from "./httpClient";

const DOCUMENTS_PATH = "/api/documents";

function buildDocumentApiPath(documentId: string): string {
  return `${DOCUMENTS_PATH}/${encodeURIComponent(documentId)}`;
}

export function listDocuments(): Promise<DocumentListResponse> {
  return requestJson<DocumentListResponse>(DOCUMENTS_PATH);
}

export function createDocument(): Promise<CreateDocumentResponse> {
  return requestJson<CreateDocumentResponse>(DOCUMENTS_PATH, {
    method: "POST",
  });
}

export function fetchDocument(documentId: string): Promise<DocumentDetails> {
  return requestJson<DocumentDetails>(buildDocumentApiPath(documentId));
}

export function updateDocument(
  documentId: string,
  changes: UpdateDocumentRequest,
): Promise<DocumentDetails> {
  return requestJson<DocumentDetails>(buildDocumentApiPath(documentId), {
    method: "PATCH",
    body: changes,
  });
}

export function deleteDocument(documentId: string): Promise<void> {
  return requestJson<void>(buildDocumentApiPath(documentId), {
    method: "DELETE",
  });
}

function buildAccessApiPath(documentId: string): string {
  return `${buildDocumentApiPath(documentId)}/access`;
}

export function fetchDocumentAccess(
  documentId: string,
): Promise<DocumentAccessResponse> {
  return requestJson<DocumentAccessResponse>(buildAccessApiPath(documentId));
}

export function grantDocumentAccess(
  documentId: string,
  userId: string,
): Promise<DocumentAccessResponse> {
  const body: GrantAccessRequest = { userId };
  return requestJson<DocumentAccessResponse>(buildAccessApiPath(documentId), {
    method: "POST",
    body,
  });
}

export function revokeDocumentAccess(
  documentId: string,
  userId: string,
): Promise<void> {
  const path = `${buildAccessApiPath(documentId)}/${encodeURIComponent(userId)}`;
  return requestJson<void>(path, { method: "DELETE" });
}

/**
 * Fire-and-forget save used while the tab is closing. `keepalive` lets the
 * request finish after the page is gone; the response is never read.
 */
export function sendFinalSave(
  documentId: string,
  changes: UpdateDocumentRequest,
): void {
  void fetch(buildDocumentApiPath(documentId), {
    method: "PATCH",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }).catch(() => {});
}
