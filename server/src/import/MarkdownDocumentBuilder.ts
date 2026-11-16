import type { JSONContent } from "@doc-editor/shared";

export type MarkName = "bold" | "italic";

const ROOT_NODE_TYPE = "doc";

/**
 * Builds Tiptap JSON while markdown tokens are read in order (builder pattern).
 * Opening a node pushes it on a stack; closing it pops it and adds it to its parent.
 * Text added while marks are active gets those marks.
 * Token handlers in markdownTokenHandlers.ts drive it; to support a new token,
 * add a handler there that uses these methods.
 */
export class MarkdownDocumentBuilder {
  private readonly openNodes: JSONContent[] = [
    { type: ROOT_NODE_TYPE, content: [] },
  ];
  private readonly activeMarks = new Set<MarkName>();
  private tableCellsInRow = 0;
  private warningCount = 0;

  get warnings(): number {
    return this.warningCount;
  }

  /** The node new content goes into. */
  get currentNode(): JSONContent {
    return this.openNodes[this.openNodes.length - 1];
  }

  /** The node that holds currentNode, or undefined at the top level. */
  get parentNode(): JSONContent | undefined {
    return this.openNodes[this.openNodes.length - 2];
  }

  addWarning(): void {
    this.warningCount += 1;
  }

  openNode(type: string, attrs?: Record<string, unknown>): void {
    const node: JSONContent = { type, content: [] };
    if (attrs) {
      node.attrs = attrs;
    }
    this.openNodes.push(node);
  }

  /** Finishes the current node. Empty paragraphs are dropped, except where a list item needs one. */
  closeNode(): void {
    const node = this.openNodes.pop();
    const isEmptyParagraph =
      node?.type === "paragraph" && !node.content?.length;
    const isInListItem = this.currentNode.type === "listItem";

    if (node && (!isEmptyParagraph || isInListItem)) {
      this.appendNode(node);
    }
  }

  appendNode(node: JSONContent): void {
    this.currentNode.content?.push(node);
  }

  /** Adds text with the active marks. Empty text is skipped, since Tiptap doesn't allow it. */
  appendText(text: string): void {
    if (text === "") {
      return;
    }

    const textNode: JSONContent = { type: "text", text };
    const marks = Array.from(this.activeMarks, (type) => ({ type }));
    if (marks.length > 0) {
      textNode.marks = marks;
    }

    this.appendNode(textNode);
  }

  addMark(mark: MarkName): void {
    this.activeMarks.add(mark);
  }

  removeMark(mark: MarkName): void {
    this.activeMarks.delete(mark);
  }

  /** A table row becomes one paragraph. */
  startTableRow(): void {
    this.openNode("paragraph");
    this.tableCellsInRow = 0;
  }

  /** Cells after the first in a row are separated by " | ". */
  startTableCell(): void {
    if (this.tableCellsInRow > 0) {
      this.appendText(" | ");
    }
    this.tableCellsInRow += 1;
  }

  /** The top-level blocks built so far. */
  readBlocks(): JSONContent[] {
    return this.openNodes[0].content ?? [];
  }
}
