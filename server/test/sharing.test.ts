import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  createTestApp,
  logInAndGetCookie,
  useTestPool,
} from "./support/testApp";
import { buildDocument, buildParagraph } from "./support/documentFixtures";

const DOCUMENTS_PATH = "/api/documents";
const USERS_PATH = "/api/users";
const MISSING_USER_ID = "00000000-0000-4000-8000-000000000000";

type Username = "alice" | "bob" | "carol";

describe("sharing", () => {
  const pool = useTestPool();
  const app = createTestApp(pool);
  const cookies = {} as Record<Username, string>;
  const userIds = {} as Record<Username, string>;

  beforeAll(async () => {
    for (const username of ["alice", "bob", "carol"] as const) {
      cookies[username] = await logInAndGetCookie(app, username);
      userIds[username] = await readUserId(username);
    }
  });

  async function readUserId(username: string): Promise<string> {
    const result = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    return result.rows[0].id;
  }

  function buildDocumentPath(documentId: string): string {
    return `${DOCUMENTS_PATH}/${documentId}`;
  }

  function buildAccessPath(documentId: string): string {
    return `${buildDocumentPath(documentId)}/access`;
  }

  async function createDocumentAs(username: Username): Promise<string> {
    const response = await request(app)
      .post(DOCUMENTS_PATH)
      .set("Cookie", cookies[username]);
    return response.body.id;
  }

  function shareAs(owner: Username, documentId: string, userId: string) {
    return request(app)
      .post(buildAccessPath(documentId))
      .set("Cookie", cookies[owner])
      .send({ userId });
  }

  function revokeAs(owner: Username, documentId: string, userId: string) {
    return request(app)
      .delete(`${buildAccessPath(documentId)}/${userId}`)
      .set("Cookie", cookies[owner]);
  }

  function saveAs(username: Username, documentId: string, body: object) {
    return request(app)
      .patch(buildDocumentPath(documentId))
      .set("Cookie", cookies[username])
      .send(body);
  }

  function listAs(username: Username) {
    return request(app).get(DOCUMENTS_PATH).set("Cookie", cookies[username]);
  }

  /** Alice's document, shared with Bob. Carol is a stranger to it. */
  async function createAlicesDocumentSharedWithBob(): Promise<string> {
    const documentId = await createDocumentAs("alice");
    await shareAs("alice", documentId, userIds.bob);
    return documentId;
  }

  const ACTIONS: Record<
    string,
    (username: Username, documentId: string) => request.Test
  > = {
    open: (username, documentId) =>
      request(app)
        .get(buildDocumentPath(documentId))
        .set("Cookie", cookies[username]),
    "edit content": (username, documentId) =>
      saveAs(username, documentId, {
        version: 1,
        content: buildDocument(buildParagraph("edited")),
      }),
    rename: (username, documentId) =>
      saveAs(username, documentId, { version: 1, title: "Renamed" }),
    "see who has access": (username, documentId) =>
      request(app)
        .get(buildAccessPath(documentId))
        .set("Cookie", cookies[username]),
    "grant access": (username, documentId) =>
      shareAs(username, documentId, userIds.carol),
    "revoke access": (username, documentId) =>
      revokeAs(username, documentId, userIds.bob),
    delete: (username, documentId) =>
      request(app)
        .delete(buildDocumentPath(documentId))
        .set("Cookie", cookies[username]),
  };

  // Every cell of the rules table: [action, owner (alice), has access (bob), stranger (carol)].
  const RULES: Array<[string, number, number, number]> = [
    ["open", 200, 200, 404],
    ["edit content", 200, 200, 404],
    ["rename", 200, 200, 404],
    ["see who has access", 200, 200, 404],
    ["grant access", 201, 403, 404],
    ["revoke access", 204, 403, 404],
    ["delete", 204, 403, 404],
  ];
  const RULE_CELLS = RULES.flatMap(([action, ...statuses]) =>
    (["alice", "bob", "carol"] as const).map(
      (username, index) => [action, username, statuses[index]] as const,
    ),
  );

  it.each(RULE_CELLS)(
    "%s as %s returns %i",
    async (action, username, expectedStatus) => {
      const documentId = await createAlicesDocumentSharedWithBob();

      const response = await ACTIONS[action](username, documentId);

      expect(response.status).toBe(expectedStatus);
    },
  );

  it.each([
    ["get", USERS_PATH],
    ["get", `${DOCUMENTS_PATH}/${MISSING_USER_ID}/access`],
    ["post", `${DOCUMENTS_PATH}/${MISSING_USER_ID}/access`],
    [
      "delete",
      `${DOCUMENTS_PATH}/${MISSING_USER_ID}/access/${MISSING_USER_ID}`,
    ],
  ] as const)("%s %s returns 401 when logged out", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
  });

  it("lists every user's id, username and display name, without password hashes", async () => {
    const response = await request(app)
      .get(USERS_PATH)
      .set("Cookie", cookies.alice);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: userIds.alice, username: "alice", displayName: "Alice" },
      { id: userIds.bob, username: "bob", displayName: "Bob" },
      { id: userIds.carol, username: "carol", displayName: "Carol" },
    ]);
  });

  it("lists a shared document under shared with the owner's name, not under owned", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();

    const response = await listAs("bob");
    const sharedItem = response.body.shared.find(
      (document: { id: string }) => document.id === documentId,
    );

    expect(sharedItem).toEqual({
      id: documentId,
      title: "Untitled document",
      updatedAt: expect.any(String),
      ownerName: "Alice",
    });
    expect(
      response.body.owned.map((document: { id: string }) => document.id),
    ).not.toContain(documentId);
  });

  it("shows the owner how many people each document is shared with", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();
    await shareAs("alice", documentId, userIds.carol);

    const response = await listAs("alice");
    const ownedItem = response.body.owned.find(
      (document: { id: string }) => document.id === documentId,
    );

    expect(ownedItem.sharedWithCount).toBe(2);
  });

  it("returns who has access: the owner and everyone it's shared with", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();

    const response = await request(app)
      .get(buildAccessPath(documentId))
      .set("Cookie", cookies.bob);

    expect(response.body).toEqual({
      owner: { id: userIds.alice, username: "alice", displayName: "Alice" },
      people: [{ id: userIds.bob, username: "bob", displayName: "Bob" }],
    });
  });

  it("treats sharing twice as a no-op returning 200", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();

    const response = await shareAs("alice", documentId, userIds.bob);

    expect(response.status).toBe(200);
    expect(response.body.people).toHaveLength(1);
  });

  it.each([
    ["the owner themselves", () => userIds.alice],
    ["a user that doesn't exist", () => MISSING_USER_ID],
    ["a malformed user id", () => "not-a-uuid"],
  ])("returns 400 when sharing with %s", async (_label, readTargetId) => {
    const documentId = await createDocumentAs("alice");

    const response = await shareAs("alice", documentId, readTargetId());

    expect(response.status).toBe(400);
  });

  it("after access is removed, the user's next save and open get 404 and the list drops the document", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();
    await saveAs("bob", documentId, { version: 1, title: "Bob's edit" });

    const revokeResponse = await revokeAs("alice", documentId, userIds.bob);
    const saveResponse = await saveAs("bob", documentId, {
      version: 2,
      title: "After revoke",
    });
    const openResponse = await ACTIONS.open("bob", documentId);
    const listResponse = await listAs("bob");

    expect(revokeResponse.status).toBe(204);
    expect([saveResponse.status, openResponse.status]).toEqual([404, 404]);
    expect(
      listResponse.body.shared.map((document: { id: string }) => document.id),
    ).not.toContain(documentId);
  });

  it.each([
    ["someone who never had access", () => userIds.carol],
    ["a malformed user id", () => "not-a-uuid"],
  ])("removing %s is a harmless 204", async (_label, readTargetId) => {
    const documentId = await createDocumentAs("alice");

    const response = await revokeAs("alice", documentId, readTargetId());

    expect(response.status).toBe(204);
  });

  it("when owner and editor save from the same version, one wins and the other gets 409", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();

    const statuses = await Promise.all([
      saveAs("alice", documentId, { version: 1, title: "Alice's" }),
      saveAs("bob", documentId, { version: 1, title: "Bob's" }),
    ]).then((responses) => responses.map((response) => response.status));

    expect(statuses.sort()).toEqual([200, 409]);
  });

  it("tells each user their role and who owns the document", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();

    const [alicesView, bobsView] = await Promise.all([
      ACTIONS.open("alice", documentId),
      ACTIONS.open("bob", documentId),
    ]);

    expect(alicesView.body).toMatchObject({
      role: "owner",
      ownerName: "Alice",
    });
    expect(bobsView.body).toMatchObject({ role: "editor", ownerName: "Alice" });
    expect(bobsView.body).not.toHaveProperty("ownerId");
  });

  it("deleting a shared document removes it from the shared user's list and its access rows", async () => {
    const documentId = await createAlicesDocumentSharedWithBob();

    await ACTIONS.delete("alice", documentId);
    const listResponse = await listAs("bob");
    const accessRows = await pool.query(
      "SELECT 1 FROM document_access WHERE document_id = $1",
      [documentId],
    );

    expect(
      listResponse.body.shared.map((document: { id: string }) => document.id),
    ).not.toContain(documentId);
    expect(accessRows.rowCount).toBe(0);
  });
});
