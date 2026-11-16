import type { Response } from "express";
import type { ApiErrorBody } from "@doc-editor/shared";

export function sendError(
  response: Response,
  status: number,
  message: string,
): void {
  const body: ApiErrorBody = { error: message };
  response.status(status).json(body);
}
