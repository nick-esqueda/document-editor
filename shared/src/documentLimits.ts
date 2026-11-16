export const MAX_TITLE_LENGTH = 200;
export const DEFAULT_DOCUMENT_TITLE = "Untitled document";

/** Largest JSON body a save may send (title + content + version). */
export const MAX_SAVE_BODY_BYTES = 1024 * 1024;

/** Room kept for the title, version and JSON keys around the content in a save. */
const SAVE_BODY_HEADROOM_BYTES = 4096;

/**
 * Largest content an import may create, so the document can still be saved
 * afterwards within MAX_SAVE_BODY_BYTES.
 */
export const MAX_IMPORTED_CONTENT_BYTES =
  MAX_SAVE_BODY_BYTES - SAVE_BODY_HEADROOM_BYTES;

/** Largest file the upload accepts, checked before any conversion. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;

/** File types the upload accepts. The server picks a converter per extension. */
export const IMPORTABLE_FILE_EXTENSIONS = [".txt", ".md"] as const;
