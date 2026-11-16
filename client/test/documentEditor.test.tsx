import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as authApi from "../src/api/authApi";
import * as documentsApi from "../src/api/documentsApi";
import { ApiError } from "../src/api/httpClient";
import { ALICE, renderAppAt } from "./renderWithAuth";
import {
  buildDocumentWithText,
  EMPTY_DOCUMENT_LISTS,
} from "./documentFixtures";

vi.mock("../src/api/authApi");
vi.mock("../src/api/documentsApi");
const mockedAuthApi = vi.mocked(authApi);
const mockedDocumentsApi = vi.mocked(documentsApi);

const SAVED_DOCUMENT = buildDocumentWithText("Hello world", {
  id: "doc-1",
  title: "Q3 notes",
  version: 7,
});

async function openEditor() {
  renderAppAt("/d/doc-1");
  return screen.findByLabelText("Document content");
}

async function renameTo(title: string) {
  const user = userEvent.setup();
  const titleInput = await screen.findByLabelText("Document title");
  await user.clear(titleInput);
  await user.type(titleInput, `${title}{Enter}`);
}

function dispatchBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedAuthApi.fetchCurrentUser.mockResolvedValue(ALICE);
  mockedDocumentsApi.fetchDocument.mockResolvedValue(SAVED_DOCUMENT);
});

afterEach(() => vi.useRealTimers());

describe("document editor", () => {
  it("opens with the saved title and content", async () => {
    const content = await openEditor();

    expect(screen.getByLabelText("Document title")).toHaveValue("Q3 notes");
    expect(content).toHaveTextContent("Hello world");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("applies formatting from the toolbar and shows which buttons are active", async () => {
    const user = userEvent.setup();
    const content = await openEditor();

    await user.click(content);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await user.click(screen.getByRole("button", { name: "Italic" }));
    await user.click(screen.getByRole("button", { name: "Underline" }));

    expect(
      content.querySelector("strong em u, strong u em, strong em, u"),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Underline" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it.each([
    ["Heading 1", "h1"],
    ["Heading 2", "h2"],
    ["Heading 3", "h3"],
  ])("turns the paragraph into %s", async (optionLabel, tagName) => {
    const user = userEvent.setup();
    const content = await openEditor();

    await user.click(content);
    await user.selectOptions(screen.getByLabelText("Text style"), optionLabel);

    expect(content.querySelector(tagName)).toHaveTextContent("Hello world");
    expect(screen.getByLabelText("Text style")).toHaveDisplayValue(optionLabel);
  });

  it.each([
    ["Bulleted list", "ul"],
    ["Numbered list", "ol"],
  ])("turns the paragraph into a %s", async (buttonLabel, tagName) => {
    const user = userEvent.setup();
    const content = await openEditor();

    await user.click(content);
    await user.click(screen.getByRole("button", { name: buttonLabel }));

    expect(content.querySelector(`${tagName} li`)).toHaveTextContent(
      "Hello world",
    );
    expect(screen.getByRole("button", { name: buttonLabel })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sends no save when the document is only opened", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openEditor();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockedDocumentsApi.updateDocument).not.toHaveBeenCalled();
  });

  it("saves the title on Enter with the document's version", async () => {
    mockedDocumentsApi.updateDocument.mockResolvedValue({
      ...SAVED_DOCUMENT,
      title: "Renamed",
      version: 8,
    });
    await openEditor();

    await renameTo("Renamed");

    expect(mockedDocumentsApi.updateDocument).toHaveBeenCalledWith("doc-1", {
      version: 7,
      title: "Renamed",
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved"),
    );
  });

  it("saves the title when focus leaves the field", async () => {
    mockedDocumentsApi.updateDocument.mockResolvedValue({
      ...SAVED_DOCUMENT,
      version: 8,
    });
    const user = userEvent.setup();
    await openEditor();

    const titleInput = screen.getByLabelText("Document title");
    await user.clear(titleInput);
    await user.type(titleInput, "Blurred");
    await user.click(screen.getByLabelText("Document content"));

    expect(mockedDocumentsApi.updateDocument).toHaveBeenCalledWith("doc-1", {
      version: 7,
      title: "Blurred",
    });
  });

  it("reverts an empty title without saving", async () => {
    const user = userEvent.setup();
    await openEditor();

    const titleInput = screen.getByLabelText("Document title");
    await user.clear(titleInput);
    await user.type(titleInput, "{Enter}");

    expect(titleInput).toHaveValue("Q3 notes");
    expect(mockedDocumentsApi.updateDocument).not.toHaveBeenCalled();
  });

  it("shows the conflict banner on a 409, keeps the text and stops saving", async () => {
    mockedDocumentsApi.updateDocument.mockRejectedValue(
      new ApiError(409, "changed elsewhere"),
    );
    const content = await openEditor();

    await renameTo("Mine");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This document was changed elsewhere",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(content).toHaveTextContent("Hello world");
    expect(screen.getByRole("status")).toHaveTextContent("Not saved");

    await renameTo("Mine again");
    expect(mockedDocumentsApi.updateDocument).toHaveBeenCalledOnce();
  });

  it("asks before leaving with unsaved work, and sends the final save only once the page is left", async () => {
    mockedDocumentsApi.updateDocument.mockReturnValue(new Promise(() => {}));
    await openEditor();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    await renameTo("First");
    await renameTo("Second");
    const event = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
    expect(mockedDocumentsApi.sendFinalSave).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pagehide"));
    expect(mockedDocumentsApi.sendFinalSave).toHaveBeenCalledWith("doc-1", {
      version: 7,
      title: "Second",
    });
  });

  it("saves pending edits when going back to the document list", async () => {
    mockedDocumentsApi.listDocuments.mockResolvedValue(EMPTY_DOCUMENT_LISTS);
    mockedDocumentsApi.updateDocument.mockResolvedValue({
      ...SAVED_DOCUMENT,
      version: 8,
    });
    const user = userEvent.setup();
    const content = await openEditor();

    await user.type(content, "!");
    await user.click(screen.getByRole("link", { name: "← Documents" }));

    expect(
      await screen.findByRole("heading", { name: "My documents" }),
    ).toBeInTheDocument();
    expect(mockedDocumentsApi.updateDocument).toHaveBeenCalledOnce();
    expect(mockedDocumentsApi.updateDocument.mock.calls[0][1]).toMatchObject({
      version: 7,
      content: { type: "doc" },
    });
  });

  it.each([
    ["offline", new TypeError("Failed to fetch")],
    ["a conflict", new ApiError(409, "changed elsewhere")],
  ])(
    "asks before going back to the list when %s stopped the save",
    async (_label, saveError) => {
      mockedDocumentsApi.listDocuments.mockResolvedValue(EMPTY_DOCUMENT_LISTS);
      mockedDocumentsApi.updateDocument.mockRejectedValue(saveError);
      const user = userEvent.setup();
      await openEditor();

      await renameTo("Mine");
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /Offline|Not saved/,
        ),
      );
      await user.click(screen.getByRole("link", { name: "← Documents" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("Leave without saving?");
      await user.click(within(dialog).getByRole("button", { name: "Leave" }));
      expect(
        await screen.findByRole("heading", { name: "My documents" }),
      ).toBeInTheDocument();
    },
  );

  it("shows 'Document not found' for a document the user can't access", async () => {
    mockedDocumentsApi.fetchDocument.mockRejectedValue(
      new ApiError(404, "Document not found"),
    );
    renderAppAt("/d/someone-elses-doc");

    expect(
      await screen.findByRole("heading", { name: "Document not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to documents" }),
    ).toBeInTheDocument();
  });
});
