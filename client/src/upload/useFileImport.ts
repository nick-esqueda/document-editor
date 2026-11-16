import { useState } from "react";
import { useNavigate } from "react-router";
import { importDocument } from "../api/documentsApi";
import { ApiError } from "../api/httpClient";
import { buildDocumentPath } from "../routes";
import { findUploadProblem } from "./checkUploadFile";
import type { ImportNotice } from "./importNotice";

const UNEXPECTED_FAILURE_MESSAGE = "The upload didn't work.";

export type ImportState =
  | { kind: "idle" }
  | { kind: "importing"; fileName: string }
  | { kind: "failed"; message: string };

/**
 * Uploads a file as a new document, then opens it in the editor.
 * The editor gets an ImportNotice in the navigation state, to show the
 * "Imported from…" banner when formatting was simplified.
 */
export function useFileImport() {
  const navigate = useNavigate();
  const [importState, setImportState] = useState<ImportState>({ kind: "idle" });

  async function importFile(file: File) {
    const problem = findUploadProblem(file);
    if (problem) {
      setImportState({ kind: "failed", message: problem });
      return;
    }

    setImportState({ kind: "importing", fileName: file.name });
    try {
      const imported = await importDocument(file);
      const notice: ImportNotice = {
        fileName: file.name,
        warnings: imported.warnings,
      };
      navigate(buildDocumentPath(imported.id), { state: notice });
    } catch (error) {
      setImportState({ kind: "failed", message: readFailureMessage(error) });
    }
  }

  function dismissImportState() {
    setImportState({ kind: "idle" });
  }

  return { importState, importFile, dismissImportState };
}

function readFailureMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_FAILURE_MESSAGE;
}
