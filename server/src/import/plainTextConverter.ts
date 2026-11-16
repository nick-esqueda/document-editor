import type { JSONContent } from "@doc-editor/shared";
import type { ConversionResult, DocumentConverter } from "./documentConverter";
import { buildTextWithLineBreaks } from "./buildTextWithLineBreaks";

/** One or more blank lines (lines may hold spaces or tabs) end a paragraph. */
const PARAGRAPH_BREAK = /\n(?:[ \t]*\n)+/;

/** Blank lines at the very start or end, including the file's final newline. */
const OUTER_BLANK_LINES = /^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g;

/**
 * Plain text: blocks separated by blank lines become paragraphs, and single
 * newlines inside a block become line breaks. Nothing is treated as markdown,
 * and spaces and tabs are kept as they are.
 */
export const plainTextConverter: DocumentConverter = {
  convert(text: string): ConversionResult {
    const trimmedText = text.replace(OUTER_BLANK_LINES, "");
    const textBlocks = trimmedText.split(PARAGRAPH_BREAK);
    const nonBlankBlocks = textBlocks.filter((block) => block.trim() !== "");
    const blocks = nonBlankBlocks.map(buildParagraph);

    return { blocks, warnings: 0 };
  },
};

function buildParagraph(textBlock: string): JSONContent {
  const lines = textBlock.split("\n");
  return { type: "paragraph", content: buildTextWithLineBreaks(lines) };
}
