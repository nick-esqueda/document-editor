import type { ErrorRequestHandler } from "express";
import { sendError } from "./sendError";

const CLIENT_ERROR_MESSAGES: Record<
  string,
  { status: number; message: string }
> = {
  "entity.parse.failed": {
    status: 400,
    message: "Request body is not valid JSON",
  },
  "entity.too.large": { status: 413, message: "Request body is too large" },
};

/** Last middleware in the chain: turns thrown errors into JSON error responses. */
export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  const knownClientError = CLIENT_ERROR_MESSAGES[error?.type];

  if (knownClientError) {
    sendError(response, knownClientError.status, knownClientError.message);
    return;
  }

  console.error(error);
  sendError(response, 500, "Something went wrong");
};
