import { Link } from "react-router";
import type { SharedDocumentSummary } from "@doc-editor/shared";
import { buildDocumentPath } from "../routes";
import { formatEditedTime } from "./formatEditedTime";

/** A document someone else owns. No menu: only the owner can delete it. */
export function SharedDocumentRow({
  document,
}: {
  document: SharedDocumentSummary;
}) {
  return (
    <li className="document-row">
      <span className="doc-icon" aria-hidden="true" />
      <Link className="document-title" to={buildDocumentPath(document.id)}>
        {document.title}
      </Link>
      <span className="meta">from {document.ownerName}</span>
      <span className="spacer" />
      <span className="meta">{formatEditedTime(document.updatedAt)}</span>
    </li>
  );
}
