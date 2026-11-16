import type { JSONContent } from "@doc-editor/shared";
import type { ConversionResult, DocumentConverter } from "./documentConverter";
import { buildTextWithLineBreaks } from "./buildTextWithLineBreaks";

/** One or more blank lines (lines may hold spaces or tabs) end a paragraph. */
const PARAGRAPH_BREAK = /\n(?:[ \t]*\n)+/;

const BLANK_LINE = /^[ \t]*$/;

/**
 * Plain text: blocks separated by blank lines become paragraphs, and single
 * newlines inside a block become line breaks. Nothing is treated as markdown,
 * and spaces and tabs are kept as they are.
 */
export const plainTextConverter: DocumentConverter = {
  convert(text: string): ConversionResult {
    const trimmedText = removeOuterBlankLines(text);
    const textBlocks = trimmedText.split(PARAGRAPH_BREAK);
    const nonBlankBlocks = textBlocks.filter((block) => block.trim() !== "");
    const blocks = nonBlankBlocks.map(buildParagraph);

    return { blocks, warnings: 0 };
  },
};

/**
 * Drops blank lines at the very start and end, including the file's final newline.
 * Done line by line rather than with a regex: an end-anchored regex like
 * /(\n[ \t]*)+$/ rescans long runs of newlines and takes quadratic time.
 */
function removeOuterBlankLines(text: string): string {
  const lines = text.split("\n");
  const firstTextLine = lines.findIndex((line) => !BLANK_LINE.test(line));

  if (firstTextLine === -1) {
    return "";
  }

  let lastTextLine = lines.length - 1;
  while (BLANK_LINE.test(lines[lastTextLine])) {
    lastTextLine -= 1;
  }

  return lines.slice(firstTextLine, lastTextLine + 1).join("\n");
}

function buildParagraph(textBlock: string): JSONContent {
  const lines = textBlock.split("\n");
  return { type: "paragraph", content: buildTextWithLineBreaks(lines) };
}
