import type { DocumentJson } from "@doc-editor/shared";

/** A document that uses every supported format once. */
export const FULLY_FORMATTED_DOCUMENT: DocumentJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Title" }],
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Small" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " italic", marks: [{ type: "italic" }] },
        { type: "text", text: " underline", marks: [{ type: "underline" }] },
        { type: "hardBreak" },
        { type: "text", text: "next line" },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "a" }] },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 1, type: null },
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "1" }] },
          ],
        },
      ],
    },
  ],
};

/** Wraps nodes in a document root. */
export function buildDocument(...nodes: unknown[]): unknown {
  return { type: "doc", content: nodes };
}

export function buildParagraph(
  text: string,
  extra: Record<string, unknown> = {},
): unknown {
  return { type: "paragraph", content: [{ type: "text", text }], ...extra };
}
