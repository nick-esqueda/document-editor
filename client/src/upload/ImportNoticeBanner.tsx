import { useState } from "react";
import type { ImportNotice } from "./importNotice";

/** Shown at the top of a just-imported document when some formatting was simplified. */
export function ImportNoticeBanner({
  notice,
}: {
  notice: ImportNotice | null;
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const hasSimplifiedFormatting = (notice?.warnings ?? 0) > 0;

  if (!notice || !hasSimplifiedFormatting || isDismissed) {
    return null;
  }

  return (
    <div className="banner is-info">
      <span aria-hidden="true">ℹ</span>
      <span>
        Imported from <b>{notice.fileName}</b>. Some formatting wasn't supported
        and was simplified.
      </span>
      <span className="spacer" />
      <button
        type="button"
        className="button ghost"
        aria-label="Dismiss import note"
        onClick={() => setIsDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
