import path from "node:path";
import { fileURLToPath } from "node:url";

/** One fixture file per conversion rule, plus sample.md / sample.txt for end-to-end checks. */
export const IMPORT_FIXTURES_DIRECTORY = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/import",
);
