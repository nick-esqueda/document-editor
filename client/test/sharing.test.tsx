import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicUser } from "@doc-editor/shared";
import * as authApi from "../src/api/authApi";
import * as documentsApi from "../src/api/documentsApi";
import * as usersApi from "../src/api/usersApi";
import { ApiError } from "../src/api/httpClient";
import { ALICE, renderAppAt } from "./renderWithAuth";
import {
  buildDocumentWithText,
  EMPTY_DOCUMENT_LISTS,
} from "./documentFixtures";

vi.mock("../src/api/authApi");
vi.mock("../src/api/documentsApi");
vi.mock("../src/api/usersApi");
const mockedAuthApi = vi.mocked(authApi);
const mockedDocumentsApi = vi.mocked(documentsApi);
const mockedUsersApi = vi.mocked(usersApi);

const BOB: PublicUser = { id: "user-bob", username: "bob", displayName: "Bob" };
const CAROL: PublicUser = {
  id: "user-carol",
  username: "carol",
  displayName: "Carol",
};
const ALICES_DOCUMENT = buildDocumentWithText("Hello", {
  id: "doc-1",
  title: "Q3 notes",
});

async function openShareDialog() {
  const user = userEvent.setup();
  renderAppAt("/d/doc-1");
  await user.click(await screen.findByRole("button", { name: "Share" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("list", { name: "People with access" });
  return { user, dialog };
}

function readPickerOptions(dialog: HTMLElement): string[] {
  const picker = within(dialog).getByLabelText("Add people");
  const options = within(picker).getAllByRole("option");
  return options.map((option) => option.textContent ?? "");
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedAuthApi.fetchCurrentUser.mockResolvedValue(ALICE);
  mockedDocumentsApi.fetchDocument.mockResolvedValue(ALICES_DOCUMENT);
  mockedDocumentsApi.listDocuments.mockResolvedValue(EMPTY_DOCUMENT_LISTS);
  mockedDocumentsApi.fetchDocumentAccess.mockResolvedValue({
    owner: ALICE,
    people: [BOB],
  });
  mockedUsersApi.listUsers.mockResolvedValue([ALICE, BOB, CAROL]);
});

describe("sharing in the editor", () => {
  it("shows the owner a Share button and no owner label", async () => {
    renderAppAt("/d/doc-1");

    expect(
      await screen.findByRole("button", { name: "Share" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Owned by/)).not.toBeInTheDocument();
  });

  it("shows someone it was shared with who owns it, and no Share button", async () => {
    mockedDocumentsApi.fetchDocument.mockResolvedValue({
      ...ALICES_DOCUMENT,
      role: "editor",
      ownerName: "Alice",
    });
    renderAppAt("/d/doc-1");

    expect(await screen.findByText("Owned by Alice")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share" }),
    ).not.toBeInTheDocument();
  });

  it("lists the owner and everyone with access, and offers only people without access", async () => {
    const { dialog } = await openShareDialog();

    const people = within(dialog).getByRole("list", {
      name: "People with access",
    });

    expect(dialog).toHaveTextContent('Share "Q3 notes"');
    expect(people).toHaveTextContent("Alice (you)");
    expect(people).toHaveTextContent("Owner");
    expect(people).toHaveTextContent("Bob");
    expect(readPickerOptions(dialog)).toEqual(["Select a user…", "Carol"]);
  });

  it("adds a person and shows them in the list", async () => {
    mockedDocumentsApi.grantDocumentAccess.mockResolvedValue({
      owner: ALICE,
      people: [BOB, CAROL],
    });
    const { user, dialog } = await openShareDialog();

    await user.selectOptions(
      within(dialog).getByLabelText("Add people"),
      "Carol",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(mockedDocumentsApi.grantDocumentAccess).toHaveBeenCalledWith(
      "doc-1",
      CAROL.id,
    );
    expect(
      await within(dialog).findByRole("button", { name: "Remove Carol" }),
    ).toBeInTheDocument();
  });

  it("removes a person and takes them off the list", async () => {
    mockedDocumentsApi.revokeDocumentAccess.mockResolvedValue(undefined);
    const { user, dialog } = await openShareDialog();

    await user.click(
      within(dialog).getByRole("button", { name: "Remove Bob" }),
    );

    expect(mockedDocumentsApi.revokeDocumentAccess).toHaveBeenCalledWith(
      "doc-1",
      BOB.id,
    );
    expect(
      within(dialog).queryByRole("button", { name: "Remove Bob" }),
    ).not.toBeInTheDocument();
    expect(readPickerOptions(dialog)).toContain("Bob");
  });

  it("moves focus into the dialog, keeps Tab inside, and Escape returns focus to Share", async () => {
    const { user, dialog } = await openShareDialog();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let press = 0; press < 8; press += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
  });

  it("allows one sharing change at a time, so a slow response can't bring back someone removed", async () => {
    mockedDocumentsApi.grantDocumentAccess.mockReturnValue(
      new Promise(() => {}),
    );
    const { user, dialog } = await openShareDialog();

    await user.selectOptions(
      within(dialog).getByLabelText("Add people"),
      "Carol",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      within(dialog).getByRole("button", { name: "Remove Bob" }),
    ).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("shows a message when sharing fails", async () => {
    mockedDocumentsApi.grantDocumentAccess.mockRejectedValue(
      new ApiError(500, "boom"),
    );
    const { user, dialog } = await openShareDialog();

    await user.selectOptions(
      within(dialog).getByLabelText("Add people"),
      "Carol",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That didn't work",
    );
  });

  it("on a 404 save, says access was lost and offers a way back to the list", async () => {
    mockedDocumentsApi.updateDocument.mockRejectedValue(
      new ApiError(404, "Document not found"),
    );
    const user = userEvent.setup();
    renderAppAt("/d/doc-1");

    const titleInput = await screen.findByLabelText("Document title");
    await user.clear(titleInput);
    await user.type(titleInput, "Mine{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You no longer have access to this document.",
    );
    await user.click(screen.getByRole("link", { name: "Back to documents" }));
    expect(
      await screen.findByRole("heading", { name: "My documents" }),
    ).toBeInTheDocument();
  });
});
