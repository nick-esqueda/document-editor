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
  useEffect(() => {
    controller.open();
    return () => controller.close();
  }, [controller]);
  useUnsavedChangesGuard(documentId, controller);

  return { controller, status };
}

/**
 * Warns before the tab closes with unsaved work. The last save is sent on
 * `pagehide`, once the user has actually left, so staying on the page never
 * leaves a save behind that the editor doesn't know about.
 */
function useUnsavedChangesGuard(
  documentId: string,
  controller: AutosaveController,
) {
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (controller.hasUnsavedWork()) {
        event.preventDefault();
      }
    }

    // Also resends a save still in progress, because closing the tab can cancel it.
    function handlePageHide() {
      if (controller.hasUnsavedWork()) {
        sendFinalSave(documentId, controller.readFinalSaveRequest());
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [documentId, controller]);
}
