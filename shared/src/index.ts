export type { PublicUser, LoginRequest, ApiErrorBody } from "./authTypes";
export type {
  DocumentSummary,
  OwnedDocumentSummary,
  SharedDocumentSummary,
  DocumentListResponse,
  DocumentRole,
  DocumentDetails,
  DocumentAccessResponse,
  GrantAccessRequest,
  CreateDocumentResponse,
  ImportDocumentResponse,
  UpdateDocumentRequest,
} from "./documentTypes";
export {
  createEditorExtensions,
  editorSchema,
  EMPTY_DOCUMENT,
  HEADING_LEVELS,
  type DocumentJson,
} from "./editorSchema";
export {
  validateDocumentContent,
  type ContentValidationResult,
} from "./validateDocumentContent";
export {
  MAX_TITLE_LENGTH,
  DEFAULT_DOCUMENT_TITLE,
  MAX_SAVE_BODY_BYTES,
  MAX_IMPORTED_CONTENT_BYTES,
  MAX_UPLOAD_BYTES,
  IMPORTABLE_FILE_EXTENSIONS,
} from "./documentLimits";
export type { JSONContent } from "@tiptap/core";
export { UPLOAD_REQUEST_HEADER } from "./apiHeaders";
