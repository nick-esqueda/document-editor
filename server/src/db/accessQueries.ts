import type { PublicUser } from "@doc-editor/shared";
import type { DbPool } from "./pool";

/** Everyone the document was shared with (not including the owner), by name. */
export async function listPeopleWithAccess(
  pool: DbPool,
  documentId: string,
): Promise<PublicUser[]> {
  const result = await pool.query<PublicUser>(
    `SELECT u.id, u.username, u.display_name AS "displayName"
     FROM document_access a JOIN users u ON u.id = a.user_id
     WHERE a.document_id = $1
     ORDER BY u.display_name`,
    [documentId],
  );

  return result.rows;
}

/** Gives a user access. Returns false when they already had it (nothing changes). */
export async function grantAccess(
  pool: DbPool,
  documentId: string,
  userId: string,
  grantedBy: string,
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO document_access (document_id, user_id, granted_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO NOTHING`,
    [documentId, userId, grantedBy],
  );

  return result.rowCount === 1;
}

/** Removes a user's access. Does nothing if they didn't have it. */
export async function revokeAccess(
  pool: DbPool,
  documentId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    "DELETE FROM document_access WHERE document_id = $1 AND user_id = $2",
    [documentId, userId],
  );
}
