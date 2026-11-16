import { describe, expect, it } from "vitest";
import { validateDocumentContent } from "@doc-editor/shared";
import {
  buildDocument,
  buildParagraph,
  FULLY_FORMATTED_DOCUMENT,
} from "./support/documentFixtures";

function expectRejected(content: unknown, reasonPattern: RegExp) {
  const result = validateDocumentContent(content);

  expect(result.isValid).toBe(false);
  expect(result.isValid ? "" : result.reason).toMatch(reasonPattern);
}

describe("validateDocumentContent", () => {
  it("accepts a document using every supported format", () => {
    expect(validateDocumentContent(FULLY_FORMATTED_DOCUMENT)).toEqual({
      isValid: true,
    });
  });

  it.each(["script", "image", "html"])(
    "rejects an unknown %s block",
    (type) => {
      expectRejected(buildDocument({ type }), /Unknown node type/);
    },
  );

  it.each([
    ["link", { href: "https://example.com" }],
    ["strike", undefined],
  ])("rejects an unknown %s mark", (type, attrs) => {
    const text = { type: "text", text: "x", marks: [{ type, attrs }] };

    expectRejected(
      buildDocument({ type: "paragraph", content: [text] }),
      /link|strike/,
    );
  });

  it.each(["onclick", "style"])(
    "rejects an unknown %s attribute",
    (attribute) => {
      const paragraph = buildParagraph("x", {
        attrs: { [attribute]: "alert(1)" },
      });

      expectRejected(buildDocument(paragraph), /Unsupported attribute/);
    },
  );

  it.each([0, 4, 6, "1"])("rejects heading level %s", (level) => {
    expectRejected(
      buildDocument({ type: "heading", attrs: { level } }),
      /Heading level/,
    );
  });

  it("rejects a list item outside a list", () => {
    const strayListItem = { type: "listItem", content: [buildParagraph("x")] };

    expectRejected(buildDocument(strayListItem), /Invalid content/);
  });

  it.each([
    ["an array", []],
    ["a string", "<p>hi</p>"],
    ["null", null],
    ["a non-doc root", { type: "paragraph" }],
  ])("rejects %s", (_label, content) => {
    expectRejected(content, /document object/);
  });

  it.each([
    ["object content", { type: "doc", content: {} }],
    ["string content", { type: "doc", content: "abc" }],
    ["object marks", buildDocument(buildParagraph("x", { marks: {} }))],
    ["string attrs", buildDocument(buildParagraph("x", { attrs: "level" }))],
    [
      "object marks on text",
      buildDocument({
        type: "paragraph",
        content: [{ type: "text", text: "x", marks: {} }],
      }),
    ],
  ])("rejects %s without throwing", (_label, content) => {
    expectRejected(content, /Invalid attrs, marks or content/);
  });
});
