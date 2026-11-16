import type { JSONContent } from "@doc-editor/shared";

/** What a converter produces: the document's top-level blocks and how many things it simplified. */
export interface ConversionResult {
  blocks: JSONContent[];
  warnings: number;
}

/**
 * Strategy pattern: one converter per supported file type, chosen by file extension
 * in importFile.ts. To support a new type, add a class or object that implements this
 * interface and register it in CONVERTERS_BY_EXTENSION there (and in
 * IMPORTABLE_FILE_EXTENSIONS in the shared package, so the UI offers it).
 */
export interface DocumentConverter {
  convert(text: string): ConversionResult;
}
