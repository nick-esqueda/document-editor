import type { RequestHandler } from "express";
import { sendError } from "../http/sendError";

/** Rejects the request with 401 unless the session belongs to a logged-in user. */
export const requireAuth: RequestHandler = (request, response, next) => {
  const hasLoggedInUser = Boolean(request.session?.userId);

  if (!hasLoggedInUser) {
    sendError(response, 401, "Not logged in");
    return;
  }

  next();
};
