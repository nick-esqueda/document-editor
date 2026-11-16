import type { SaveStatus } from "./AutosaveController";

interface BannerContent {
  tone: "warning" | "danger";
  message: string;
  actionLabel: string;
}

/** Banners for statuses where autosave has stopped and the user needs to act. */
const BANNERS: Partial<Record<SaveStatus, BannerContent>> = {
  conflict: {
    tone: "warning",
    message:
      "This document was changed elsewhere. Your latest edits weren't saved. Copy them if you need them, then reload.",
    actionLabel: "Reload",
  },
  accessLost: {
    tone: "danger",
    message: "You no longer have access to this document.",
    actionLabel: "Reload",
  },
  failed: {
    tone: "danger",
    message:
      "Your latest edits couldn't be saved. Copy them if you need them, then reload.",
    actionLabel: "Reload",
  },
};

export function EditorBanner({ status }: { status: SaveStatus }) {
  const banner = BANNERS[status];

  if (!banner) {
    return null;
  }

  return (
    <div className={`banner is-${banner.tone}`} role="alert">
      <span>{banner.message}</span>
      <span className="spacer" />
      <button
        type="button"
        className="button"
        onClick={() => window.location.reload()}
      >
        {banner.actionLabel}
      </button>
    </div>
  );
}
