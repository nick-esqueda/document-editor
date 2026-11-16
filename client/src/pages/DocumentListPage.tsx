import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type {
  DocumentListResponse,
  OwnedDocumentSummary,
  SharedDocumentSummary,
} from "@doc-editor/shared";
import {
  createDocument,
  deleteDocument,
  fetchDocument,
  listDocuments,
  updateDocument,
} from "../api/documentsApi";
import { AppHeader } from "../components/AppHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DocumentRow } from "../documents/DocumentRow";
import { SharedDocumentRow } from "../documents/SharedDocumentRow";
import { buildDocumentPath } from "../routes";

const LOAD_FAILED_MESSAGE =
  "Your documents couldn't be loaded. Please refresh the page.";
const ACTION_FAILED_MESSAGE = "That didn't work. Please try again.";

type OwnedDocumentsUpdate = (
  documents: OwnedDocumentSummary[],
) => OwnedDocumentSummary[];

export function DocumentListPage() {
  const navigate = useNavigate();
  const { lists, updateOwnedDocuments, errorMessage, setErrorMessage } =
    useDocumentLists();
  const [documentToDelete, setDocumentToDelete] =
    useState<OwnedDocumentSummary | null>(null);

  async function handleCreate() {
    await runAction(async () => {
      const created = await createDocument();
      navigate(buildDocumentPath(created.id));
    });
  }

  async function handleRename(document: OwnedDocumentSummary, title: string) {
    await runAction(async () => {
      const renamed = await fetchVersionThenRename(document, title);
      updateOwnedDocuments((current) => moveToTop(current, renamed));
    });
  }

  async function handleConfirmDelete() {
    const target = documentToDelete as OwnedDocumentSummary;
    setDocumentToDelete(null);

    await runAction(async () => {
      await deleteDocument(target.id);
      updateOwnedDocuments((current) =>
        current.filter((document) => document.id !== target.id),
      );
    });
  }

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);
    try {
      await action();
    } catch {
      setErrorMessage(ACTION_FAILED_MESSAGE);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="section-head">
          <h2>My documents</h2>
          <span className="spacer" />
          <button
            type="button"
            className="button primary"
            onClick={handleCreate}
          >
            + New document
          </button>
        </div>
        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}
        <OwnedDocumentList
          documents={lists?.owned ?? null}
          onRename={handleRename}
          onRequestDelete={setDocumentToDelete}
        />
        <div className="section-head shared-section-head">
          <h2>Shared with me</h2>
        </div>
        <SharedDocumentList documents={lists?.shared ?? null} />
      </main>
      {documentToDelete && (
        <ConfirmDialog
          title={`Delete "${documentToDelete.title}"?`}
          message="This permanently deletes the document for everyone it's shared with. It can't be undone."
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDocumentToDelete(null)}
        />
      )}
    </>
  );
}

interface OwnedDocumentListProps {
  documents: OwnedDocumentSummary[] | null;
  onRename: (document: OwnedDocumentSummary, title: string) => void;
  onRequestDelete: (document: OwnedDocumentSummary) => void;
}

function OwnedDocumentList({
  documents,
  onRename,
  onRequestDelete,
}: OwnedDocumentListProps) {
  if (documents === null) {
    return <p className="loading">Loading…</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        No documents yet. Click <b>New document</b> to create one.
      </div>
    );
  }

  return (
    <ul className="document-rows" aria-label="My documents">
      {documents.map((document) => (
        <DocumentRow
          key={document.id}
          document={document}
          onRename={onRename}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </ul>
  );
}

function SharedDocumentList({
  documents,
}: {
  documents: SharedDocumentSummary[] | null;
}) {
  if (documents === null) {
    return null;
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">Nothing has been shared with you yet.</div>
    );
  }

  return (
    <ul className="document-rows" aria-label="Shared with me">
      {documents.map((document) => (
        <SharedDocumentRow key={document.id} document={document} />
      ))}
    </ul>
  );
}

function useDocumentLists() {
  const [lists, setLists] = useState<DocumentListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    listDocuments()
      .then(setLists)
      .catch(() => setErrorMessage(LOAD_FAILED_MESSAGE));
  }, []);

  function updateOwnedDocuments(update: OwnedDocumentsUpdate) {
    setLists((current) =>
      current ? { ...current, owned: update(current.owned) } : current,
    );
  }

  return { lists, updateOwnedDocuments, errorMessage, setErrorMessage };
}

/** Renames need the current version for conflict checking, which the list doesn't carry. */
async function fetchVersionThenRename(
  document: OwnedDocumentSummary,
  title: string,
): Promise<OwnedDocumentSummary> {
  const current = await fetchDocument(document.id);
  const renamed = await updateDocument(document.id, {
    version: current.version,
    title,
  });

  return { ...document, title: renamed.title, updatedAt: renamed.updatedAt };
}

/** Replaces the renamed document and moves it to the top, since it was just edited. */
function moveToTop(
  documents: OwnedDocumentSummary[],
  updated: OwnedDocumentSummary,
): OwnedDocumentSummary[] {
  const others = documents.filter((document) => document.id !== updated.id);
  return [updated, ...others];
}
