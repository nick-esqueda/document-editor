import type { DocumentRole } from "@doc-editor/shared";
import type { DbPool } from "../db/pool";
import {
  findAccessibleDocumentById,
  type DocumentRecord,
} from "../db/documentQueries";

export interface AccessibleDocument {
  document: DocumentRecord;
  role: DocumentRole;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * The single access check for every /api/documents/:id route: the owner or
 * anyone given access may open the document.
 * Returns null when the document doesn't exist OR the user may not see it,
 * so callers answer 404 either way and never reveal that a document exists.
 */
export async function getAccessibleDocument(
  pool: DbPool,
  userId: string,
  documentId: string,
): Promise<AccessibleDocument | null> {
  if (!isUuid(documentId)) {
    return null;
  }

  const document = await findAccessibleDocumentById(pool, documentId, userId);
  if (!document) {
    return null;
  }

  const role: DocumentRole = document.ownerId === userId ? "owner" : "editor";
  return { document, role };
}
