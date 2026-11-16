import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  editorSchema,
  MAX_IMPORTED_CONTENT_BYTES,
  type JSONContent,
} from "@doc-editor/shared";
import { importFile } from "../src/import/importFile";
import { ImportRejectedError } from "../src/import/ImportRejectedError";
import {
  bulletList,
  heading,
  lineBreak,
  listItem,
  orderedList,
  paragraph,
  text,
} from "./support/tiptapJsonBuilders";
import { IMPORT_FIXTURES_DIRECTORY } from "./support/importFixtures";

interface ConversionCase {
  fixture: string;
  expectedBlocks: JSONContent[];
  expectedWarnings: number;
}

const MARKDOWN_KEPT_CASES: ConversionCase[] = [
  {
    fixture: "headings.md",
    expectedBlocks: [heading(1, "One"), heading(2, "Two"), heading(3, "Three")],
    expectedWarnings: 0,
  },
  {
    fixture: "emphasis.md",
    expectedBlocks: [
      paragraph(
        text("bold", "bold"),
        " ",
        text("italic", "italic"),
        " ",
        text("bold", "bold"),
        " ",
        text("italic", "italic"),
      ),
    ],
    expectedWarnings: 0,
  },
  {
    fixture: "bold-and-italic.md",
    expectedBlocks: [paragraph(text("both", "bold", "italic"))],
    expectedWarnings: 0,
  },
  {
    fixture: "bullet-markers.md",
    expectedBlocks: [
      bulletList(listItem("dash")),
      bulletList(listItem("star")),
      bulletList(listItem("plus")),
    ],
    expectedWarnings: 0,
  },
  {
    fixture: "ordered-list.md",
    expectedBlocks: [orderedList(listItem("one"), listItem("two"))],
    expectedWarnings: 0,
  },
  {
    fixture: "nested-lists.md",
    expectedBlocks: [
      orderedList(listItem("first", bulletList(listItem("inner bullet")))),
      bulletList(
        listItem("outer bullet", orderedList(listItem("inner number"))),
      ),
    ],
    expectedWarnings: 0,
  },
  {
    fixture: "paragraphs.md",
    expectedBlocks: [
      paragraph("First paragraph still first."),
      paragraph("Second paragraph."),
    ],
    expectedWarnings: 0,
  },
  {
    fixture: "hard-breaks.md",
    expectedBlocks: [
      paragraph("two spaces", lineBreak, "backslash", lineBreak, "end"),
    ],
    expectedWarnings: 0,
  },
];

const MARKDOWN_SIMPLIFIED_CASES: ConversionCase[] = [
  {
    fixture: "deep-headings.md",
    expectedBlocks: [heading(3, "Four"), heading(3, "Five"), heading(3, "Six")],
    expectedWarnings: 3,
  },
  {
    fixture: "code-blocks.md",
    expectedBlocks: [
      paragraph("const a = 1;", lineBreak, lineBreak, "  indented();"),
      paragraph("indented code", lineBreak, "second line"),
    ],
    expectedWarnings: 2,
  },
  {
    fixture: "inline-code.md",
    expectedBlocks: [paragraph("Run npm test now")],
    expectedWarnings: 1,
  },
  {
    fixture: "blockquote.md",
    expectedBlocks: [paragraph("quoted text")],
    expectedWarnings: 1,
  },
  {
    fixture: "link.md",
    expectedBlocks: [paragraph("See the site here")],
    expectedWarnings: 1,
  },
  {
    fixture: "image.md",
    expectedBlocks: [paragraph("Before"), paragraph("After")],
    expectedWarnings: 1,
  },
  {
    fixture: "table.md",
    expectedBlocks: [
      paragraph("Name | Role"),
      paragraph("Ann | ", text("Lead", "bold")),
      paragraph(" | Dev"),
    ],
    expectedWarnings: 1,
  },
  {
    fixture: "strikethrough.md",
    expectedBlocks: [paragraph("strike")],
    expectedWarnings: 1,
  },
  {
    fixture: "horizontal-rule.md",
    expectedBlocks: [paragraph("Above"), paragraph("Below")],
    expectedWarnings: 1,
  },
  {
    fixture: "task-list.md",
    expectedBlocks: [bulletList(listItem("[ ] todo"), listItem("[x] done"))],
    expectedWarnings: 2,
  },
  {
    fixture: "ordered-list-start.md",
    expectedBlocks: [orderedList(listItem("three"), listItem("four"))],
    expectedWarnings: 1,
  },
];

const MARKDOWN_SAFETY_CASES: ConversionCase[] = [
  {
    fixture: "script-tag.md",
    expectedBlocks: [paragraph("<script>alert(1)</script>")],
    expectedWarnings: 0,
  },
  {
    fixture: "img-onerror.md",
    expectedBlocks: [paragraph("<img src=x onerror=alert(1)>")],
    expectedWarnings: 0,
  },
  {
    fixture: "underline-tag.md",
    expectedBlocks: [paragraph("<u>under</u>")],
    expectedWarnings: 0,
  },
  {
    fixture: "bold-tag.md",
    expectedBlocks: [paragraph("<b>bold?</b>")],
    expectedWarnings: 0,
  },
  {
    fixture: "javascript-link.md",
    expectedBlocks: [paragraph("x")],
    expectedWarnings: 1,
  },
];

const PLAIN_TEXT_CASES: ConversionCase[] = [
  {
    fixture: "paragraphs.txt",
    expectedBlocks: [
      paragraph("First paragraph."),
      paragraph("Second paragraph."),
    ],
    expectedWarnings: 0,
  },
  {
    fixture: "line-breaks.txt",
    expectedBlocks: [paragraph("line one", lineBreak, "line two")],
    expectedWarnings: 0,
  },
  {
    fixture: "blank-lines.txt",
    expectedBlocks: [paragraph("A"), paragraph("B")],
    expectedWarnings: 0,
  },
  {
    fixture: "markdown-syntax.txt",
    expectedBlocks: [paragraph("# not a heading"), paragraph("**not bold**")],
    expectedWarnings: 0,
  },
  {
    fixture: "whitespace.txt",
    expectedBlocks: [paragraph("  indented", lineBreak, "\ttabbed  ")],
    expectedWarnings: 0,
  },
  {
    fixture: "unicode.txt",
    expectedBlocks: [paragraph("Café naïve 🎉 日本語")],
    expectedWarnings: 0,
  },
];

const ALL_CONVERSION_CASES = [
  ...MARKDOWN_KEPT_CASES,
  ...MARKDOWN_SIMPLIFIED_CASES,
  ...MARKDOWN_SAFETY_CASES,
  ...PLAIN_TEXT_CASES,
];

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const INVALID_UTF8 = Buffer.from([0x48, 0x69, 0xff, 0xfe, 0x21]);

function readFixture(fixture: string): Buffer {
  return fs.readFileSync(path.join(IMPORT_FIXTURES_DIRECTORY, fixture));
}

function importText(fileName: string, contents: string | Buffer) {
  const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  return importFile({ originalName: fileName, bytes });
}

function expectRejection(
  fileName: string,
  contents: string | Buffer,
  expectedStatus: number,
): void {
  const runImport = () => importText(fileName, contents);
  expect(runImport).toThrow(ImportRejectedError);

  try {
    runImport();
  } catch (error) {
    expect((error as ImportRejectedError).status).toBe(expectedStatus);
  }
}

/** Every node and mark type used anywhere in the document. */
function collectTypes(
  node: JSONContent,
  types = new Set<string>(),
): Set<string> {
  types.add(node.type ?? "");
  node.marks?.forEach((mark) => types.add(mark.type));
  node.content?.forEach((child) => collectTypes(child, types));
  return types;
}

function describeCases(title: string, cases: ConversionCase[]): void {
  describe(title, () => {
    it.each(cases)(
      "$fixture",
      ({ fixture, expectedBlocks, expectedWarnings }) => {
        const imported = importFile({
          originalName: fixture,
          bytes: readFixture(fixture),
        });

        expect(imported.content).toEqual({
          type: "doc",
          content: expectedBlocks,
        });
        expect(imported.warnings).toBe(expectedWarnings);
      },
    );
  });
}

describeCases("markdown: kept as-is", MARKDOWN_KEPT_CASES);
describeCases("markdown: simplified with a warning", MARKDOWN_SIMPLIFIED_CASES);
describeCases("markdown: safety", MARKDOWN_SAFETY_CASES);
describeCases("plain text", PLAIN_TEXT_CASES);

describe("every fixture", () => {
  const schemaTypes = new Set([
    ...Object.keys(editorSchema.nodes),
    ...Object.keys(editorSchema.marks),
  ]);
  const fixtures = fs.readdirSync(IMPORT_FIXTURES_DIRECTORY);

  it.each(fixtures)("%s only uses editor schema types", (fixture) => {
    const imported = importText(fixture, readFixture(fixture));
    const usedTypes = [...collectTypes(imported.content)];

    expect(usedTypes.filter((type) => !schemaTypes.has(type))).toEqual([]);
  });

  it("has a conversion case for every rule fixture", () => {
    const coveredFixtures = ALL_CONVERSION_CASES.map((c) => c.fixture);
    const ruleFixtures = fixtures.filter((name) => !name.startsWith("sample."));

    expect(coveredFixtures.sort()).toEqual(ruleFixtures.sort());
  });
});

describe("plain text: encodings and line endings", () => {
  it("gives the same result for CRLF (Windows) line endings as for LF", () => {
    const lf = importText("notes.txt", "a\nb\n\nc\n");
    const crlf = importText("notes.txt", "a\r\nb\r\n\r\nc\r\n");

    expect(crlf.content).toEqual(lf.content);
  });

  it("removes a UTF-8 byte order mark and keeps the text unchanged", () => {
    const withBom = Buffer.concat([UTF8_BOM, Buffer.from("Hello")]);
    const imported = importText("notes.txt", withBom);

    expect(imported.content).toEqual({
      type: "doc",
      content: [paragraph("Hello")],
    });
  });
});

describe("both types: edge cases", () => {
  it.each(["empty.txt", "empty.md"])(
    "turns an empty file (%s) into one empty paragraph",
    (fileName) => {
      const imported = importText(fileName, "");
      expect(imported.content).toEqual({ type: "doc", content: [paragraph()] });
    },
  );

  it.each(["blank.txt", "blank.md"])(
    "turns a whitespace-only file (%s) into one empty paragraph",
    (fileName) => {
      const imported = importText(fileName, "  \n\t\n\n   ");
      expect(imported.content).toEqual({ type: "doc", content: [paragraph()] });
    },
  );

  it.each(["image.txt", "image.md"])(
    "rejects a binary file renamed to %s with 400",
    (fileName) => expectRejection(fileName, PNG_SIGNATURE, 400),
  );

  it("rejects invalid UTF-8 with 400", () => {
    expectRejection("notes.txt", INVALID_UTF8, 400);
  });

  it.each(["report.docx", "notes.pdf", "page.html", "no-extension"])(
    "rejects an unsupported file type (%s) with 400",
    (fileName) => expectRejection(fileName, "hello", 400),
  );

  it("rejects content over the save limit once converted with 413", () => {
    const manyBullets = "- a\n".repeat(20_000);
    expectRejection("bullets.md", manyBullets, 413);
  });

  it("accepts content just under the save limit once converted", () => {
    const longLine = "a".repeat(MAX_IMPORTED_CONTENT_BYTES - 200);
    const imported = importText("long.txt", longLine);
    const contentBytes = Buffer.byteLength(JSON.stringify(imported.content));

    expect(contentBytes).toBeLessThanOrEqual(MAX_IMPORTED_CONTENT_BYTES);
  });

  it("treats an uppercase extension (notes.MD) as markdown", () => {
    const imported = importText("notes.MD", "# Title");
    expect(imported.content.content).toEqual([heading(1, "Title")]);
  });
});

describe("title from the file name", () => {
  it.each([
    ["meeting-notes.md", "meeting-notes"],
    ["  spaced name  .txt", "spaced name"],
    ["archive.backup.md", "archive.backup"],
    [".md", "Untitled document"],
    ["   .txt", "Untitled document"],
    ["Café 🎉.md", "Café 🎉"],
  ])("%s → %s", (fileName, expectedTitle) => {
    expect(importText(fileName, "x").title).toBe(expectedTitle);
  });

  it("cuts a long file name to 200 characters", () => {
    const longName = `${"a".repeat(250)}.md`;
    expect(importText(longName, "x").title).toBe("a".repeat(200));
  });

  it("counts characters, not bytes, when cutting (emoji stay whole)", () => {
    const emojiName = `${"🎉".repeat(250)}.txt`;
    const title = importText(emojiName, "x").title;

    expect(Array.from(title)).toHaveLength(200);
    expect(title).toBe("🎉".repeat(200));
  });
});
