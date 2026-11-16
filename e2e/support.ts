import { expect, type Page } from "@playwright/test";

// playwright.config.ts loads the root .env, so this matches what the server seeded.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "change-me-dev-password";

export async function logInAs(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Creates a document from the list page and returns its URL. */
export async function createDocument(page: Page): Promise<string> {
  await page.getByRole("button", { name: "+ New document" }).click();
  await expect(page).toHaveURL(/\/d\//);
  await expect(page.getByLabel("Document content")).toBeVisible();
  return page.url();
}

export async function waitUntilSaved(page: Page) {
  await expect(page.getByRole("status")).toHaveText("✓ Saved");
}

export async function renameInEditor(page: Page, title: string) {
  const titleInput = page.getByLabel("Document title");
  await titleInput.fill(title);
  await titleInput.press("Enter");
  await waitUntilSaved(page);
}
