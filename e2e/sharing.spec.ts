import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createDocument,
  logInAs,
  renameInEditor,
  waitUntilSaved,
} from "./support";

/** A logged-in page in its own browser context, so two users can be online at once. */
async function openPageAs(browser: Browser, username: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logInAs(page, username);
  return page;
}

/** As Alice: creates a uniquely titled document and returns its URL and title. */
async function createTitledDocument(page: Page, label: string) {
  const documentUrl = await createDocument(page);
  // The dev database keeps documents between runs, so titles are unique per run.
  const title = `${label} ${Date.now()}`;
  await renameInEditor(page, title);
  return { documentUrl, title };
}

function openShareDialog(page: Page) {
  return page.getByRole("button", { name: "Share" }).click();
}

async function shareWith(page: Page, displayName: string) {
  await openShareDialog(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Add people").selectOption({ label: displayName });
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(
    dialog.getByRole("button", { name: `Remove ${displayName}` }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
}

function getSharedWithMeList(page: Page) {
  return page.getByRole("list", { name: "Shared with me" });
}

test("alice shares with bob, bob edits, and alice sees bob's change", async ({
  browser,
}) => {
  const alice = await openPageAs(browser, "alice");
  const { documentUrl, title } = await createTitledDocument(
    alice,
    "Team retro",
  );
  await shareWith(alice, "Bob");

  const bob = await openPageAs(browser, "bob");
  const sharedList = getSharedWithMeList(bob);
  await expect(
    sharedList.getByRole("listitem").filter({ hasText: title }),
  ).toContainText("from Alice");
  await sharedList.getByRole("link", { name: title }).click();
  await bob.getByLabel("Document content").click();
  await bob.keyboard.type("Bob was here");
  await waitUntilSaved(bob);

  await alice.goto(documentUrl);
  await expect(alice.getByLabel("Document content")).toContainText(
    "Bob was here",
  );
});

test("when alice removes bob's access while he has it open, his next edit is refused and the doc leaves his list", async ({
  browser,
}) => {
  const alice = await openPageAs(browser, "alice");
  const { documentUrl, title } = await createTitledDocument(alice, "Revoked");
  await shareWith(alice, "Bob");
  const bob = await openPageAs(browser, "bob");
  await bob.goto(documentUrl);
  await expect(bob.getByLabel("Document content")).toBeVisible();

  await openShareDialog(alice);
  await alice.getByRole("button", { name: "Remove Bob" }).click();
  await expect(alice.getByRole("button", { name: "Remove Bob" })).toBeHidden();
  await bob.getByLabel("Document content").click();
  await bob.keyboard.type("Too late");

  await expect(bob.getByRole("alert")).toHaveText(
    /You no longer have access to this document\./,
  );
  await bob.getByRole("link", { name: "Back to documents" }).click();
  await expect(
    bob.getByRole("heading", { name: "Shared with me" }),
  ).toBeVisible();
  await expect(bob.getByRole("link", { name: title })).toBeHidden();
});

test("bob sees who owns a shared doc and has no share or delete controls", async ({
  browser,
}) => {
  const alice = await openPageAs(browser, "alice");
  const { documentUrl } = await createTitledDocument(alice, "Owner check");
  await shareWith(alice, "Bob");

  const bob = await openPageAs(browser, "bob");
  await bob.goto(documentUrl);

  await expect(bob.getByText("Owned by Alice")).toBeVisible();
  await expect(bob.getByRole("button", { name: "Share" })).toHaveCount(0);
  await expect(bob.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  await expect(bob.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
});

test("alice can share from the document list menu", async ({ browser }) => {
  const alice = await openPageAs(browser, "alice");
  const { title } = await createTitledDocument(alice, "List share");
  await alice.getByRole("link", { name: "← Documents" }).click();

  await alice
    .getByRole("button", { name: `More actions for ${title}` })
    .click();
  await alice.getByRole("menuitem", { name: "Share" }).click();
  const dialog = alice.getByRole("dialog");
  await dialog.getByLabel("Add people").selectOption({ label: "Bob" });
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(
    dialog.getByRole("button", { name: "Remove Bob" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  const row = alice.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("Shared with 1");
  const bob = await openPageAs(browser, "bob");
  await expect(
    getSharedWithMeList(bob).getByRole("link", { name: title }),
  ).toBeVisible();
});
