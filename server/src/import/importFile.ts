import {
  DEFAULT_DOCUMENT_TITLE,
  MAX_IMPORTED_CONTENT_BYTES,
  MAX_TITLE_LENGTH,
  type DocumentJson,
  type JSONContent,
} from "@doc-editor/shared";
import type { DocumentConverter } from "./documentConverter";
import { decodeTextFile } from "./decodeTextFile";
import { ImportRejectedError } from "./ImportRejectedError";
import { markdownConverter } from "./markdownConverter";
import { normalizeDocumentContent } from "./normalizeDocumentContent";
import { plainTextConverter } from "./plainTextConverter";

/** Registry for the strategy pattern in documentConverter.ts. Keys are lowercase. */
const CONVERTERS_BY_EXTENSION: Record<string, DocumentConverter> = {
  ".txt": plainTextConverter,
  ".md": markdownConverter,
};

const TOO_LARGE_ONCE_CONVERTED_MESSAGE =
  "This file is too large once converted to a document. Try splitting it into smaller files.";

export interface UploadedFile {
  originalName: string;
  bytes: Buffer;
}

export interface ImportedDocument {
  title: string;
  content: DocumentJson;
  warnings: number;
}

/**
 * Turns an uploaded file into a document's title and content.
 * Throws ImportRejectedError (with an HTTP status) when the file can't be imported.
 */
export function importFile(file: UploadedFile): ImportedDocument {
  const converter = findConverterOrReject(file.originalName);
  const text = decodeTextFile(file.bytes);
  const { blocks, warnings } = converter.convert(text);

  const content = normalizeDocumentContent(buildDocument(blocks));
  rejectIfTooLarge(content);

  const title = buildTitleFromFileName(file.originalName);
  return { title, content, warnings };
}

function findConverterOrReject(fileName: string): DocumentConverter {
  const { extension } = splitFileName(fileName);
  const converter = CONVERTERS_BY_EXTENSION[extension.toLowerCase()];

  if (!converter) {
    throw new ImportRejectedError(400, buildUnsupportedTypeMessage(fileName));
  }

  return converter;
}

function buildUnsupportedTypeMessage(fileName: string): string {
  const supportedList = Object.keys(CONVERTERS_BY_EXTENSION).join(" or ");
  return `"${fileName}" isn't supported. Only ${supportedList} files can be uploaded.`;
}

/** An empty file still becomes a document: one empty paragraph, like a new document. */
function buildDocument(blocks: JSONContent[]): DocumentJson {
  const content = blocks.length > 0 ? blocks : [{ type: "paragraph" }];
  return { type: "doc", content };
}

/** The document must fit a normal save afterwards, or every later save would fail with 413. */
function rejectIfTooLarge(content: DocumentJson): void {
  const contentBytes = Buffer.byteLength(JSON.stringify(content));

  if (contentBytes > MAX_IMPORTED_CONTENT_BYTES) {
    throw new ImportRejectedError(413, TOO_LARGE_ONCE_CONVERTED_MESSAGE);
  }
}

/** "meeting-notes.md" → "meeting-notes", cut to the title limit (counting characters, not bytes). */
export function buildTitleFromFileName(fileName: string): string {
  const nameWithoutExtension = splitFileName(fileName).baseName.trim();
  const characters = Array.from(nameWithoutExtension);
  const title = characters.slice(0, MAX_TITLE_LENGTH).join("").trim();

  return title || DEFAULT_DOCUMENT_TITLE;
}

/**
 * Splits at the last dot. Unlike path.extname, ".md" counts as an extension with an
 * empty name, so a file named just ".md" is imported as markdown with the default title.
 */
function splitFileName(fileName: string): {
  baseName: string;
  extension: string;
} {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return { baseName: fileName, extension: "" };
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  };
}
