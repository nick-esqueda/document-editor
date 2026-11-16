import type {
  DocumentDetails,
  DocumentJson,
  DocumentSummary,
} from "@doc-editor/shared";
import type { DbPool } from "./pool";

export interface DocumentWithOwner extends DocumentDetails {
  ownerId: string;
}

export interface DocumentChanges {
  title?: string;
  content?: DocumentJson;
}

const SUMMARY_COLUMNS = `id, title, updated_at AS "updatedAt"`;
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, content, version, owner_id AS "ownerId"`;

export async function listOwnedDocuments(
  pool: DbPool,
  ownerId: string,
): Promise<DocumentSummary[]> {
  const result = await pool.query<DocumentSummary>(
    `SELECT ${SUMMARY_COLUMNS} FROM documents WHERE owner_id = $1 ORDER BY updated_at DESC`,
    [ownerId],
  );

  return result.rows;
}

export async function insertDocument(
  pool: DbPool,
  ownerId: string,
  content: DocumentJson,
): Promise<DocumentWithOwner> {
  const result = await pool.query<DocumentWithOwner>(
    `INSERT INTO documents (owner_id, content) VALUES ($1, $2) RETURNING ${DETAIL_COLUMNS}`,
    [ownerId, content],
  );

  return result.rows[0];
}

export async function findDocumentById(
  pool: DbPool,
  documentId: string,
): Promise<DocumentWithOwner | null> {
  const result = await pool.query<DocumentWithOwner>(
    `SELECT ${DETAIL_COLUMNS} FROM documents WHERE id = $1`,
    [documentId],
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
): Promise<DocumentWithOwner | null> {
  const result = await pool.query<DocumentWithOwner>(
    `UPDATE documents
     SET title = COALESCE($3, title),
         content = COALESCE($4, content),
         version = version + 1,
         updated_at = now()
     WHERE id = $1 AND version = $2
     RETURNING ${DETAIL_COLUMNS}`,
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
