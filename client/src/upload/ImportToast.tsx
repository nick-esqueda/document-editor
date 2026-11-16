import type { ImportState } from "./useFileImport";
import { UPLOAD_ADVICE } from "./checkUploadFile";

interface ImportToastProps {
  importState: ImportState;
  onDismiss: () => void;
}

/** Bottom-of-page message while a file imports, or when the import failed. */
export function ImportToast({ importState, onDismiss }: ImportToastProps) {
  if (importState.kind === "importing") {
    return (
      <div className="toast" role="status">
        <span aria-hidden="true">⏳</span>
        <span>
          Importing <b>{importState.fileName}</b>…
        </span>
      </div>
    );
  }

  if (importState.kind === "failed") {
    return (
      <div className="toast is-danger" role="alert">
        <button
          type="button"
          className="toast-close"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          ✕
        </button>
        <span>
          <b>{importState.message}</b>
          <br />
          {UPLOAD_ADVICE}
        </span>
      </div>
    );
  }

  return null;
}
