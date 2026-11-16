import type { DocumentDetails, DocumentListResponse } from "@doc-editor/shared";

export const EMPTY_DOCUMENT_LISTS: DocumentListResponse = {
  owned: [],
  shared: [],
};

export function buildDocumentDetails(
  overrides: Partial<DocumentDetails> = {},
): DocumentDetails {
  return {
    id: "doc-1",
    title: "Untitled document",
    updatedAt: new Date().toISOString(),
    version: 1,
    role: "owner",
    ownerName: "Alice",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    ...overrides,
  };
}

export function buildDocumentWithText(
  text: string,
  overrides: Partial<DocumentDetails> = {},
) {
  return buildDocumentDetails({
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    ...overrides,
  });
}
