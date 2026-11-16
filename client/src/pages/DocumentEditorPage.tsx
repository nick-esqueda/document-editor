import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { DocumentDetails } from "@doc-editor/shared";
import { fetchDocument } from "../api/documentsApi";
import { ApiError } from "../api/httpClient";
import { DocumentEditor } from "../editor/DocumentEditor";
import { HOME_PATH } from "../routes";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; document: DocumentDetails }
  | { kind: "notFound" }
  | { kind: "error" };

const NOT_FOUND_STATUS = 404;

export function DocumentEditorPage() {
  const { documentId = "" } = useParams();

  // Keyed by id so opening another document starts again from "loading".
  return <DocumentLoader key={documentId} documentId={documentId} />;
}

function DocumentLoader({ documentId }: { documentId: string }) {
  const loadState = useDocument(documentId);

  if (loadState.kind === "loading") {
    return <p className="loading">Loading…</p>;
  }

  if (loadState.kind === "loaded") {
    return <DocumentEditor document={loadState.document} />;
  }

  const message =
    loadState.kind === "notFound"
      ? "This document doesn't exist, or you don't have access to it."
      : "The document couldn't be loaded. Please try again.";

  return (
    <main className="page message-page">
      <h2>
        {loadState.kind === "notFound"
          ? "Document not found"
          : "Something went wrong"}
      </h2>
      <p className="hint">{message}</p>
      <Link className="button" to={HOME_PATH}>
        Back to documents
      </Link>
    </main>
  );
}

function useDocument(documentId: string): LoadState {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let isCurrent = true;

    fetchDocument(documentId)
      .then(
        (document) => isCurrent && setLoadState({ kind: "loaded", document }),
      )
      .catch((error) => {
        const isNotFound =
          error instanceof ApiError && error.status === NOT_FOUND_STATUS;
        if (isCurrent) {
          setLoadState({ kind: isNotFound ? "notFound" : "error" });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [documentId]);

  return loadState;
}
