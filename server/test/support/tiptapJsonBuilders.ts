import type { JSONContent } from "@doc-editor/shared";

/**
 * Short builders for expected Tiptap JSON in tests. They produce exactly what the
 * editor stores (e.g. ordered lists carry their default attributes).
 */
export function text(value: string, ...marks: string[]): JSONContent {
  const node: JSONContent = { type: "text", text: value };
  if (marks.length > 0) {
    node.marks = marks.map((type) => ({ type }));
  }
  return node;
}

export const lineBreak: JSONContent = { type: "hardBreak" };

export function paragraph(...content: (JSONContent | string)[]): JSONContent {
  const nodes = content.map(toNode);
  return nodes.length > 0
    ? { type: "paragraph", content: nodes }
    : { type: "paragraph" };
}

export function heading(
  level: number,
  ...content: (JSONContent | string)[]
): JSONContent {
  return { type: "heading", attrs: { level }, content: content.map(toNode) };
}

export function bulletList(...items: JSONContent[]): JSONContent {
  return { type: "bulletList", content: items };
}

export function orderedList(...items: JSONContent[]): JSONContent {
  return {
    type: "orderedList",
    attrs: { start: 1, type: null },
    content: items,
  };
}

export function listItem(...blocks: (JSONContent | string)[]): JSONContent {
  const content = blocks.map((block) =>
    typeof block === "string" ? paragraph(block) : block,
  );
  return { type: "listItem", content };
}

function toNode(content: JSONContent | string): JSONContent {
  return typeof content === "string" ? text(content) : content;
}
