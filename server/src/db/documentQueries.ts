import type {
  DocumentJson,
  OwnedDocumentSummary,
  SharedDocumentSummary,
} from "@doc-editor/shared";
import type { DbPool } from "./pool";

/** A stored document with its owner. Server-side only; routes decide what to send. */
export interface DocumentRecord {
  id: string;
  title: string;
  updatedAt: string;
  content: DocumentJson;
  version: number;
  ownerId: string;
  ownerName: string;
}

export interface DocumentChanges {
  title?: string;
  content?: DocumentJson;
}

/** Selects a full DocumentRecord from `source` (a table or CTE aliased as d), joined to its owner. */
function buildSelectWithOwner(source: string): string {
  return `SELECT d.id, d.title, d.updated_at AS "updatedAt", d.content, d.version,
                 d.owner_id AS "ownerId", owner.display_name AS "ownerName"
          FROM ${source} d JOIN users owner ON owner.id = d.owner_id`;
}

export async function listOwnedDocuments(
  pool: DbPool,
  ownerId: string,
): Promise<OwnedDocumentSummary[]> {
  const result = await pool.query<OwnedDocumentSummary>(
    `SELECT d.id, d.title, d.updated_at AS "updatedAt",
            (SELECT count(*)::int FROM document_access a WHERE a.document_id = d.id) AS "sharedWithCount"
     FROM documents d
     WHERE d.owner_id = $1
     ORDER BY d.updated_at DESC`,
    [ownerId],
  );

  return result.rows;
}

export async function listDocumentsSharedWith(
  pool: DbPool,
  userId: string,
): Promise<SharedDocumentSummary[]> {
  const result = await pool.query<SharedDocumentSummary>(
    `SELECT d.id, d.title, d.updated_at AS "updatedAt", owner.display_name AS "ownerName"
     FROM document_access a
     JOIN documents d ON d.id = a.document_id
     JOIN users owner ON owner.id = d.owner_id
     WHERE a.user_id = $1
     ORDER BY d.updated_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function insertDocument(
  pool: DbPool,
  ownerId: string,
  content: DocumentJson,
): Promise<DocumentRecord> {
  const result = await pool.query<DocumentRecord>(
    `WITH inserted AS (
       INSERT INTO documents (owner_id, content) VALUES ($1, $2) RETURNING *
     )
     ${buildSelectWithOwner("inserted")}`,
    [ownerId, content],
  );

  return result.rows[0];
}

/** Finds a document only if the user owns it or was given access, in one query. */
export async function findAccessibleDocumentById(
  pool: DbPool,
  documentId: string,
  userId: string,
): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRecord>(
    `${buildSelectWithOwner("documents")}
     WHERE d.id = $1
       AND (d.owner_id = $2 OR EXISTS (
         SELECT 1 FROM document_access a WHERE a.document_id = d.id AND a.user_id = $2
       ))`,
    [documentId, userId],
  );

  return result.rows[0] ?? null;
}

/**
 * Applies the changes only if the stored version still matches `expectedVersion`
 * (optimistic locking). Returns the updated document, or null when the version is stale.
 */
export async function updateDocumentIfVersionMatches(
  pool: DbPool,
  documentId: string,
  expectedVersion: number,
  changes: DocumentChanges,
): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRecord>(
    `WITH updated AS (
       UPDATE documents
       SET title = COALESCE($3, title),
           content = COALESCE($4, content),
           version = version + 1,
           updated_at = now()
       WHERE id = $1 AND version = $2
       RETURNING *
     )
     ${buildSelectWithOwner("updated")}`,
    [
      documentId,
      expectedVersion,
      changes.title ?? null,
      changes.content ?? null,
    ],
  );

  return result.rows[0] ?? null;
}

export async function deleteDocument(
  pool: DbPool,
  documentId: string,
): Promise<void> {
  await pool.query("DELETE FROM documents WHERE id = $1", [documentId]);
}
