import type { PublicUser } from "@doc-editor/shared";
import { requestJson } from "./httpClient";

/** Everyone who can be given access to a document. */
export function listUsers(): Promise<PublicUser[]> {
  return requestJson<PublicUser[]>("/api/users");
}
