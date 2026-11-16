import { expect, test } from "@playwright/test";
import {
  createDocument,
  logInAs,
  renameInEditor,
  waitUntilSaved,
} from "./support";

const SAVE_REQUEST_PATTERN = "**/api/documents/*";

test("formatted content survives a reload", async ({ page }) => {
  await logInAs(page, "alice");
  await createDocument(page);
  const content = page.getByLabel("Document content");

  await content.click();
  await page.keyboard.type("# Q3 Planning");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("Bold goal");
  await page.keyboard.press("Control+b");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- first item");
  await waitUntilSaved(page);
  await page.reload();

  await expect(content.locator("h1")).toHaveText("Q3 Planning");
  await expect(content.locator("strong")).toHaveText("Bold goal");
  await expect(content.locator("ul li")).toHaveText("first item");
});

test("renaming from the editor and from the list both stick", async ({
  page,
}) => {
  await logInAs(page, "alice");
  const documentUrl = await createDocument(page);
  // The dev database keeps documents between runs, so titles are unique per run.
  const runId = Date.now();
  const editorTitle = `Renamed in editor ${runId}`;
  const listTitle = `Renamed in list ${runId}`;

  await renameInEditor(page, editorTitle);
  await page.getByRole("link", { name: "← Documents" }).click();
  await expect(page.getByRole("link", { name: editorTitle })).toBeVisible();

  await page
    .getByRole("button", { name: `More actions for ${editorTitle}` })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("New title").fill(listTitle);
  await page.getByLabel("New title").press("Enter");
  await expect(page.getByRole("link", { name: listTitle })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: listTitle })).toBeVisible();
  await page.goto(documentUrl);
  await expect(page.getByLabel("Document title")).toHaveValue(listTitle);
});

test("losing the connection shows offline, then saves everything once it's back", async ({
  page,
}) => {
  await logInAs(page, "alice");
  await createDocument(page);
  const content = page.getByLabel("Document content");

  await page.route(SAVE_REQUEST_PATTERN, (route) =>
    route.request().method() === "PATCH"
      ? route.abort("internetdisconnected")
      : route.continue(),
  );
  await content.click();
  await page.keyboard.type("Written while offline");
  await expect(page.getByRole("status")).toHaveText("⟳ Offline, retrying…");

  await page.unroute(SAVE_REQUEST_PATTERN);
  await waitUntilSaved(page);
  await page.reload();

  await expect(content).toHaveText("Written while offline");
});

test("another user can't see or open someone else's document", async ({
  page,
}) => {
  await logInAs(page, "alice");
  const documentUrl = await createDocument(page);
  const privateTitle = `Alice private notes ${Date.now()}`;
  await renameInEditor(page, privateTitle);
  await page.getByRole("link", { name: "← Documents" }).click();
  await page.getByRole("button", { name: "Log out" }).click();

  await logInAs(page, "bob");
  await expect(
    page.getByRole("heading", { name: "My documents" }),
  ).toBeVisible();
  await expect(page.getByText(privateTitle)).toHaveCount(0);

  await page.goto(documentUrl);
  await expect(
    page.getByRole("heading", { name: "Document not found" }),
  ).toBeVisible();
});

test("a deleted document is gone after a reload", async ({ page }) => {
  await logInAs(page, "alice");
  await createDocument(page);
  const title = `Delete me ${Date.now()}`;
  await renameInEditor(page, title);
  await page.getByRole("link", { name: "← Documents" }).click();

  await page.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "My documents" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
});
