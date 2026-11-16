import { useEffect, useState } from "react";
import { sendFinalSave, updateDocument } from "../api/documentsApi";
import { AutosaveController, type SaveStatus } from "./AutosaveController";

/** Creates one AutosaveController per open document and exposes its status to React. */
export function useAutosave(documentId: string, initialVersion: number) {
  const [controller] = useState(
    () =>
      new AutosaveController(initialVersion, (changes) =>
        updateDocument(documentId, changes),
      ),
  );
  const [status, setStatus] = useState<SaveStatus>(controller.getStatus());

  useEffect(() => controller.onStatusChange(setStatus), [controller]);
  useEffect(() => () => controller.dispose(), [controller]);
  useUnsavedChangesGuard(documentId, controller);

  return { controller, status };
}

/** Warns before leaving with unsaved edits, and sends them one last time as the tab closes. */
function useUnsavedChangesGuard(
  documentId: string,
  controller: AutosaveController,
) {
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!controller.hasUnsavedWork()) {
        return;
      }

      if (controller.hasUnsavedChanges()) {
        sendFinalSave(documentId, controller.readPendingRequest());
      }
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [documentId, controller]);
}
