import type { Request, RequestHandler } from "express";
import { sendError } from "./sendError";

/**
 * Rejects requests that send a body that isn't JSON (415).
 * Requests without a body, like logout, pass through.
 * Together with SameSite cookies this blocks cross-site form posts (CSRF).
 */
export const requireJsonBody: RequestHandler = (request, response, next) => {
  if (hasRequestBody(request) && !request.is("application/json")) {
    sendError(response, 415, "Request body must be JSON");
    return;
  }

  next();
};

function hasRequestBody(request: Request): boolean {
  const contentLength = request.headers["content-length"];
  const hasContentLength = contentLength !== undefined && contentLength !== "0";
  const isChunked = request.headers["transfer-encoding"] !== undefined;

  return hasContentLength || isChunked;
}
