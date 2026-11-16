import type { Request, RequestHandler } from "express";
import { UPLOAD_REQUEST_HEADER } from "@doc-editor/shared";
import { sendError } from "./sendError";

export interface RequireJsonBodyOptions {
  /** Paths (relative to where this middleware is mounted) that accept file uploads instead of JSON. */
  uploadPaths: string[];
}

/**
 * Rejects requests that send a body that isn't JSON (415).
 * Requests without a body, like logout, pass through.
 * Together with SameSite cookies this blocks cross-site form posts (CSRF).
 * Upload paths also accept multipart bodies, but only with UPLOAD_REQUEST_HEADER,
 * which a cross-site form can't send.
 */
export function createRequireJsonBody(
  options: RequireJsonBodyOptions,
): RequestHandler {
  return (request, response, next) => {
    const isAllowedBody =
      !hasRequestBody(request) ||
      Boolean(request.is("application/json")) ||
      isAllowedUpload(request, options.uploadPaths);

    if (!isAllowedBody) {
      sendError(response, 415, "Request body must be JSON");
      return;
    }

    next();
  };
}

function hasRequestBody(request: Request): boolean {
  const contentLength = request.headers["content-length"];
  const hasContentLength = contentLength !== undefined && contentLength !== "0";
  const isChunked = request.headers["transfer-encoding"] !== undefined;

  return hasContentLength || isChunked;
}

function isAllowedUpload(request: Request, uploadPaths: string[]): boolean {
  const isUploadPath = uploadPaths.includes(request.path);
  const isMultipart = Boolean(request.is("multipart/form-data"));
  const hasUploadHeader = request.get(UPLOAD_REQUEST_HEADER) !== undefined;

  return isUploadPath && isMultipart && hasUploadHeader;
}
