import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  EMPTY_DOCUMENT,
  MAX_TITLE_LENGTH,
  validateDocumentContent,
  type DocumentDetails,
  type DocumentJson,
  type DocumentListResponse,
  type DocumentRole,
} from "@doc-editor/shared";
import type { DbPool } from "../db/pool";
import {
  deleteDocument,
  insertDocument,
  listDocumentsSharedWith,
  listOwnedDocuments,
  updateDocumentIfVersionMatches,
  type DocumentChanges,
  type DocumentRecord,
} from "../db/documentQueries";
import {
  findDocumentOrRespond404,
  isOwnerOrRespond403,
  readUserId,
} from "../documents/documentRequests";
import { requireAuth } from "../auth/requireAuth";
import { sendError } from "../http/sendError";
import { createAccessRouter } from "./accessRoutes";
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
  router.use("/:id/access", createAccessRouter(pool));

  return router;
}

/** Removes server-only fields before sending a document to the browser. */
function toDocumentDetails(
  document: DocumentRecord,
  role: DocumentRole,
): DocumentDetails {
  const { id, title, content, version, updatedAt, ownerName } = document;
  return { id, title, content, version, updatedAt, ownerName, role };
}

async function handleListDocuments(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const userId = readUserId(request);
  const [owned, shared] = await Promise.all([
    listOwnedDocuments(pool, userId),
    listDocumentsSharedWith(pool, userId),
  ]);
  const body: DocumentListResponse = { owned, shared };

  response.json(body);
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
  response.status(201).json(toDocumentDetails(document, "owner"));
}

async function handleGetDocument(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findDocumentOrRespond404(pool, request, response);

  if (accessible) {
    response.json(toDocumentDetails(accessible.document, accessible.role));
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

  response.json(toDocumentDetails(updated, accessible.role));
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

  const isOwner = isOwnerOrRespond403(
    accessible,
    response,
    "Only the owner can delete this document",
  );
  if (!isOwner) {
    return;
  }

  await deleteDocument(pool, accessible.document.id);
  response.status(204).end();
}
