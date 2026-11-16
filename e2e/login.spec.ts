import { expect, test, type Page } from "@playwright/test";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "change-me-dev-password";

async function logInAs(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("a logged-out visit to / lands on the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("logging in as alice shows the app shell with her name", async ({
  page,
}) => {
  await logInAs(page, "alice");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Alice", { exact: true })).toBeVisible();
});

test("refreshing keeps you logged in", async ({ page }) => {
  await logInAs(page, "alice");
  await expect(page.getByText("You're logged in")).toBeVisible();

  await page.reload();

  await expect(page.getByText("You're logged in")).toBeVisible();
});

test("logging out returns to /login and protects / again", async ({ page }) => {
  await logInAs(page, "alice");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
});
