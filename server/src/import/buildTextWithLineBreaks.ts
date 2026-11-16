import type { JSONContent } from "@doc-editor/shared";

/** Inline content for lines of text with a line break between each. Empty lines add only the break. */
export function buildTextWithLineBreaks(lines: string[]): JSONContent[] {
  const content: JSONContent[] = [];

  lines.forEach((line, index) => {
    if (index > 0) {
      content.push({ type: "hardBreak" });
    }
    if (line !== "") {
      content.push({ type: "text", text: line });
    }
  });

  return content;
}
