import type { SaveStatus } from "./AutosaveController";

/** What the header shows for each save status. */
const STATUS_DISPLAY: Record<SaveStatus, { text: string; className: string }> =
  {
    saved: { text: "✓ Saved", className: "is-saved" },
    unsaved: { text: "Unsaved changes", className: "is-muted" },
    saving: { text: "Saving…", className: "is-muted" },
    offline: { text: "⟳ Offline, retrying…", className: "is-warning" },
    conflict: { text: "Not saved", className: "is-danger" },
    accessLost: { text: "Not saved", className: "is-danger" },
    failed: { text: "Not saved", className: "is-danger" },
  };

export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const display = STATUS_DISPLAY[status];

  return (
    <span className={`save-status ${display.className}`} role="status">
      {display.text}
    </span>
  );
}
