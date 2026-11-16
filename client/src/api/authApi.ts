import type { LoginRequest, PublicUser } from "@doc-editor/shared";
import { ApiError, requestJson } from "./httpClient";

const UNAUTHORIZED_STATUS = 401;

export function logIn(credentials: LoginRequest): Promise<PublicUser> {
  return requestJson<PublicUser>("/api/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export function logOut(): Promise<void> {
  return requestJson<void>("/api/auth/logout", { method: "POST" });
}

/** Returns the logged-in user, or null when nobody is logged in. */
export async function fetchCurrentUser(): Promise<PublicUser | null> {
  try {
    return await requestJson<PublicUser>("/api/auth/me");
  } catch (error) {
    const isLoggedOut =
      error instanceof ApiError && error.status === UNAUTHORIZED_STATUS;
    if (isLoggedOut) {
      return null;
    }
    throw error;
  }
}
