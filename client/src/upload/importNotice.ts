/** Passed to the editor (as navigation state) right after a file is imported. */
export interface ImportNotice {
  fileName: string;
  warnings: number;
}

/** Reads an ImportNotice from navigation state, which can be anything (or nothing). */
export function readImportNotice(state: unknown): ImportNotice | null {
  const candidate = state as Partial<ImportNotice> | null;
  const isNotice =
    typeof candidate?.fileName === "string" &&
    typeof candidate.warnings === "number";

  return isNotice ? (candidate as ImportNotice) : null;
}
