import { ImportRejectedError } from "./ImportRejectedError";

const NOT_TEXT_MESSAGE =
  "This file doesn't look like a text file (it must be UTF-8 text).";
const NUL_BYTE = 0;
const WINDOWS_OR_OLD_MAC_LINE_ENDING = /\r\n?/g;

/**
 * Turns uploaded bytes into text with "\n" line endings.
 * Rejects binary files: NUL bytes or anything that isn't valid UTF-8.
 * A UTF-8 byte order mark at the start is removed.
 */
export function decodeTextFile(bytes: Buffer): string {
  if (bytes.includes(NUL_BYTE)) {
    throw new ImportRejectedError(400, NOT_TEXT_MESSAGE);
  }

  const text = decodeUtf8OrReject(bytes);
  return text.replace(WINDOWS_OR_OLD_MAC_LINE_ENDING, "\n");
}

function decodeUtf8OrReject(bytes: Buffer): string {
  // fatal: invalid UTF-8 throws instead of becoming "�". The BOM is dropped by default.
  const decoder = new TextDecoder("utf-8", { fatal: true });

  try {
    return decoder.decode(bytes);
  } catch {
    throw new ImportRejectedError(400, NOT_TEXT_MESSAGE);
  }
}
