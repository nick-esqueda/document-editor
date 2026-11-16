import { Link } from "react-router";
import { HOME_PATH } from "../routes";
import type { SaveStatus } from "./AutosaveController";

interface BannerContent {
  tone: "warning" | "danger";
  message: string;
  action: "reload" | "backToDocuments";
}

/** Banners for statuses where autosave has stopped and the user needs to act. */
const BANNERS: Partial<Record<SaveStatus, BannerContent>> = {
  conflict: {
    tone: "warning",
    message:
      "This document was changed elsewhere. Your latest edits weren't saved. Copy them if you need them, then reload.",
    action: "reload",
  },
  accessLost: {
    tone: "danger",
    message: "You no longer have access to this document.",
    action: "backToDocuments",
  },
  failed: {
    tone: "danger",
    message:
      "Your latest edits couldn't be saved. Copy them if you need them, then reload.",
    action: "reload",
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
      <BannerAction action={banner.action} />
    </div>
  );
}

function BannerAction({ action }: { action: BannerContent["action"] }) {
  if (action === "backToDocuments") {
    return (
      <Link className="button" to={HOME_PATH}>
        Back to documents
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="button"
      onClick={() => window.location.reload()}
    >
      Reload
    </button>
  );
}
