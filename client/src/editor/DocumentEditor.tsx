import { useState, type MouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Link, useNavigate } from "react-router";
import {
  createEditorExtensions,
  type DocumentDetails,
  type DocumentJson,
} from "@doc-editor/shared";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HOME_PATH } from "../routes";
import { ShareDialog } from "../sharing/ShareDialog";
import { EditorToolbar } from "./EditorToolbar";
import { EditorBanner } from "./EditorBanner";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { TitleInput } from "./TitleInput";
import { useAutosave } from "./useAutosave";
import { ImportNoticeBanner } from "../upload/ImportNoticeBanner";
import type { ImportNotice } from "../upload/importNotice";

/** The editing screen for one loaded document: header, toolbar and the page. */
interface DocumentEditorProps {
  document: DocumentDetails;
  /** Set right after the document was created from an uploaded file. */
  importNotice?: ImportNotice | null;
}

export function DocumentEditor({
  document,
  importNotice = null,
}: DocumentEditorProps) {
  const { controller, status } = useAutosave(document.id, document.version);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [title, setTitle] = useState(document.title);
  const isOwner = document.role === "owner";
  const navigate = useNavigate();

  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: document.content,
    editorProps: {
      attributes: { class: "editor-page", "aria-label": "Document content" },
    },
    onUpdate: ({ editor: changedEditor }) =>
      controller.recordChange({
        content: changedEditor.getJSON() as DocumentJson,
      }),
  });

  function handleTitleCommit(newTitle: string) {
    setTitle(newTitle);
    controller.recordChange({ title: newTitle });
    void controller.saveNow();
  }

  // Unsaved edits are sent when the editor closes, unless saving is failing; then ask first.
  function handleBackClick(event: MouseEvent) {
    if (controller.hasChangesAtRisk()) {
      event.preventDefault();
      setIsLeaveDialogOpen(true);
    }
  }

  return (
    <div className="editor-screen">
      <header className="editor-bar">
        <Link className="button ghost" to={HOME_PATH} onClick={handleBackClick}>
          ← Documents
        </Link>
        <TitleInput
          initialTitle={document.title}
          onCommit={handleTitleCommit}
        />
        {!isOwner && (
          <span className="pill">Owned by {document.ownerName}</span>
        )}
        <span className="spacer" />
        {isOwner && (
          <button
            type="button"
            className="button primary"
            onClick={() => setIsShareDialogOpen(true)}
          >
            Share
          </button>
        )}
        <SaveStatusIndicator status={status} />
      </header>
      <EditorBanner status={status} />
      <ImportNoticeBanner notice={importNotice} />
      {editor && <EditorToolbar editor={editor} />}
      <main className="editor-canvas">
        <EditorContent editor={editor} />
      </main>
      {isShareDialogOpen && (
        <ShareDialog
          documentId={document.id}
          documentTitle={title}
          onClose={() => setIsShareDialogOpen(false)}
        />
      )}
      {isLeaveDialogOpen && (
        <ConfirmDialog
          title="Leave without saving?"
          message="Your latest changes couldn't be saved and will be lost if you leave."
          confirmLabel="Leave"
          onConfirm={() => navigate(HOME_PATH)}
          onCancel={() => setIsLeaveDialogOpen(false)}
        />
      )}
    </div>
  );
}
