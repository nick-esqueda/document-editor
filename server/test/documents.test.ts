import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  createTestApp,
  logInAndGetCookie,
  useTestPool,
} from "./support/testApp";
import {
  buildDocument,
  buildParagraph,
  FULLY_FORMATTED_DOCUMENT,
} from "./support/documentFixtures";

const DOCUMENTS_PATH = "/api/documents";
const MISSING_DOCUMENT_ID = "00000000-0000-4000-8000-000000000000";
const ONE_MEGABYTE = 1024 * 1024;

describe("documents API", () => {
  const pool = useTestPool();
  const app = createTestApp(pool);
  let aliceCookie: string;
  let bobCookie: string;

  beforeAll(async () => {
    aliceCookie = await logInAndGetCookie(app, "alice");
    bobCookie = await logInAndGetCookie(app, "bob");
  });

  async function createDocumentAs(cookie: string) {
    const response = await request(app)
      .post(DOCUMENTS_PATH)
      .set("Cookie", cookie);
    return response.body;
  }

  function saveDocument(cookie: string, documentId: string, body: object) {
    return request(app)
      .patch(`${DOCUMENTS_PATH}/${documentId}`)
      .set("Cookie", cookie)
      .send(body);
  }

  async function readOwnerId(documentId: string): Promise<string> {
    const result = await pool.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [documentId],
    );
    return result.rows[0].owner_id;
  }

  async function readUserId(username: string): Promise<string> {
    const result = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    return result.rows[0].id;
  }

  it.each([
    ["get", DOCUMENTS_PATH],
    ["post", DOCUMENTS_PATH],
    ["get", `${DOCUMENTS_PATH}/${MISSING_DOCUMENT_ID}`],
    ["patch", `${DOCUMENTS_PATH}/${MISSING_DOCUMENT_ID}`],
    ["delete", `${DOCUMENTS_PATH}/${MISSING_DOCUMENT_ID}`],
  ] as const)("%s %s returns 401 when logged out", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
  });

  it("creates an untitled, empty, version 1 document owned by the caller", async () => {
    const response = await request(app)
      .post(DOCUMENTS_PATH)
      .set("Cookie", aliceCookie);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      title: "Untitled document",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      version: 1,
    });
    expect(response.body).not.toHaveProperty("ownerId");
    expect(await readOwnerId(response.body.id)).toBe(await readUserId("alice"));
  });

  it("ignores an owner or user id sent when creating", async () => {
    const bobId = await readUserId("bob");

    const response = await request(app)
      .post(DOCUMENTS_PATH)
      .set("Cookie", aliceCookie)
      .send({ ownerId: bobId, owner_id: bobId, userId: bobId });

    expect(await readOwnerId(response.body.id)).toBe(await readUserId("alice"));
  });

  it("lists only the caller's documents, most recently edited first, without content", async () => {
    const older = await createDocumentAs(aliceCookie);
    const newer = await createDocumentAs(aliceCookie);
    const bobsDocument = await createDocumentAs(bobCookie);
    await saveDocument(aliceCookie, older.id, {
      version: 1,
      title: "Edited last",
    });

    const response = await request(app)
      .get(DOCUMENTS_PATH)
      .set("Cookie", aliceCookie);
    const ids = response.body.map((document: { id: string }) => document.id);

    expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
    expect(ids).not.toContain(bobsDocument.id);
    expect(response.body[0]).toEqual({
      id: older.id,
      title: "Edited last",
      updatedAt: expect.any(String),
    });
  });

  it("opens the caller's document with title, content and version", async () => {
    const created = await createDocumentAs(aliceCookie);

    const response = await request(app)
      .get(`${DOCUMENTS_PATH}/${created.id}`)
      .set("Cookie", aliceCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created);
  });

  it("renames, bumping the version and the edited time", async () => {
    const created = await createDocumentAs(aliceCookie);

    const response = await saveDocument(aliceCookie, created.id, {
      version: 1,
      title: "  Q3 notes  ",
    });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Q3 notes");
    expect(response.body.version).toBe(2);
    expect(
      new Date(response.body.updatedAt) > new Date(created.updatedAt),
    ).toBe(true);
  });

  it("stores content exactly and returns it when reopened", async () => {
    const created = await createDocumentAs(aliceCookie);

    await saveDocument(aliceCookie, created.id, {
      version: 1,
      content: FULLY_FORMATTED_DOCUMENT,
    });
    const reopened = await request(app)
      .get(`${DOCUMENTS_PATH}/${created.id}`)
      .set("Cookie", aliceCookie);

    expect(reopened.body.content).toEqual(FULLY_FORMATTED_DOCUMENT);
  });

  it("rejects a save based on an old version with 409 and leaves the document unchanged", async () => {
    const created = await createDocumentAs(aliceCookie);
    await saveDocument(aliceCookie, created.id, { version: 1, title: "First" });

    const staleSave = await saveDocument(aliceCookie, created.id, {
      version: 1,
      title: "Stale",
    });
    const reopened = await request(app)
      .get(`${DOCUMENTS_PATH}/${created.id}`)
      .set("Cookie", aliceCookie);

    expect(staleSave.status).toBe(409);
    expect(reopened.body).toMatchObject({ title: "First", version: 2 });
  });

  it.each([
    ["no version", { title: "x" }],
    ["nothing to change", { version: 1 }],
    ["an empty title", { version: 1, title: "" }],
    ["a whitespace-only title", { version: 1, title: "   " }],
    ["a 201-character title", { version: 1, title: "x".repeat(201) }],
    [
      "invalid content",
      { version: 1, content: buildDocument({ type: "script" }) },
    ],
  ])("returns 400 for %s", async (_label, body) => {
    const created = await createDocumentAs(aliceCookie);

    const response = await saveDocument(aliceCookie, created.id, body);

    expect(response.status).toBe(400);
  });

  it("ignores an owner id sent with a save", async () => {
    const created = await createDocumentAs(aliceCookie);
    const bobId = await readUserId("bob");

    await saveDocument(aliceCookie, created.id, {
      version: 1,
      title: "Mine",
      ownerId: bobId,
      owner_id: bobId,
    });

    expect(await readOwnerId(created.id)).toBe(await readUserId("alice"));
  });

  it("deletes for the owner, after which the document is gone", async () => {
    const created = await createDocumentAs(aliceCookie);

    const deleteResponse = await request(app)
      .delete(`${DOCUMENTS_PATH}/${created.id}`)
      .set("Cookie", aliceCookie);
    const openResponse = await request(app)
      .get(`${DOCUMENTS_PATH}/${created.id}`)
      .set("Cookie", aliceCookie);
    const listResponse = await request(app)
      .get(DOCUMENTS_PATH)
      .set("Cookie", aliceCookie);

    expect(deleteResponse.status).toBe(204);
    expect(openResponse.status).toBe(404);
    expect(
      listResponse.body.map((document: { id: string }) => document.id),
    ).not.toContain(created.id);
  });

  it("gives another user 404 on open, save and delete, leaving the document unchanged", async () => {
    const alicesDocument = await createDocumentAs(aliceCookie);
    const path = `${DOCUMENTS_PATH}/${alicesDocument.id}`;

    const openResponse = await request(app).get(path).set("Cookie", bobCookie);
    const saveResponse = await saveDocument(bobCookie, alicesDocument.id, {
      version: 1,
      title: "Bob was here",
    });
    const deleteResponse = await request(app)
      .delete(path)
      .set("Cookie", bobCookie);
    const reopened = await request(app).get(path).set("Cookie", aliceCookie);

    expect([
      openResponse.status,
      saveResponse.status,
      deleteResponse.status,
    ]).toEqual([404, 404, 404]);
    expect(reopened.body).toEqual(alicesDocument);
  });

  it.each([
    ["a malformed id", "not-a-uuid"],
    ["an id that doesn't exist", MISSING_DOCUMENT_ID],
  ])("returns 404 for %s", async (_label, documentId) => {
    const response = await request(app)
      .get(`${DOCUMENTS_PATH}/${documentId}`)
      .set("Cookie", aliceCookie);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Document not found" });
  });

  it("returns 413 for a save body over 1 MB", async () => {
    const created = await createDocumentAs(aliceCookie);
    const hugeText = "x".repeat(ONE_MEGABYTE + 1);

    const response = await saveDocument(aliceCookie, created.id, {
      version: 1,
      content: buildDocument(buildParagraph(hugeText)),
    });

    expect(response.status).toBe(413);
  });
});
