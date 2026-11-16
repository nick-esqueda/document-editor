import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function listFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

/** Keeps Tab and Shift+Tab cycling inside the dialog instead of reaching the page behind it. */
function keepTabInside(dialog: HTMLElement, event: KeyboardEvent) {
  const focusable = listFocusableElements(dialog);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const isLeavingStart = event.shiftKey && document.activeElement === first;
  const isLeavingEnd = !event.shiftKey && document.activeElement === last;

  if (isLeavingStart || isLeavingEnd) {
    event.preventDefault();
    (isLeavingStart ? last : first)?.focus();
  }
}

/**
 * Makes a dialog behave as a modal for keyboard users: focus moves into it on
 * open, Tab stays inside, Escape closes it, and focus returns to whatever
 * opened it (e.g. the Share button) on close.
 */
export function useModalFocus(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    listFocusableElements(dialog)[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
      if (event.key === "Tab") {
        keepTabInside(dialog as HTMLElement, event);
      }
    }

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [dialogRef]);
}
