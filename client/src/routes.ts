export const HOME_PATH = "/";
export const LOGIN_PATH = "/login";
export const DOCUMENT_PATH = "/d/:documentId";

export function buildDocumentPath(documentId: string): string {
  return `/d/${encodeURIComponent(documentId)}`;
}
