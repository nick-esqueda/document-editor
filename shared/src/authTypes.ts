/** The user fields that are safe to send to the browser. */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Shape of every error response the API returns. */
export interface ApiErrorBody {
  error: string;
}
