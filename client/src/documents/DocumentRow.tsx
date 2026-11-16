import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Link } from "react-router";
import {
  MAX_TITLE_LENGTH,
  type OwnedDocumentSummary,
} from "@doc-editor/shared";
import { buildDocumentPath } from "../routes";
import { formatEditedTime } from "./formatEditedTime";

interface DocumentRowProps {
  document: OwnedDocumentSummary;
  onRename: (document: OwnedDocumentSummary, title: string) => void;
  onRequestShare: (document: OwnedDocumentSummary) => void;
  onRequestDelete: (document: OwnedDocumentSummary) => void;
}

type RowMode = "idle" | "menuOpen" | "renaming";

export function DocumentRow({
  document,
  onRename,
  onRequestShare,
  onRequestDelete,
}: DocumentRowProps) {
  const [mode, setMode] = useState<RowMode>("idle");
  const kebabRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAreaRefs] = useState(() => [kebabRef, menuRef]);
  const closeMenu = useCallback(() => setMode("idle"), []);
  useCloseMenuOnOutsideClick(mode === "menuOpen", menuAreaRefs, closeMenu);

  // The menu item disappears, so focus the ⋮ button first: the dialog returns focus there on close.
  function closeMenuBeforeDialog() {
    kebabRef.current?.focus();
    setMode("idle");
  }

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
      {document.sharedWithCount > 0 && (
        <span className="pill">👥 Shared with {document.sharedWithCount}</span>
      )}
      <span className="spacer" />
      <span className="meta">{formatEditedTime(document.updatedAt)}</span>
      <button
        type="button"
        className="kebab"
        ref={kebabRef}
        aria-label={`More actions for ${document.title}`}
        aria-expanded={mode === "menuOpen"}
        onClick={() => setMode(mode === "menuOpen" ? "idle" : "menuOpen")}
      >
        ⋮
      </button>
      {mode === "menuOpen" && (
        <div className="menu" role="menu" ref={menuRef}>
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
            onClick={() => {
              closeMenuBeforeDialog();
              onRequestShare(document);
            }}
          >
            Share
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              closeMenuBeforeDialog();
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

/** While the menu is open, closes it on a click outside it (or its button) or on Escape. */
function useCloseMenuOnOutsideClick(
  isMenuOpen: boolean,
  menuAreaRefs: Array<RefObject<HTMLElement | null>>,
  closeMenu: () => void,
) {
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const isInsideMenuArea = menuAreaRefs.some((ref) =>
        ref.current?.contains(event.target as Node),
      );

      if (!isInsideMenuArea) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.document.addEventListener("pointerdown", handlePointerDown);
    window.document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.document.removeEventListener("pointerdown", handlePointerDown);
      window.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, menuAreaRefs, closeMenu]);
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
