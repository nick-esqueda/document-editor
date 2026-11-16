import { EditorContent, useEditor } from "@tiptap/react";
import { Link } from "react-router";
import {
  createEditorExtensions,
  type DocumentDetails,
  type DocumentJson,
} from "@doc-editor/shared";
import { HOME_PATH } from "../routes";
import { EditorToolbar } from "./EditorToolbar";
import { EditorBanner } from "./EditorBanner";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { TitleInput } from "./TitleInput";
import { useAutosave } from "./useAutosave";

/** The editing screen for one loaded document: header, toolbar and the page. */
export function DocumentEditor({ document }: { document: DocumentDetails }) {
  const { controller, status } = useAutosave(document.id, document.version);

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

  function handleTitleCommit(title: string) {
    controller.recordChange({ title });
    void controller.saveNow();
  }

  return (
    <div className="editor-screen">
      <header className="editor-bar">
        <Link className="button ghost" to={HOME_PATH}>
          ← Documents
        </Link>
        <TitleInput
          initialTitle={document.title}
          onCommit={handleTitleCommit}
        />
        <span className="spacer" />
        <SaveStatusIndicator status={status} />
      </header>
      <EditorBanner status={status} />
      {editor && <EditorToolbar editor={editor} />}
      <main className="editor-canvas">
        <EditorContent editor={editor} />
      </main>
    </div>
  );
}
