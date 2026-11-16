import { getSchema, type AnyExtension, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

/** Heading levels the editor offers. Anything else is rejected on save. */
export const HEADING_LEVELS = [1, 2, 3] as const;

/**
 * The one list of editor features, used by the browser editor AND the server's
 * save validation, so both always agree on what a document may contain.
 * To add a feature, enable it here; the server accepts it automatically.
 */
export function createEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      link: false,
    }),
  ];
}

export const editorSchema = getSchema(createEditorExtensions());

/** Tiptap/ProseMirror JSON for a whole document. */
export type DocumentJson = JSONContent & { type: "doc" };

export const EMPTY_DOCUMENT: DocumentJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
