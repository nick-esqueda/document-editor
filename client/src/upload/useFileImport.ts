import { useEffect, useRef, useState } from "react";
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
 * One import runs at a time, and a finished import is ignored once the user
 * has left the page, so it never pulls them away from where they went.
 */
export function useFileImport() {
  const navigate = useNavigate();
  const [importState, setImportState] = useState<ImportState>({ kind: "idle" });
  const isImporting = useRef(false);
  const isMounted = useIsMounted();

  async function importFile(file: File) {
    if (isImporting.current) {
      return;
    }

    const problem = findUploadProblem(file);
    if (problem) {
      setImportState({ kind: "failed", message: problem });
      return;
    }

    isImporting.current = true;
    setImportState({ kind: "importing", fileName: file.name });
    try {
      await uploadThenOpen(file);
    } finally {
      isImporting.current = false;
    }
  }

  async function uploadThenOpen(file: File) {
    try {
      const imported = await importDocument(file);
      const notice: ImportNotice = {
        fileName: file.name,
        warnings: imported.warnings,
      };
      if (isMounted.current) {
        navigate(buildDocumentPath(imported.id), { state: notice });
      }
    } catch (error) {
      if (isMounted.current) {
        setImportState({ kind: "failed", message: readFailureMessage(error) });
      }
    }
  }

  function dismissImportState() {
    setImportState({ kind: "idle" });
  }

  return { importState, importFile, dismissImportState };
}

/** A ref that is true while the component is on the page. */
function useIsMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

function readFailureMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_FAILURE_MESSAGE;
}
