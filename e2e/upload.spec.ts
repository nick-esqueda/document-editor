import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { logInAs } from "./support";

const FIXTURES_DIRECTORY = "server/test/fixtures/import";
const SAMPLE_MARKDOWN_PATH = path.join(FIXTURES_DIRECTORY, "sample.md");

function getFileInput(page: Page) {
  return page.getByLabel("Upload a file");
}

/** Drops an in-memory file on the list page, the way dragging one from the desktop does. */
async function dropFile(page: Page, fileName: string, contents: string) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, text }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], name, { type: "text/plain" }));
      return transfer;
    },
    { name: fileName, text: contents },
  );
  const dropArea = page.getByRole("main");

  await dropArea.dispatchEvent("dragenter", { dataTransfer });
  await expect(
    page.getByText("Drop a .txt or .md file to import it"),
  ).toBeVisible();
  await dropArea.dispatchEvent("drop", { dataTransfer });
}

test.beforeEach(async ({ page }) => {
  await logInAs(page, "alice");
});

test("the file picker only offers .txt and .md", async ({ page }) => {
  await expect(
    page.getByText("Upload supports .txt and .md, up to 1 MB"),
  ).toBeVisible();
  await expect(getFileInput(page)).toHaveAttribute("accept", ".txt,.md");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "⬆ Upload" }).click();
  const fileChooser = await fileChooserPromise;

  expect(fileChooser.isMultiple()).toBe(false);
});

test("uploading sample.md opens it in the editor with its formatting", async ({
  page,
}) => {
  await getFileInput(page).setInputFiles(SAMPLE_MARKDOWN_PATH);

  await expect(page).toHaveURL(/\/d\//);
  const content = page.getByLabel("Document content");
  await expect(page.getByLabel("Document title")).toHaveValue("sample");
  await expect(content.locator("h1")).toHaveText("Project kickoff");
  await expect(content.locator("h2").first()).toHaveText("Goals");
  await expect(content.locator("strong").first()).toHaveText("kickoff");
  await expect(content.locator("em").first()).toHaveText("before");
  await expect(content.locator("ul > li").first()).toHaveText(
    "Ship the editor",
  );
  await expect(content.locator("ol > li")).toHaveText([
    "Review the plan",
    "Book the demo",
  ]);
  await expect(page.getByText(/was simplified/)).toHaveCount(0);
});

test("uploading report.docx shows the isn't-supported message", async ({
  page,
}) => {
  await getFileInput(page).setInputFiles({
    name: "report.docx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not really a docx"),
  });

  const toast = page.getByRole("alert");
  await expect(toast).toContainText('"report.docx" isn\'t supported.');
  await expect(toast).toContainText("Upload a .txt or .md file up to 1 MB.");
  await expect(page).toHaveURL(/\/$/);
});

test("dropping a markdown file with a table imports it and explains the simplification", async ({
  page,
}) => {
  await dropFile(
    page,
    "table-notes.md",
    "# Team\n\n| Name | Role |\n| - | - |\n| Ann | Lead |\n",
  );

  await expect(page).toHaveURL(/\/d\//);
  await expect(page.getByText(/Imported from table-notes\.md\./)).toContainText(
    "Some formatting wasn't supported and was simplified.",
  );
  await expect(
    page.getByLabel("Document content").locator("p").first(),
  ).toHaveText("Name | Role");

  await page.getByRole("button", { name: "Dismiss import note" }).click();
  await expect(page.getByText(/was simplified/)).toHaveCount(0);
});
