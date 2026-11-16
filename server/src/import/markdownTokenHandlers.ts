import type { Token } from "markdown-it";
import { HEADING_LEVELS } from "@doc-editor/shared";
import type { MarkdownDocumentBuilder } from "./MarkdownDocumentBuilder";
import { buildTextWithLineBreaks } from "./buildTextWithLineBreaks";

/**
 * Lookup tables from markdown-it token type to what the builder should do with it.
 * Tokens with no entry are ignored. To support a new markdown feature, add its
 * token type here. Anything the editor can't show should be simplified and call
 * builder.addWarning(), so the user is told formatting was simplified.
 */
type TokenHandler = (builder: MarkdownDocumentBuilder, token: Token) => void;

const HIGHEST_HEADING_LEVEL = Math.max(...HEADING_LEVELS);

/** "[ ] todo" or "[x] done" at the start of a list item, from GitHub-style task lists. */
const TASK_LIST_MARKER = /^\[[ xX]\]\s/;

const closeNode: TokenHandler = (builder) => builder.closeNode();
const addWarning: TokenHandler = (builder) => builder.addWarning();
const ignoreToken: TokenHandler = () => {};

export const BLOCK_TOKEN_HANDLERS: Record<string, TokenHandler> = {
  paragraph_open: (builder) => builder.openNode("paragraph"),
  paragraph_close: closeNode,
  heading_open: openHeading,
  heading_close: closeNode,
  bullet_list_open: (builder) => builder.openNode("bulletList"),
  bullet_list_close: closeNode,
  ordered_list_open: openOrderedList,
  ordered_list_close: closeNode,
  list_item_open: (builder) => builder.openNode("listItem"),
  list_item_close: closeListItem,
  blockquote_open: addWarning,
  blockquote_close: ignoreToken,
  code_block: appendCodeAsParagraph,
  fence: appendCodeAsParagraph,
  hr: addWarning,
  table_open: addWarning,
  tr_open: (builder) => builder.startTableRow(),
  tr_close: closeNode,
  th_open: (builder) => builder.startTableCell(),
  td_open: (builder) => builder.startTableCell(),
  inline: appendInlineContent,
};

const INLINE_TOKEN_HANDLERS: Record<string, TokenHandler> = {
  text: (builder, token) => builder.appendText(token.content),
  strong_open: (builder) => builder.addMark("bold"),
  strong_close: (builder) => builder.removeMark("bold"),
  em_open: (builder) => builder.addMark("italic"),
  em_close: (builder) => builder.removeMark("italic"),
  s_open: addWarning,
  link_open: addWarning,
  code_inline: appendInlineCodeAsText,
  image: addWarning,
  softbreak: (builder) => builder.appendText(" "),
  hardbreak: (builder) => builder.appendNode({ type: "hardBreak" }),
};

/** H4-H6 become the highest level the editor has (H3). */
function openHeading(builder: MarkdownDocumentBuilder, token: Token): void {
  const markdownLevel = Number(token.tag.slice(1));

  if (markdownLevel > HIGHEST_HEADING_LEVEL) {
    builder.addWarning();
  }

  const level = Math.min(markdownLevel, HIGHEST_HEADING_LEVEL);
  builder.openNode("heading", { level });
}

/** markdown-it only sets "start" when a list doesn't start at 1. The editor always starts at 1. */
function openOrderedList(builder: MarkdownDocumentBuilder, token: Token): void {
  if (token.attrGet("start") !== null) {
    builder.addWarning();
  }
  builder.openNode("orderedList");
}

/** A list item must start with a paragraph in the editor, e.g. "- # Title" or an empty "-". */
function closeListItem(builder: MarkdownDocumentBuilder): void {
  const listItem = builder.currentNode;
  const firstChild = listItem.content?.[0];

  if (firstChild?.type !== "paragraph") {
    listItem.content?.unshift({ type: "paragraph" });
  }

  builder.closeNode();
}

/** Code blocks become a plain paragraph, keeping the code's lines and indentation. */
function appendCodeAsParagraph(
  builder: MarkdownDocumentBuilder,
  token: Token,
): void {
  builder.addWarning();

  const code = token.content.replace(/\n$/, "");
  if (code === "") {
    return;
  }

  const lines = code.split("\n");
  builder.appendNode({
    type: "paragraph",
    content: buildTextWithLineBreaks(lines),
  });
}

function appendInlineCodeAsText(
  builder: MarkdownDocumentBuilder,
  token: Token,
): void {
  builder.addWarning();
  builder.appendText(token.content);
}

function appendInlineContent(
  builder: MarkdownDocumentBuilder,
  token: Token,
): void {
  if (isTaskListItemText(builder, token)) {
    builder.addWarning();
  }

  for (const child of token.children ?? []) {
    INLINE_TOKEN_HANDLERS[child.type]?.(builder, child);
  }
}

/** True for the first text of a list item that starts with a task marker like "[ ]". */
function isTaskListItemText(
  builder: MarkdownDocumentBuilder,
  token: Token,
): boolean {
  const isFirstTextOfListItem =
    builder.parentNode?.type === "listItem" &&
    builder.parentNode.content?.length === 0 &&
    builder.currentNode.content?.length === 0;

  return isFirstTextOfListItem && TASK_LIST_MARKER.test(token.content);
}
