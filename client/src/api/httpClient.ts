import type { ApiErrorBody } from "@doc-editor/shared";

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** An API call that came back with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Sends a JSON request to the API and returns the parsed JSON response (or undefined for 204). */
export async function requestJson<ResponseBody>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ResponseBody> {
  const hasBody = init.body !== undefined;
  const response = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const isEmpty = response.status === 204;
  return isEmpty
    ? (undefined as ResponseBody)
    : ((await response.json()) as ResponseBody);
}

async function buildApiError(response: Response): Promise<ApiError> {
  const errorBody = (await response
    .json()
    .catch(() => null)) as ApiErrorBody | null;
  const message = errorBody?.error ?? FALLBACK_ERROR_MESSAGE;

  return new ApiError(response.status, message);
}
