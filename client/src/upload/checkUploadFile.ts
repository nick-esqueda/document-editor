import {
  IMPORTABLE_FILE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from "@doc-editor/shared";

const SUPPORTED_TYPES_TEXT = IMPORTABLE_FILE_EXTENSIONS.join(" or ");
const MAX_UPLOAD_MEGABYTES = MAX_UPLOAD_BYTES / (1024 * 1024);

/** Shown next to the Upload button. */
export const UPLOAD_SUPPORT_HINT = `Upload supports ${IMPORTABLE_FILE_EXTENSIONS.join(" and ")}, up to ${MAX_UPLOAD_MEGABYTES} MB`;

/** Shown over the list while a file is dragged onto it. */
export const DROP_HINT = `Drop a ${SUPPORTED_TYPES_TEXT} file to import it`;

/** The file picker's `accept` value. */
export const UPLOAD_ACCEPT = IMPORTABLE_FILE_EXTENSIONS.join(",");

/** Second line of every upload error: what the user can do instead. */
export const UPLOAD_ADVICE = `Upload a ${SUPPORTED_TYPES_TEXT} file up to ${MAX_UPLOAD_MEGABYTES} MB.`;

/**
 * Checks done in the browser before uploading, so obviously wrong files fail
 * instantly. The server repeats them; it's the one that decides.
 * Each check returns an error message, or null when the file passes.
 */
const UPLOAD_CHECKS: ((file: File) => string | null)[] = [
  (file) =>
    hasImportableExtension(file.name)
      ? null
      : `"${file.name}" isn't supported.`,
  (file) =>
    file.size <= MAX_UPLOAD_BYTES ? null : `"${file.name}" is too large.`,
];

/** Returns why the file can't be uploaded, or null if it can. */
export function findUploadProblem(file: File): string | null {
  for (const check of UPLOAD_CHECKS) {
    const problem = check(file);
    if (problem) {
      return problem;
    }
  }
  return null;
}

function hasImportableExtension(fileName: string): boolean {
  const lowerCaseName = fileName.toLowerCase();
  return IMPORTABLE_FILE_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension),
  );
}
