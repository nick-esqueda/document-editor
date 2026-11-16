import multer, { MulterError } from "multer";
import type { RequestHandler, Response } from "express";
import { MAX_UPLOAD_BYTES } from "@doc-editor/shared";
import { sendError } from "../http/sendError";

export const UPLOAD_FIELD_NAME = "file";

const BYTES_PER_MEGABYTE = 1024 * 1024;
const TOO_LARGE_MESSAGE = `This file is too large. The limit is ${MAX_UPLOAD_BYTES / BYTES_PER_MEGABYTE} MB.`;
const NOT_ONE_FILE_MESSAGE = `Upload exactly one file in the "${UPLOAD_FIELD_NAME}" field.`;
const MALFORMED_UPLOAD_MESSAGE = "The upload couldn't be read.";

/** Multer's error codes mapped to our responses. Anything not listed is a malformed upload. */
const MULTER_ERROR_RESPONSES: Record<
  string,
  { status: number; message: string }
> = {
  LIMIT_FILE_SIZE: { status: 413, message: TOO_LARGE_MESSAGE },
  LIMIT_FILE_COUNT: { status: 400, message: NOT_ONE_FILE_MESSAGE },
  LIMIT_UNEXPECTED_FILE: { status: 400, message: NOT_ONE_FILE_MESSAGE },
};

/** Files stay in memory (never written to disk), at most one, at most MAX_UPLOAD_BYTES. */
const parseSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  // Browsers send UTF-8 filenames without saying so; multer would assume latin1.
  defParamCharset: "utf8",
}).single(UPLOAD_FIELD_NAME);

/**
 * Reads one uploaded file into request.file, answering 400/413 itself
 * when the upload is missing, too large or malformed.
 */
export const receiveUploadedFile: RequestHandler = (
  request,
  response,
  next,
) => {
  parseSingleFile(request, response, (error?: unknown) => {
    if (error) {
      sendUploadError(response, error);
      return;
    }

    if (!request.file) {
      sendError(response, 400, NOT_ONE_FILE_MESSAGE);
      return;
    }

    next();
  });
};

function sendUploadError(response: Response, error: unknown): void {
  const knownError =
    error instanceof MulterError
      ? MULTER_ERROR_RESPONSES[error.code]
      : undefined;
  const { status, message } = knownError ?? {
    status: 400,
    message: MALFORMED_UPLOAD_MESSAGE,
  };

  sendError(response, status, message);
}
