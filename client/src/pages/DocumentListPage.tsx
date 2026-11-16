import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { DocumentSummary } from "@doc-editor/shared";
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
import { buildDocumentPath } from "../routes";

const LOAD_FAILED_MESSAGE =
  "Your documents couldn't be loaded. Please refresh the page.";
const ACTION_FAILED_MESSAGE = "That didn't work. Please try again.";

export function DocumentListPage() {
  const navigate = useNavigate();
  const { documents, setDocuments, errorMessage, setErrorMessage } =
    useDocumentList();
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentSummary | null>(null);

  async function handleCreate() {
    await runAction(async () => {
      const created = await createDocument();
      navigate(buildDocumentPath(created.id));
    });
  }

  async function handleRename(document: DocumentSummary, title: string) {
    await runAction(async () => {
      const full = await fetchVersionThenRename(document.id, title);
      setDocuments((current) => replaceDocument(current ?? [], full));
    });
  }

  async function handleConfirmDelete() {
    const target = documentToDelete as DocumentSummary;
    setDocumentToDelete(null);

    await runAction(async () => {
      await deleteDocument(target.id);
      setDocuments((current) =>
        (current ?? []).filter((document) => document.id !== target.id),
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
        <DocumentListBody
          documents={documents}
          onRename={handleRename}
          onRequestDelete={setDocumentToDelete}
        />
      </main>
      {documentToDelete && (
        <ConfirmDialog
          title={`Delete "${documentToDelete.title}"?`}
          message="This permanently deletes the document. It can't be undone."
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDocumentToDelete(null)}
        />
      )}
    </>
  );
}

interface DocumentListBodyProps {
  documents: DocumentSummary[] | null;
  onRename: (document: DocumentSummary, title: string) => void;
  onRequestDelete: (document: DocumentSummary) => void;
}

function DocumentListBody({
  documents,
  onRename,
  onRequestDelete,
}: DocumentListBodyProps) {
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
    <ul className="document-rows">
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

function useDocumentList() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch(() => setErrorMessage(LOAD_FAILED_MESSAGE));
  }, []);

  return { documents, setDocuments, errorMessage, setErrorMessage };
}

/** Renames need the current version for conflict checking, which the list doesn't carry. */
async function fetchVersionThenRename(
  documentId: string,
  title: string,
): Promise<DocumentSummary> {
  const current = await fetchDocument(documentId);
  return updateDocument(documentId, { version: current.version, title });
}

/** Replaces the renamed document and moves it to the top, since it was just edited. */
function replaceDocument(
  documents: DocumentSummary[],
  updated: DocumentSummary,
): DocumentSummary[] {
  const others = documents.filter((document) => document.id !== updated.id);
  const { id, title, updatedAt } = updated;
  return [{ id, title, updatedAt }, ...others];
}
