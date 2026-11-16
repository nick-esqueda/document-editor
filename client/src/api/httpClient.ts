import { UPLOAD_REQUEST_HEADER, type ApiErrorBody } from "@doc-editor/shared";

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

  return readResponse<ResponseBody>(response);
}

/** Sends one file as multipart form data and returns the parsed JSON response. */
export async function uploadFile<ResponseBody>(
  path: string,
  fieldName: string,
  file: File,
): Promise<ResponseBody> {
  const formData = new FormData();
  formData.append(fieldName, file);

  // No Content-Type: the browser sets it, with the multipart boundary.
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { [UPLOAD_REQUEST_HEADER]: "1" },
    body: formData,
  });

  return readResponse<ResponseBody>(response);
}

/** Returns the parsed JSON body (or undefined for 204), or throws ApiError for non-2xx. */
async function readResponse<ResponseBody>(
  response: Response,
): Promise<ResponseBody> {
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
