import type { Request, Response } from "express";
import type { DbPool } from "../db/pool";
import { sendError } from "../http/sendError";
import {
  getAccessibleDocument,
  type AccessibleDocument,
} from "./documentAccess";

const NOT_FOUND_MESSAGE = "Document not found";

/** The logged-in user's id. Only call behind requireAuth. */
export function readUserId(request: Request): string {
  return request.session.userId as string;
}

/** Looks up the document the URL names, answering 404 itself when the user can't access it. */
export async function findDocumentOrRespond404(
  pool: DbPool,
  request: Request,
  response: Response,
): Promise<AccessibleDocument | null> {
  const documentId = String(request.params.id);
  const accessible = await getAccessibleDocument(
    pool,
    readUserId(request),
    documentId,
  );

  if (!accessible) {
    sendError(response, 404, NOT_FOUND_MESSAGE);
  }

  return accessible;
}

/** Answers 403 itself unless the caller owns the document. Returns whether they do. */
export function isOwnerOrRespond403(
  accessible: AccessibleDocument,
  response: Response,
  forbiddenMessage: string,
): boolean {
  const isOwner = accessible.role === "owner";

  if (!isOwner) {
    sendError(response, 403, forbiddenMessage);
  }

  return isOwner;
}
