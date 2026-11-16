import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MAX_TITLE_LENGTH, type DocumentSummary } from "@doc-editor/shared";
import { buildDocumentPath } from "../routes";
import { formatEditedTime } from "./formatEditedTime";

interface DocumentRowProps {
  document: DocumentSummary;
  onRename: (document: DocumentSummary, title: string) => void;
  onRequestDelete: (document: DocumentSummary) => void;
}

type RowMode = "idle" | "menuOpen" | "renaming";

export function DocumentRow({
  document,
  onRename,
  onRequestDelete,
}: DocumentRowProps) {
  const [mode, setMode] = useState<RowMode>("idle");

  function handleRenameSubmit(title: string) {
    setMode("idle");
    const trimmedTitle = title.trim();

    if (trimmedTitle && trimmedTitle !== document.title) {
      onRename(document, trimmedTitle);
    }
  }

  return (
    <li className="document-row">
      <span className="doc-icon" aria-hidden="true" />
      {mode === "renaming" ? (
        <RenameForm
          initialTitle={document.title}
          onSubmit={handleRenameSubmit}
        />
      ) : (
        <Link className="document-title" to={buildDocumentPath(document.id)}>
          {document.title}
        </Link>
      )}
      <span className="spacer" />
      <span className="meta">{formatEditedTime(document.updatedAt)}</span>
      <button
        type="button"
        className="kebab"
        aria-label={`More actions for ${document.title}`}
        aria-expanded={mode === "menuOpen"}
        onClick={() => setMode(mode === "menuOpen" ? "idle" : "menuOpen")}
      >
        ⋮
      </button>
      {mode === "menuOpen" && (
        <div className="menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => setMode("renaming")}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setMode("idle");
              onRequestDelete(document);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function RenameForm({
  initialTitle,
  onSubmit,
}: {
  initialTitle: string;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  // Enter submits and then the input loses focus; only the first of the two counts.
  const hasSubmittedRef = useRef(false);

  function submitOnce() {
    if (!hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      onSubmit(title);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitOnce();
  }

  return (
    <form className="rename-form" onSubmit={handleSubmit}>
      <input
        aria-label="New title"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        autoFocus
        onChange={(event) => setTitle(event.target.value)}
        onBlur={submitOnce}
      />
    </form>
  );
}
