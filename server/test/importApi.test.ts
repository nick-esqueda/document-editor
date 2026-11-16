import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  MAX_IMPORTED_CONTENT_BYTES,
  UPLOAD_REQUEST_HEADER,
} from "@doc-editor/shared";
import {
  createTestApp,
  logInAndGetCookie,
  useTestPool,
} from "./support/testApp";
import { IMPORT_FIXTURES_DIRECTORY } from "./support/importFixtures";
import { importFile } from "../src/import/importFile";

const DOCUMENTS_PATH = "/api/documents";
const IMPORT_PATH = `${DOCUMENTS_PATH}/import`;
const TWO_MEGABYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("upload API", () => {
  const pool = useTestPool();
  const app = createTestApp(pool);
  let aliceCookie: string;
  let bobCookie: string;

  beforeAll(async () => {
    aliceCookie = await logInAndGetCookie(app, "alice");
    bobCookie = await logInAndGetCookie(app, "bob");
  });

  function upload(
    fileName: string,
    contents: string | Buffer,
    cookie = aliceCookie,
  ) {
    const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    return request(app)
      .post(IMPORT_PATH)
      .set("Cookie", cookie)
      .set(UPLOAD_REQUEST_HEADER, "1")
      .attach("file", bytes, fileName);
  }

  function uploadFixture(fixture: string) {
    return upload(fixture, readFixture(fixture));
  }

  function readFixture(fixture: string): Buffer {
    return fs.readFileSync(path.join(IMPORT_FIXTURES_DIRECTORY, fixture));
  }

  function getDocument(documentId: string, cookie = aliceCookie) {
    return request(app)
      .get(`${DOCUMENTS_PATH}/${documentId}`)
      .set("Cookie", cookie);
  }

  async function countAliceDocuments(): Promise<number> {
    const response = await request(app)
      .get(DOCUMENTS_PATH)
      .set("Cookie", aliceCookie);
    return response.body.owned.length;
  }

  /** Runs an upload and checks it was rejected with the status and that no document was created. */
  async function expectRejectedUpload(
    runUpload: () => request.Test,
    expectedStatus: number,
  ) {
    const countBefore = await countAliceDocuments();
    const response = await runUpload();

    expect(response.status).toBe(expectedStatus);
    expect(response.body.error).toEqual(expect.any(String));
    expect(await countAliceDocuments()).toBe(countBefore);
    return response;
  }

  describe("every fixture through the real endpoint", () => {
    const fixtures = fs.readdirSync(IMPORT_FIXTURES_DIRECTORY);

    it.each(fixtures)(
      "%s is stored exactly as the converter produces it",
      async (fixture) => {
        const expected = importFile({
          originalName: fixture,
          bytes: readFixture(fixture),
        });

        const response = await uploadFixture(fixture);
        expect(response.status).toBe(201);
        expect(response.body.warnings).toBe(expected.warnings);

        const stored = await getDocument(response.body.id);
        expect(stored.body.content).toEqual(expected.content);
        expect(stored.body.title).toBe(expected.title);
      },
    );
  });

  it("imports sample.md as a new document owned by the uploader", async () => {
    const response = await uploadFixture("sample.md");
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), warnings: 0 });

    const stored = await getDocument(response.body.id);
    const storedJson = JSON.stringify(stored.body.content);
    expect(stored.body.title).toBe("sample");
    expect(stored.body.role).toBe("owner");
    expect(storedJson).toContain('"type":"heading"');
    expect(storedJson).toContain('"type":"bulletList"');
    expect(storedJson).toContain('"type":"bold"');

    const owner = await pool.query(
      `SELECT u.username FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = $1`,
      [response.body.id],
    );
    expect(owner.rows[0].username).toBe("alice");
  });

  it("keeps an imported document private to its owner", async () => {
    const response = await uploadFixture("sample.txt");
    const asBob = await getDocument(response.body.id, bobCookie);

    expect(asBob.status).toBe(404);
  });

  it("stores sample.txt as one paragraph per blank-line-separated block", async () => {
    const response = await uploadFixture("sample.txt");
    const stored = await getDocument(response.body.id);
    const blockTypes = stored.body.content.content.map(
      (block: { type: string }) => block.type,
    );

    expect(blockTypes).toEqual(["paragraph", "paragraph", "paragraph"]);
  });

  it("stores a script tag in markdown as literal text", async () => {
    const response = await uploadFixture("script-tag.md");
    const stored = await getDocument(response.body.id);

    expect(stored.body.content.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "<script>alert(1)</script>" }],
      },
    ]);
  });

  it("warns when simplifying a table and an H5, storing the H5 as H3", async () => {
    const markdown = "##### Small\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";
    const response = await upload("mixed.md", markdown);
    expect(response.status).toBe(201);
    expect(response.body.warnings).toBeGreaterThan(0);

    const stored = await getDocument(response.body.id);
    expect(stored.body.content.content[0]).toEqual({
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Small" }],
    });
  });

  it("keeps a UTF-8 file name in the title", async () => {
    const response = await upload("Café notes 🎉.md", "hi");
    const stored = await getDocument(response.body.id);

    expect(stored.body.title).toBe("Café notes 🎉");
  });

  it("keeps an imported emoji title savable as it is", async () => {
    const response = await upload(`${"🎉".repeat(150)}.md`, "hi");
    const stored = await getDocument(response.body.id);

    const save = await request(app)
      .patch(`${DOCUMENTS_PATH}/${response.body.id}`)
      .set("Cookie", aliceCookie)
      .send({ version: stored.body.version, title: stored.body.title });

    expect(stored.body.title).toBe("🎉".repeat(100));
    expect(save.status).toBe(200);
  });

  it("cuts a 250-character file name to a 200-character title", async () => {
    const response = await upload(`${"b".repeat(250)}.txt`, "hi");
    const stored = await getDocument(response.body.id);

    expect(stored.body.title).toBe("b".repeat(200));
  });

  describe("rejections (nothing is created)", () => {
    it("rejects report.docx with 400", async () => {
      const response = await expectRejectedUpload(
        () => upload("report.docx", "PK fake docx"),
        400,
      );
      expect(response.body.error).toContain("isn't supported");
    });

    it("rejects a 2 MB .md file with 413", async () => {
      await expectRejectedUpload(
        () => upload("big.md", "a".repeat(TWO_MEGABYTES)),
        413,
      );
    });

    it("rejects a PNG renamed to .txt with 400", async () => {
      const response = await expectRejectedUpload(
        () => upload("photo.txt", PNG_SIGNATURE),
        400,
      );
      expect(response.body.error).toContain("doesn't look like a text file");
    });

    it("rejects invalid UTF-8 with 400", async () => {
      await expectRejectedUpload(
        () => upload("notes.txt", Buffer.from([0x48, 0xff, 0x21])),
        400,
      );
    });

    it("rejects a file that is too large once converted with 413", async () => {
      const response = await expectRejectedUpload(
        () => upload("bullets.md", "- a\n".repeat(20_000)),
        413,
      );
      expect(response.body.error).toContain("too large once converted");
    });

    it("rejects an upload without a file with 400", async () => {
      await expectRejectedUpload(
        () =>
          request(app)
            .post(IMPORT_PATH)
            .set("Cookie", aliceCookie)
            .set(UPLOAD_REQUEST_HEADER, "1")
            .field("note", "no file here"),
        400,
      );
    });

    it("rejects two files in one upload with 400", async () => {
      await expectRejectedUpload(
        () =>
          upload("one.txt", "1").attach("file", Buffer.from("2"), "two.txt"),
        400,
      );
    });

    it("rejects text fields sent alongside the file with 400", async () => {
      await expectRejectedUpload(
        () => upload("notes.txt", "hi").field("extra", "x".repeat(100_000)),
        400,
      );
    });

    it("rejects a file in the wrong form field with 400", async () => {
      await expectRejectedUpload(
        () =>
          request(app)
            .post(IMPORT_PATH)
            .set("Cookie", aliceCookie)
            .set(UPLOAD_REQUEST_HEADER, "1")
            .attach("document", Buffer.from("hi"), "notes.txt"),
        400,
      );
    });

    it("rejects an upload without a session with 401", async () => {
      const response = await request(app)
        .post(IMPORT_PATH)
        .set(UPLOAD_REQUEST_HEADER, "1")
        .attach("file", Buffer.from("hi"), "notes.txt");

      expect(response.status).toBe(401);
    });

    it("rejects a multipart upload without the upload header with 415 (CSRF)", async () => {
      await expectRejectedUpload(
        () =>
          request(app)
            .post(IMPORT_PATH)
            .set("Cookie", aliceCookie)
            .attach("file", Buffer.from("hi"), "notes.txt"),
        415,
      );
    });

    it("still rejects multipart bodies on other routes with 415", async () => {
      const response = await request(app)
        .post(DOCUMENTS_PATH)
        .set("Cookie", aliceCookie)
        .set(UPLOAD_REQUEST_HEADER, "1")
        .attach("file", Buffer.from("hi"), "notes.txt");

      expect(response.status).toBe(415);
    });
  });

  it("imports a file just under the converted limit, which then saves normally", async () => {
    const longLine = "a".repeat(MAX_IMPORTED_CONTENT_BYTES - 200);
    const response = await upload("long.txt", longLine);
    expect(response.status).toBe(201);

    const stored = await getDocument(response.body.id);
    const save = await request(app)
      .patch(`${DOCUMENTS_PATH}/${response.body.id}`)
      .set("Cookie", aliceCookie)
      .send({
        version: stored.body.version,
        title: "x".repeat(200),
        content: stored.body.content,
      });

    expect(save.status).toBe(200);
  });
});
