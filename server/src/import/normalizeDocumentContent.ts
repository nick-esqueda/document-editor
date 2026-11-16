import {
  editorSchema,
  validateDocumentContent,
  type DocumentJson,
} from "@doc-editor/shared";
import { ImportRejectedError } from "./ImportRejectedError";

const CONVERSION_FAILED_MESSAGE =
  "This file couldn't be converted to a document.";

/**
 * Runs converted content through the editor schema, so it's stored exactly as the
 * editor itself would save it: default attributes filled in, marks in the editor's
 * order and neighbouring text with the same marks joined. Then applies the same
 * check every save gets, as a second safety net.
 */
export function normalizeDocumentContent(content: DocumentJson): DocumentJson {
  const normalized = convertWithSchemaOrReject(content);
  const validation = validateDocumentContent(normalized);

  if (!validation.isValid) {
    throw new ImportRejectedError(400, CONVERSION_FAILED_MESSAGE);
  }

  return normalized;
}

function convertWithSchemaOrReject(content: DocumentJson): DocumentJson {
  try {
    return editorSchema.nodeFromJSON(content).toJSON() as DocumentJson;
  } catch {
    throw new ImportRejectedError(400, CONVERSION_FAILED_MESSAGE);
  }
}
