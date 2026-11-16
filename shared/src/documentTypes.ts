import type { DocumentJson } from "./editorSchema";

/** A row in the document list. No content, to keep the list light. */
export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** A full document, as returned when opening it. */
export interface DocumentDetails extends DocumentSummary {
  content: DocumentJson;
  version: number;
}

export type CreateDocumentResponse = DocumentDetails;

/** A save. `version` is the version the edit was based on, for conflict detection. */
export interface UpdateDocumentRequest {
  version: number;
  title?: string;
  content?: DocumentJson;
}
