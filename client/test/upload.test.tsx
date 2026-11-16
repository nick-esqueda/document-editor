import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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

const IMPORTED_DOCUMENT = buildDocumentWithText("Imported text", {
  id: "doc-imported",
  title: "notes",
});
const TWO_MEGABYTES = 2 * 1024 * 1024;

function buildFile(name: string, contents = "hello"): File {
  return new File([contents], name, { type: "text/plain" });
}

function buildFileOfSize(name: string, sizeInBytes: number): File {
  const file = buildFile(name);
  Object.defineProperty(file, "size", { value: sizeInBytes });
  return file;
}

async function renderListPage() {
  renderAppAt("/");
  await screen.findByRole("heading", { name: "My documents" });
}

/** Chooses a file in the picker, the way the browser does after the Upload button. */
async function chooseFile(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(screen.getByLabelText("Upload a file"), file);
}

function buildFileDragData(files: File[] = []) {
  return { dataTransfer: { types: ["Files"], files } };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedAuthApi.fetchCurrentUser.mockResolvedValue(ALICE);
  mockedDocumentsApi.listDocuments.mockResolvedValue(EMPTY_DOCUMENT_LISTS);
  mockedDocumentsApi.fetchDocument.mockResolvedValue(IMPORTED_DOCUMENT);
});

describe("upload on the document list", () => {
  it("shows the Upload button and the supported types", async () => {
    await renderListPage();

    expect(screen.getByRole("button", { name: /Upload/ })).toBeInTheDocument();
    expect(
      screen.getByText("Upload supports .txt and .md, up to 1 MB"),
    ).toBeInTheDocument();
  });

  it("limits the file picker to .txt and .md", async () => {
    await renderListPage();

    expect(screen.getByLabelText("Upload a file")).toHaveAttribute(
      "accept",
      ".txt,.md",
    );
  });

  it("opens the file picker when Upload is clicked", async () => {
    await renderListPage();
    const input = screen.getByLabelText("Upload a file");
    const clickSpy = vi.spyOn(input, "click");

    await userEvent.click(screen.getByRole("button", { name: /Upload/ }));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("uploads a chosen file and opens the new document", async () => {
    mockedDocumentsApi.importDocument.mockResolvedValue({
      id: IMPORTED_DOCUMENT.id,
      warnings: 0,
    });
    await renderListPage();

    const file = buildFile("notes.md");
    await chooseFile(file);

    expect(mockedDocumentsApi.importDocument).toHaveBeenCalledWith(file);
    expect(await screen.findByText("Imported text")).toBeInTheDocument();
    expect(mockedDocumentsApi.fetchDocument).toHaveBeenCalledWith(
      IMPORTED_DOCUMENT.id,
    );
  });

  it("shows an importing message while the upload runs", async () => {
    mockedDocumentsApi.importDocument.mockReturnValue(new Promise(() => {}));
    await renderListPage();

    await chooseFile(buildFile("meeting-notes.md"));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Importing meeting-notes.md…",
    );
  });

  it("rejects an unsupported type without uploading", async () => {
    await renderListPage();

    await chooseFile(buildFile("report.docx"));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent('"report.docx" isn\'t supported.');
    expect(toast).toHaveTextContent("Upload a .txt or .md file up to 1 MB.");
    expect(mockedDocumentsApi.importDocument).not.toHaveBeenCalled();
  });

  it("rejects a file over 1 MB without uploading", async () => {
    await renderListPage();

    await chooseFile(buildFileOfSize("big.md", TWO_MEGABYTES));

    expect(screen.getByRole("alert")).toHaveTextContent(
      '"big.md" is too large.',
    );
    expect(mockedDocumentsApi.importDocument).not.toHaveBeenCalled();
  });

  it("shows the server's message when the upload is rejected, and can be dismissed", async () => {
    mockedDocumentsApi.importDocument.mockRejectedValue(
      new ApiError(400, "This file doesn't look like a text file."),
    );
    await renderListPage();

    await chooseFile(buildFile("photo.txt"));

    const toast = await screen.findByRole("alert");
    expect(toast).toHaveTextContent("This file doesn't look like a text file.");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a drop hint while a file is dragged over the page, and imports a dropped file", async () => {
    mockedDocumentsApi.importDocument.mockResolvedValue({
      id: IMPORTED_DOCUMENT.id,
      warnings: 0,
    });
    await renderListPage();
    const page = screen.getByRole("main");

    fireEvent.dragEnter(page, buildFileDragData());
    expect(
      screen.getByText("Drop a .txt or .md file to import it"),
    ).toBeInTheDocument();

    const file = buildFile("dropped.txt");
    fireEvent.drop(page, buildFileDragData([file]));

    expect(
      screen.queryByText("Drop a .txt or .md file to import it"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockedDocumentsApi.importDocument).toHaveBeenCalledWith(file),
    );
  });

  it("hides the drop hint when the drag leaves the page", async () => {
    await renderListPage();
    const page = screen.getByRole("main");

    fireEvent.dragEnter(page, buildFileDragData());
    fireEvent.dragLeave(page, buildFileDragData());

    expect(
      screen.queryByText("Drop a .txt or .md file to import it"),
    ).not.toBeInTheDocument();
  });
});

describe("imported document note in the editor", () => {
  async function importWithWarnings(warnings: number) {
    mockedDocumentsApi.importDocument.mockResolvedValue({
      id: IMPORTED_DOCUMENT.id,
      warnings,
    });
    await renderListPage();
    await chooseFile(buildFile("meeting-notes.md"));
    await screen.findByText("Imported text");
  }

  it("says formatting was simplified when the import had warnings", async () => {
    await importWithWarnings(2);

    expect(
      screen.getByText(/Some formatting wasn't supported and was simplified/),
    ).toHaveTextContent("Imported from meeting-notes.md.");
  });

  it("shows no note when nothing was simplified", async () => {
    await importWithWarnings(0);

    expect(screen.queryByText(/was simplified/)).not.toBeInTheDocument();
  });

  it("can be dismissed", async () => {
    await importWithWarnings(1);

    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss import note" }),
    );

    expect(screen.queryByText(/was simplified/)).not.toBeInTheDocument();
  });

  it("isn't shown when opening a document normally", async () => {
    renderAppAt(`/d/${IMPORTED_DOCUMENT.id}`);
    await screen.findByText("Imported text");

    expect(screen.queryByText(/was simplified/)).not.toBeInTheDocument();
  });
});
