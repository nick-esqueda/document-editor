import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { DocumentAccessResponse } from "@doc-editor/shared";
import type { DbPool } from "../db/pool";
import {
  grantAccess,
  listPeopleWithAccess,
  revokeAccess,
} from "../db/accessQueries";
import { findPublicUserById } from "../db/userQueries";
import { isUuid, type AccessibleDocument } from "../documents/documentAccess";
import {
  findDocumentOrRespond404,
  isOwnerOrRespond403,
  readUserId,
} from "../documents/documentRequests";
import { sendError } from "../http/sendError";

const OWNER_ONLY_MESSAGE = "Only the owner can change who has access";

const grantBodySchema = z.object({ userId: z.string().refine(isUuid) });

/**
 * Routes under /api/documents/:id/access. Anyone who can open the document may
 * see who has access; only the owner may grant or remove it.
 */
export function createAccessRouter(pool: DbPool): Router {
  const router = Router({ mergeParams: true });

  router.get("/", (request, response) =>
    handleListAccess(pool, request, response),
  );
  router.post("/", (request, response) =>
    handleGrantAccess(pool, request, response),
  );
  router.delete("/:userId", (request, response) =>
    handleRevokeAccess(pool, request, response),
  );

  return router;
}

async function buildAccessResponse(
  pool: DbPool,
  accessible: AccessibleDocument,
): Promise<DocumentAccessResponse> {
  const { document } = accessible;
  const [owner, people] = await Promise.all([
    findPublicUserById(pool, document.ownerId),
    listPeopleWithAccess(pool, document.id),
  ]);

  // The owner always exists: documents are deleted along with their owner.
  return { owner: owner!, people };
}

async function handleListAccess(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findDocumentOrRespond404(pool, request, response);

  if (accessible) {
    response.json(await buildAccessResponse(pool, accessible));
  }
}

async function handleGrantAccess(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findOwnedDocumentOrRespond(pool, request, response);
  if (!accessible) {
    return;
  }

  const userId = await parseGrantTargetOrRespond400(
    pool,
    accessible,
    request.body,
    response,
  );
  if (!userId) {
    return;
  }

  const ownerId = readUserId(request);
  const wasAdded = await grantAccess(
    pool,
    accessible.document.id,
    userId,
    ownerId,
  );
  const status = wasAdded ? 201 : 200;

  response.status(status).json(await buildAccessResponse(pool, accessible));
}

async function handleRevokeAccess(
  pool: DbPool,
  request: Request,
  response: Response,
) {
  const accessible = await findOwnedDocumentOrRespond(pool, request, response);

  if (!accessible) {
    return;
  }

  // A malformed id can't have access, so there's nothing to remove.
  const userId = String(request.params.userId);
  if (isUuid(userId)) {
    await revokeAccess(pool, accessible.document.id, userId);
  }

  response.status(204).end();
}

/** 404 if the caller can't see the document, 403 if they can but don't own it. */
async function findOwnedDocumentOrRespond(
  pool: DbPool,
  request: Request,
  response: Response,
): Promise<AccessibleDocument | null> {
  const accessible = await findDocumentOrRespond404(pool, request, response);
  const isOwner =
    accessible !== null &&
    isOwnerOrRespond403(accessible, response, OWNER_ONLY_MESSAGE);

  return isOwner ? accessible : null;
}

/** Returns the user id to share with, or answers 400 itself when it isn't a valid choice. */
async function parseGrantTargetOrRespond400(
  pool: DbPool,
  accessible: AccessibleDocument,
  requestBody: unknown,
  response: Response,
): Promise<string | null> {
  const parsed = grantBodySchema.safeParse(requestBody);
  const userId = parsed.success ? parsed.data.userId : null;
  const user = userId ? await findPublicUserById(pool, userId) : null;

  if (!user) {
    sendError(response, 400, "Choose an existing user to share with");
    return null;
  }

  if (user.id === accessible.document.ownerId) {
    sendError(response, 400, "The owner already has access");
    return null;
  }

  return user.id;
}
