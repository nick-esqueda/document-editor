import type { DbPool } from "../db/pool";
import {
  findDocumentById,
  type DocumentWithOwner,
} from "../db/documentQueries";

export type DocumentRole = "owner";

export interface AccessibleDocument {
  document: DocumentWithOwner;
  role: DocumentRole;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The single access check for every /api/documents/:id route.
 * Returns null when the document doesn't exist OR the user may not see it,
 * so callers answer 404 either way and never reveal that a document exists.
 * Phase 3 widens this from "owner" to "owner or shared with".
 */
export async function getAccessibleDocument(
  pool: DbPool,
  userId: string,
  documentId: string,
): Promise<AccessibleDocument | null> {
  if (!UUID_PATTERN.test(documentId)) {
    return null;
  }

  const document = await findDocumentById(pool, documentId);
  const isOwner = document?.ownerId === userId;

  return document && isOwner ? { document, role: "owner" } : null;
}
