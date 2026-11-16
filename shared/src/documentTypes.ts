import type { PublicUser } from "./authTypes";
import type { DocumentJson } from "./editorSchema";

/** A row in the document list. No content, to keep the list light. */
export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** A document you own, with how many people you've shared it with. */
export interface OwnedDocumentSummary extends DocumentSummary {
  sharedWithCount: number;
}

/** A document someone else owns and has shared with you. */
export interface SharedDocumentSummary extends DocumentSummary {
  ownerName: string;
}

/** The document list, split into what you own and what's shared with you. */
export interface DocumentListResponse {
  owned: OwnedDocumentSummary[];
  shared: SharedDocumentSummary[];
}

/** "owner" can share and delete; "editor" was given access and can open and edit. */
export type DocumentRole = "owner" | "editor";

/** A full document, as returned when opening it. */
export interface DocumentDetails extends DocumentSummary {
  content: DocumentJson;
  version: number;
  role: DocumentRole;
  ownerName: string;
}

export type CreateDocumentResponse = DocumentDetails;

/** Result of uploading a file. `warnings` counts formatting that was simplified. */
export interface ImportDocumentResponse {
  id: string;
  warnings: number;
}

/** A save. `version` is the version the edit was based on, for conflict detection. */
export interface UpdateDocumentRequest {
  version: number;
  title?: string;
  content?: DocumentJson;
}

/** Who can open a document: its owner and everyone it's shared with. */
export interface DocumentAccessResponse {
  owner: PublicUser;
  people: PublicUser[];
}

export interface GrantAccessRequest {
  userId: string;
}
