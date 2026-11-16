import MarkdownIt from "markdown-it";
import type { ConversionResult, DocumentConverter } from "./documentConverter";
import { MarkdownDocumentBuilder } from "./MarkdownDocumentBuilder";
import { BLOCK_TOKEN_HANDLERS } from "./markdownTokenHandlers";

/**
 * html: false means raw HTML in the file is kept as literal text, never as markup.
 * linkify and typographer are off so text isn't changed behind the user's back.
 */
const markdownParser = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

// Links are always reduced to their text (see markdownTokenHandlers.ts), so no URL
// ever reaches the document. Accepting every URL here means "[x](javascript:...)"
// becomes the text "x" like any other link, instead of staying as raw markdown.
markdownParser.validateLink = () => true;

/**
 * Markdown: parsed by markdown-it, then its tokens are turned into Tiptap JSON
 * directly. Features the editor doesn't have are simplified and counted as warnings
 * (see markdownTokenHandlers.ts for each rule).
 */
export const markdownConverter: DocumentConverter = {
  convert(text: string): ConversionResult {
    const tokens = markdownParser.parse(text, {});
    const builder = new MarkdownDocumentBuilder();

    for (const token of tokens) {
      BLOCK_TOKEN_HANDLERS[token.type]?.(builder, token);
    }

    return { blocks: builder.readBlocks(), warnings: builder.warnings };
  },
};
