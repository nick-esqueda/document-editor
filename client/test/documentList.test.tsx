import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as authApi from "../src/api/authApi";
import * as documentsApi from "../src/api/documentsApi";
import { ALICE, renderAppAt } from "./renderWithAuth";
import { buildDocumentDetails, EMPTY_DOCUMENT_LISTS } from "./documentFixtures";

vi.mock("../src/api/authApi");
vi.mock("../src/api/documentsApi");
const mockedAuthApi = vi.mocked(authApi);
const mockedDocumentsApi = vi.mocked(documentsApi);

const MINUTE_MS = 60 * 1000;
const NOW = Date.now();

const NEWER = {
  id: "doc-new",
  title: "Q3 planning notes",
  updatedAt: new Date(NOW - 2 * MINUTE_MS).toISOString(),
  sharedWithCount: 2,
};
const OLDER = {
  id: "doc-old",
  title: "Reading list",
  updatedAt: new Date(NOW - 90 * MINUTE_MS).toISOString(),
  sharedWithCount: 0,
};
const SHARED_BY_BOB = {
  id: "doc-bob",
  title: "Team retro",
  updatedAt: new Date(NOW - 60 * MINUTE_MS).toISOString(),
  ownerName: "Bob",
};

function findList(name: string) {
  return screen.findByRole("list", { name });
}

async function openRowMenu(title: string) {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: `More actions for ${title}` }),
  );
  return user;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedAuthApi.fetchCurrentUser.mockResolvedValue(ALICE);
  mockedDocumentsApi.listDocuments.mockResolvedValue({
    owned: [NEWER, OLDER],
    shared: [SHARED_BY_BOB],
  });
});

describe("document list", () => {
  it("shows documents in the order the server returns (newest first) with edited times", async () => {
    renderAppAt("/");

    const rows = within(await findList("My documents")).getAllByRole(
      "listitem",
    );

    expect(
      rows.map((row) => within(row).getByRole("link").textContent),
    ).toEqual([NEWER.title, OLDER.title]);
    expect(rows[0]).toHaveTextContent("Edited 2 min ago");
    expect(rows[1]).toHaveTextContent("Edited 1 hr ago");
  });

  it("shows the empty state when there are no documents", async () => {
    mockedDocumentsApi.listDocuments.mockResolvedValue(EMPTY_DOCUMENT_LISTS);
    renderAppAt("/");

    expect(await screen.findByText(/No documents yet/)).toBeInTheDocument();
    expect(
      screen.getByText("Nothing has been shared with you yet."),
    ).toBeInTheDocument();
  });

  it("lists documents shared with me separately, with who shared them", async () => {
    renderAppAt("/");

    const sharedList = await findList("Shared with me");
    const myList = screen.getByRole("list", { name: "My documents" });

    expect(
      screen.getByRole("heading", { name: "Shared with me" }),
    ).toBeInTheDocument();
    expect(sharedList).toHaveTextContent("Team retro");
    expect(sharedList).toHaveTextContent("from Bob");
    expect(myList).not.toHaveTextContent("Team retro");
  });

  it("shows how many people an owned document is shared with", async () => {
    renderAppAt("/");

    const rows = within(await findList("My documents")).getAllByRole(
      "listitem",
    );

    expect(rows[0]).toHaveTextContent("Shared with 2");
    expect(rows[1]).not.toHaveTextContent("Shared with");
  });

  it("has no rename or delete menu on shared documents", async () => {
    renderAppAt("/");

    const sharedList = await findList("Shared with me");

    expect(within(sharedList).queryByRole("button")).not.toBeInTheDocument();
  });

  it("creates a document and opens it in the editor", async () => {
    const created = buildDocumentDetails({ id: "doc-created" });
    mockedDocumentsApi.createDocument.mockResolvedValue(created);
    mockedDocumentsApi.fetchDocument.mockResolvedValue(created);
    renderAppAt("/");

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "+ New document" }));

    expect(await screen.findByLabelText("Document title")).toHaveValue(
      "Untitled document",
    );
    expect(mockedDocumentsApi.fetchDocument).toHaveBeenCalledWith(
      "doc-created",
    );
  });

  it("renames from the row menu", async () => {
    mockedDocumentsApi.fetchDocument.mockResolvedValue(
      buildDocumentDetails({ ...OLDER, version: 4 }),
    );
    mockedDocumentsApi.updateDocument.mockResolvedValue(
      buildDocumentDetails({ ...OLDER, title: "Books", version: 5 }),
    );
    renderAppAt("/");

    const user = await openRowMenu(OLDER.title);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const titleInput = screen.getByLabelText("New title");
    await user.clear(titleInput);
    await user.type(titleInput, "Books{Enter}");

    expect(mockedDocumentsApi.updateDocument).toHaveBeenCalledOnce();
    expect(mockedDocumentsApi.updateDocument).toHaveBeenCalledWith(OLDER.id, {
      version: 4,
      title: "Books",
    });
    expect(
      await screen.findByRole("link", { name: "Books" }),
    ).toBeInTheDocument();
  });

  it("closes the row menu on a click outside it", async () => {
    renderAppAt("/");

    const user = await openRowMenu(OLDER.title);
    await user.click(screen.getByRole("heading", { name: "My documents" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the row menu on Escape", async () => {
    renderAppAt("/");

    const user = await openRowMenu(OLDER.title);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps the document when delete is cancelled", async () => {
    renderAppAt("/");

    const user = await openRowMenu(OLDER.title);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(mockedDocumentsApi.deleteDocument).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: OLDER.title })).toBeInTheDocument();
  });

  it("deletes the document after confirmation", async () => {
    mockedDocumentsApi.deleteDocument.mockResolvedValue(undefined);
    renderAppAt("/");

    const user = await openRowMenu(OLDER.title);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    expect(mockedDocumentsApi.deleteDocument).toHaveBeenCalledWith(OLDER.id);
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: OLDER.title })).toBeNull(),
    );
  });
});
