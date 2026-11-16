import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  EMPTY_DOCUMENT,
  MAX_TITLE_LENGTH,
  validateDocumentContent,
  type DocumentDetails,
  type DocumentJson,
} from "@doc-editor/shared";
import type { DbPool } from "../db/pool";
import {
  deleteDocument,
  insertDocument,
  listOwnedDocuments,
  updateDocumentIfVersionMatches,
  type DocumentChanges,
  type DocumentWithOwner,
} from "../db/documentQueries";
import {
  getAccessibleDocument,
  type AccessibleDocument,
} from "../documents/documentAccess";
import { requireAuth } from "../auth/requireAuth";
import { sendError } from "../http/sendError";

const NOT_FOUND_MESSAGE = "Document not found";
const STALE_VERSION_MESSAGE =
  "This document was changed elsewhere. Reload to see the latest version.";

const updateBodySchema = z
  .object({
    version: z.number().int().positive(),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
    content: z.unknown().optional(),
  })
  .refine((body) => body.title !== undefined || body.content !== undefined, {
    message: "Nothing to update",
  });

type UpdateBody = z.infer<typeof updateBodySchema>;

/** Routes under /api/documents. Every route requires a logged-in user. */
export function createDocumentRouter(pool: DbPool): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (request, response) =>
    handleListDocuments(pool, request, response),
  );
  router.post("/", (request, response) =>
    handleCreateDocument(pool, request, response),
  );
  router.get("/:id", (request, response) =>
    handleGetDocument(pool, request, response),
  );
  router.patch("/:id", (request, response) =>
    handleUpdateDocument(pool, request, response),
  );
  router.delete("/:id", (request, response) =>
    handleDeleteDocument(pool, request, response),
  );

  return router;
}

function readUserId(request: Request): string {
  return request.session.userId as string;
}

/** Removes server-only fields before sending a document to the browser. */
function toDocumentDetails(document: DocumentWithOwner): DocumentDetails {
  const { id, title, content, version, updatedAt } = document;
  return { id, title, content, version, updatedAt };
}

/** Looks up the document the URL names, answering 404 itself when the user can't access it. */
async function findDocumentOrRespond404(
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

async function handleListDocuments(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const documents = await listOwnedDocuments(pool, readUserId(request));
  response.json(documents);
}

async function handleCreateDocument(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const document = await insertDocument(
    pool,
    readUserId(request),
    EMPTY_DOCUMENT,
  );
  response.status(201).json(toDocumentDetails(document));
}

async function handleGetDocument(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findDocumentOrRespond404(pool, request, response);

  if (accessible) {
    response.json(toDocumentDetails(accessible.document));
  }
}

async function handleUpdateDocument(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findDocumentOrRespond404(pool, request, response);
  if (!accessible) {
    return;
  }

  const body = parseUpdateBody(request.body, response);
  if (!body) {
    return;
  }

  const changes: DocumentChanges = {
    title: body.title,
    content: body.content as DocumentJson,
  };
  const updated = await updateDocumentIfVersionMatches(
    pool,
    accessible.document.id,
    body.version,
    changes,
  );

  if (!updated) {
    sendError(response, 409, STALE_VERSION_MESSAGE);
    return;
  }

  response.json(toDocumentDetails(updated));
}

/** Validates a save request, answering 400 itself when it's invalid. */
function parseUpdateBody(
  requestBody: unknown,
  response: Response,
): UpdateBody | null {
  const parsed = updateBodySchema.safeParse(requestBody);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    sendError(
      response,
      400,
      `Invalid request: ${firstIssue.path.join(".") || firstIssue.message}`,
    );
    return null;
  }

  const contentProblem = findContentProblem(parsed.data.content);

  if (contentProblem) {
    sendError(response, 400, `Invalid document content: ${contentProblem}`);
    return null;
  }

  return parsed.data;
}

/** Returns why the content is invalid, or null when it's valid or wasn't sent. */
function findContentProblem(content: unknown): string | null {
  if (content === undefined) {
    return null;
  }

  const result = validateDocumentContent(content);
  return result.isValid ? null : result.reason;
}

async function handleDeleteDocument(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findDocumentOrRespond404(pool, request, response);
  if (!accessible) {
    return;
  }

  if (accessible.role !== "owner") {
    sendError(response, 403, "Only the owner can delete this document");
    return;
  }

  await deleteDocument(pool, accessible.document.id);
  response.status(204).end();
}
